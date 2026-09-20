"""Future claim reservation state machine.

A reward moves claimable -> reserved -> signed -> submitted -> confirmed.
Failure paths: reserved -> released (user abandons), submitted -> failed -> reserved (retryable).

Rules:
- One claim reservation per reward (unique per reward_id).
- Only the reward owner may reserve or release.
- State transitions are strictly validated; any disallowed move is rejected.
- Idempotent: reserving twice for the same reward returns the existing reservation.
- No chain interaction is faked. 'confirm' requires an explicit trusted confirmation
  (e.g. a webhook from the settlement provider); until then a claim remains submitted.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import APIError
from app.db.base import now
from app.db.models import ClaimReservation, RewardLedger
from app.services.workflows import audit

TERMINAL = {"confirmed", "released", "failed"}

TRANSITIONS: dict[str, set[str]] = {
    "claimable": {"reserved"},
    "reserved": {"signed", "released"},
    "signed": {"submitted", "released"},
    "submitted": {"confirmed", "failed"},
    "failed": {"reserved"},
    "confirmed": set(),
    "released": set(),
}

TIMESTAMP_FIELDS = {
    "reserved_at": "reserved",
    "signed_at": "signed",
    "submitted_at": "submitted",
    "confirmed_at": "confirmed",
    "released_at": "released",
    "failed_at": "failed",
}


class ClaimFlowError(APIError):
    pass


class ClaimReservationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load_reward(self, reward_id: str, user_id: str) -> RewardLedger:
        reward = await self.db.get(RewardLedger, reward_id)
        if not reward or reward.user_id != user_id:
            raise APIError(404, "REWARD_NOT_FOUND", "Reward not found.")
        return reward

    async def _transition(self, claim: ClaimReservation, target: str) -> None:
        if claim.state not in TRANSITIONS or target not in TRANSITIONS[claim.state]:
            raise ClaimFlowError(409, "INVALID_CLAIM_STATE", f"Cannot move claim from {claim.state} to {target}.")
        claim.state = target
        field = TIMESTAMP_FIELDS.get(target)
        if field:
            setattr(claim, field, now())
        await self.db.flush()

    async def reserve(self, reward_id: str, user_id: str) -> ClaimReservation:
        """Claims a claimable reward for a future web3 claim. Idempotent per reward."""
        reward = await self._load_reward(reward_id, user_id)
        if reward.status in ("cancelled", "claimed_offchain"):
            raise APIError(409, "REWARD_NOT_CLAIMABLE", "This reward is no longer claimable.")
        if reward.status == "reserved_for_web3":
            existing = await self.db.scalar(
                select(ClaimReservation).where(ClaimReservation.reward_id == reward_id).with_for_update()
            )
            if existing and existing.user_id == user_id:
                return existing
            raise APIError(409, "REWARD_ALREADY_RESERVED", "This reward is already reserved for another claim.")
        if reward.status != "claimable":
            raise APIError(409, "REWARD_NOT_CLAIMABLE", "Only claimable rewards can be reserved for future claims.")

        existing = await self.db.scalar(
            select(ClaimReservation).where(ClaimReservation.reward_id == reward_id).with_for_update()
        )
        if existing:
            if existing.user_id == user_id:
                return existing
            raise APIError(409, "REWARD_ALREADY_RESERVED", "This reward is already reserved.")

        claim = ClaimReservation(reward_id=reward_id, user_id=user_id, state="reserved", reserved_at=now())
        self.db.add(claim)
        reward.status = "reserved_for_web3"
        await self.db.flush()
        audit(self.db, user_id, "future_claim_reserved", "claim", claim.id)
        return claim

    async def _owned(self, claim_id: str, user_id: str, state: str | None = None) -> ClaimReservation:
        claim = await self.db.scalar(
            select(ClaimReservation).where(ClaimReservation.id == claim_id).with_for_update()
        )
        if not claim or claim.user_id != user_id:
            raise APIError(404, "CLAIM_NOT_FOUND", "Claim not found.")
        if state and claim.state != state:
            raise ClaimFlowError(409, "INVALID_CLAIM_STATE", f"Claim is in state {claim.state}; expected {state}.")
        return claim

    async def record_signed(self, claim_id: str, user_id: str, signed_payload_hash: str) -> ClaimReservation:
        """Moves reserved -> signed after the client produces an off-chain signed payload commitment."""
        claim = await self._owned(claim_id, user_id, "reserved")
        claim.signed_payload_hash = signed_payload_hash
        await self._transition(claim, "signed")
        return claim

    async def submit(self, claim_id: str, user_id: str, chain_id: int | None = None) -> ClaimReservation:
        """Moves signed -> submitted, signalling that the claim payload is ready for settlement."""
        claim = await self._owned(claim_id, user_id, "signed")
        if chain_id:
            claim.chain_id = chain_id
        await self._transition(claim, "submitted")
        return claim

    async def confirm(self, claim_id: str, user_id: str, chain_id: int, tx_hash: str) -> ClaimReservation:
        """Moves submitted -> confirmed given an on-chain confirmation reference.

        This is a settlement-webhook boundary. Callers MUST provide a trusted tx hash
        obtained from the settlement provider; this service never fabricates confirmation.
        """
        if not tx_hash or not str(tx_hash).strip():
            raise ClaimFlowError(409, "MISSING_TX_HASH", "On-chain confirmation requires a transaction hash.")
        claim = await self._owned(claim_id, user_id, "submitted")
        claim.chain_id = chain_id
        claim.tx_hash = str(tx_hash).strip()
        await self._transition(claim, "confirmed")
        reward = await self.db.get(RewardLedger, claim.reward_id)
        if reward:
            reward.status = "claimed_onchain"
            reward.claimed_at = now()
            audit(self.db, user_id, "future_claim_confirmed", "claim", claim.id)
            audit(self.db, user_id, "reward_claimed_onchain", "reward", reward.id)
        return claim

    async def release(self, claim_id: str, user_id: str) -> ClaimReservation:
        """Moves reserved or signed -> released, returning the reward to claimable."""
        claim = await self._owned(claim_id, user_id)
        if claim.state not in ("reserved", "signed"):
            raise ClaimFlowError(409, "INVALID_CLAIM_STATE", "Only reserved or signed claims can be released.")
        await self._transition(claim, "released")
        reward = await self.db.get(RewardLedger, claim.reward_id)
        if reward:
            reward.status = "claimable"
            audit(self.db, user_id, "future_claim_released", "claim", claim.id)
        return claim

    async def fail(self, claim_id: str, user_id: str, error_code: str = "SETTLEMENT_FAILED") -> ClaimReservation:
        """Moves submitted -> failed; a failed claim may be reserved again (retry)."""
        claim = await self._owned(claim_id, user_id, "submitted")
        claim.error_code = error_code
        await self._transition(claim, "failed")
        audit(self.db, user_id, "future_claim_failed", "claim", claim.id)
        return claim

    async def reserve_after_failure(self, claim_id: str, user_id: str) -> ClaimReservation:
        """Moves failed -> reserved, allowing a retry after a settlement failure."""
        claim = await self._owned(claim_id, user_id, "failed")
        claim.error_code = None
        await self._transition(claim, "reserved")
        return claim