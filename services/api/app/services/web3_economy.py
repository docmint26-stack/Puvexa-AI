"""Web3 economy service: EIP-712 signer, chain verifier, and claim/stake settlement.

Security boundaries (must not be violated):
- The backend NEVER lets an AI model sign, spend, or move tokens.
- Chain confirmation is always re-verified by the backend from node data; a client's
  "it worked" message is never trusted.
- Claim prepare -> user broadcasts -> backend verifies the on-chain event -> DB settles.
- The blockchain never judges fix correctness; it only settles pre-authorized rewards.
- EIP-712 payloads must match the Solidity `RewardDistributor` byte-for-byte.
"""
import logging
import time
from datetime import UTC, datetime
from decimal import Decimal

from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_hash.auto import keccak
from hexbytes import HexBytes
from web3 import AsyncHTTPProvider, AsyncWeb3

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.models import Web3Transaction
from app.services.events import audit, notify
from app.services.wallet import normalize_address

logger = logging.getLogger("puvexa")

DOMAIN_NAME = "Puvexa Reward Distributor"
DOMAIN_VERSION = "1"

CLAIM_TYPEHASH = keccak(b"Claim(bytes32 claimId,address recipient,uint256 amount,uint256 deadline)")
DOMAIN_TYPEHASH = keccak(b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")

# Event signatures emitted by the Puvexa contracts (verified against forge test logs).
CLAIM_PAID_EVENT = "ClaimPaid(bytes32,address,uint256,uint256)"
STAKED_EVENT = "Staked(bytes32,address,uint256)"
RELEASED_EVENT = "Released(bytes32,address,uint256)"
SLASHED_EVENT = "Slashed(bytes32,address,uint256,uint256)"
CLAIM_PAID_TOPIC0 = keccak(b"ClaimPaid(bytes32,address,uint256,uint256)")
STAKED_TOPIC0 = keccak(b"Staked(bytes32,address,uint256)")
RELEASED_TOPIC0 = keccak(b"Released(bytes32,address,uint256)")
SLASHED_TOPIC0 = keccak(b"Slashed(bytes32,address,uint256,uint256)")

WEI = 10**18


class Web3ConfigError(APIError):
    pass


def _wei(amount_fixai: float | int | str) -> int:
    """Converts a FIXAI amount (18-decimal) to wei. Negative/NaN is rejected."""
    try:
        value = Decimal(str(amount_fixai))
    except Exception as exc:  # noqa: BLE001
        raise APIError(422, "INVALID_AMOUNT", "Amount must be a finite decimal number.") from exc
    if not value.is_finite() or value < 0:
        raise APIError(422, "INVALID_AMOUNT", "Amount must be a finite, non-negative decimal number.")
    return int(value * _dec_base())


def _dec_base() -> int:
    return WEI


class RewardSigner:
    """Signs EIP-712 Claim payloads exactly as the RewardDistributor validates them."""

    def __init__(self, private_key: str | None = None):
        key = private_key if private_key is not None else get_settings().web3_reward_signer_private_key
        if not key:
            raise Web3ConfigError(503, "WEB3_SIGNER_UNCONFIGURED", "Reward signer key is not configured.")
        try:
            self.key = Account.from_key(key)
        except Exception as exc:  # noqa: BLE001
            raise Web3ConfigError(503, "WEB3_SIGNER_INVALID", "Reward signer key is invalid.") from exc

    @property
    def address(self) -> str:
        return self.key.address

    def domain(self, chain_id: int, verifying_contract: str) -> dict:
        return {
            "name": DOMAIN_NAME,
            "version": DOMAIN_VERSION,
            "chainId": chain_id,
            "verifyingContract": verifying_contract,
        }

    def typed_message(self, *, chain_id: int, verifying_contract: str, claim_id: str, recipient: str, amount: int, deadline: int) -> dict:
        return {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
                "Claim": [
                    {"name": "claimId", "type": "bytes32"},
                    {"name": "recipient", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "deadline", "type": "uint256"},
                ],
            },
            "primaryType": "Claim",
            "domain": self.domain(chain_id, verifying_contract),
            "message": {
                "claimId": claim_id,
                "recipient": recipient,
                "amount": amount,
                "deadline": deadline,
            },
        }

    def sign(self, typed: dict) -> tuple[str, bytes]:
        """Returns (signature_hex, digest) for a claim payload."""
        signable = encode_typed_data(full_message=typed)
        signed = Account.sign_message(signable, private_key=self.key.key)
        return "0x" + signed.signature.hex(), signed.message_hash


class ChainVerifier:
    """Re-verifies on-chain settlement from node data. Never trusts client claims."""

    def __init__(self, rpc_url: str | None = None, chain_id: int | None = None):
        self.settings = get_settings()
        self.rpc_url = rpc_url if rpc_url is not None else self.settings.web3_testnet_rpc_url
        self.chain_id = chain_id if chain_id is not None else self.settings.web3_chain_id
        self._w3: AsyncWeb3 | None = None

    @property
    def configured(self) -> bool:
        return bool(self.rpc_url)

    def _web3(self) -> AsyncWeb3:
        if not self.rpc_url:
            raise APIError(503, "WEB3_NETWORK_UNCONFIGURED", "Testnet RPC is not configured.")
        if self._w3 is None:
            self._w3 = AsyncWeb3(AsyncHTTPProvider(self.rpc_url))
        return self._w3

    async def is_connected(self) -> bool:
        if not self.configured:
            return False
        try:
            return bool(await self._web3().is_connected())
        except Exception:  # noqa: BLE001
            return False

    async def get_receipt(self, tx_hash: str) -> dict:
        w3 = self._web3()
        try:
            receipt = await w3.eth.get_transaction_receipt(HexBytes(tx_hash))
        except Exception as exc:  # noqa: BLE001
            raise APIError(422, "WEB3_TX_NOT_FOUND", "Transaction was not found on the configured chain.") from exc
        if not receipt:
            raise APIError(422, "WEB3_TX_NOT_FOUND", "Transaction was not found on the configured chain.")
        return dict(receipt)

    @staticmethod
    def _topic0(event_signature: str):
        return keccak(event_signature.encode()).hex()

    def _find_claim_paid(self, receipt: dict, distributor_address: str, claim_id: str) -> dict | None:
        topic0 = self._topic0(CLAIM_PAID_EVENT)
        distributor = normalize_address(distributor_address)
        for log in receipt.get("logs", []):
            if normalize_address(log.get("address", "")) != distributor:
                continue
            topics = log.get("topics", [])
            if len(topics) != 3 or topics[0].hex() != topic0:
                continue
            if topics[1].hex() != claim_id[2:].lower():
                continue
            return {"recipient": "0x" + topics[2].hex()[-40:], "data": log.get("data", HexBytes(b""))}
        return None

    def _decode_claim_paid_data(self, data: bytes | HexBytes) -> tuple[int, int]:
        if len(data) < 64:
            raise APIError(422, "WEB3_EVENT_MALFORMED", "ClaimPaid log data is malformed.")
        raw = bytes(data)
        amount = int.from_bytes(raw[0:32], "big")
        deadline = int.from_bytes(raw[32:64], "big")
        return amount, deadline

    def _find_staked(self, receipt: dict, vault_address: str, contribution_id: str) -> dict | None:
        topic0 = self._topic0(STAKED_EVENT)
        vault = normalize_address(vault_address)
        for log in receipt.get("logs", []):
            if normalize_address(log.get("address", "")) != vault:
                continue
            topics = log.get("topics", [])
            if len(topics) != 3 or topics[0].hex() != topic0:
                continue
            if topics[1].hex() != contribution_id[2:].lower():
                continue
            return {"wallet": "0x" + topics[2].hex()[-40:], "data": log.get("data", HexBytes(b""))}
        return None

    def _decode_staked_data(self, data: bytes | HexBytes) -> int:
        if len(data) < 32:
            raise APIError(422, "WEB3_EVENT_MALFORMED", "Staked log data is malformed.")
        return int.from_bytes(bytes(data)[0:32], "big")

    def _find_released(self, receipt: dict, vault_address: str, contribution_id: str) -> dict | None:
        topic0 = self._topic0(RELEASED_EVENT)
        vault = normalize_address(vault_address)
        for log in receipt.get("logs", []):
            if normalize_address(log.get("address", "")) != vault:
                continue
            topics = log.get("topics", [])
            if len(topics) != 3 or topics[0].hex() != topic0:
                continue
            if topics[1].hex() != contribution_id[2:].lower():
                continue
            return {"wallet": "0x" + topics[2].hex()[-40:], "data": log.get("data", HexBytes(b""))}
        return None

    def _decode_released_data(self, data: bytes | HexBytes) -> int:
        if len(data) < 32:
            raise APIError(422, "WEB3_EVENT_MALFORMED", "Released log data is malformed.")
        return int.from_bytes(bytes(data)[0:32], "big")

    def _find_slashed(self, receipt: dict, vault_address: str, contribution_id: str) -> dict | None:
        topic0 = self._topic0(SLASHED_EVENT)
        vault = normalize_address(vault_address)
        for log in receipt.get("logs", []):
            if normalize_address(log.get("address", "")) != vault:
                continue
            topics = log.get("topics", [])
            if len(topics) != 3 or topics[0].hex() != topic0:
                continue
            if topics[1].hex() != contribution_id[2:].lower():
                continue
            return {"wallet": "0x" + topics[2].hex()[-40:], "data": log.get("data", HexBytes(b""))}
        return None

    def _decode_slashed_data(self, data: bytes | HexBytes) -> tuple[int, int]:
        if len(data) < 64:
            raise APIError(422, "WEB3_EVENT_MALFORMED", "Slashed log data is malformed.")
        raw = bytes(data)
        slashed = int.from_bytes(raw[0:32], "big")
        returned = int.from_bytes(raw[32:64], "big")
        return slashed, returned


class Web3EconomyService:
    """Orchestrates EIP-712 claim preparation and on-chain settlement verification."""

    def __init__(self, db):
        self.db = db
        self.settings = get_settings()
        self.signer = RewardSigner() if self.settings.web3_reward_signer_private_key else None
        self.chain = ChainVerifier()

    def _ensure_enabled(self):
        if not self.settings.web3_claim_enabled:
            raise APIError(409, "WEB3_UNAVAILABLE", "On-chain claims are not enabled yet.")

    def _ensure_chain_config(self) -> None:
        if not self.settings.web3_testnet_rpc_url:
            raise APIError(503, "WEB3_NETWORK_UNCONFIGURED", "Testnet RPC is not configured.")
        if not self.settings.web3_token_address or not self.settings.web3_distributor_address:
            raise APIError(503, "WEB3_CONTRACTS_UNCONFIGURED", "Token/distributor contracts are not configured.")
        if self.signer is None:
            raise APIError(503, "WEB3_SIGNER_UNCONFIGURED", "Reward signer key is not configured.")
        if not self.settings.allow_mainnet_deployment and self.settings.web3_chain_id == 0:
            raise APIError(503, "WEB3_MAINNET_DISABLED", "Mainnet deployment is disabled in this environment.")

    def token_config(self) -> dict:
        return {
            "token_address": normalize_address(self.settings.web3_token_address) if self.settings.web3_token_address else "",
            "distributor_address": normalize_address(self.settings.web3_distributor_address) if self.settings.web3_distributor_address else "",
            "stake_vault_address": normalize_address(self.settings.web3_stake_vault_address) if self.settings.web3_stake_vault_address else "",
            "registry_address": normalize_address(self.settings.web3_registry_address) if self.settings.web3_registry_address else "",
            "chain_id": self.settings.web3_chain_id,
            "rpc_configured": bool(self.settings.web3_testnet_rpc_url),
            "signer_configured": bool(self.settings.web3_reward_signer_private_key),
            "claim_enabled": self.settings.web3_claim_enabled,
        }

    async def status(self) -> dict:
        cfg = self.token_config()
        cfg["connected"] = await self.chain.is_connected() if cfg["rpc_configured"] else False
        if self.signer is not None:
            cfg["signer_address"] = self.signer.address
        return cfg

    async def prepare_claim(
        self,
        *,
        reward_id: str,
        user_id: str,
        wallet_address: str,
        company_wallet_address: str | None = None,
        chain_id: int | None = None,
    ) -> dict:
        """Builds and signs an EIP-712 Claim for a reserved reward.

        The reward amount is always read from the authoritative RewardLedger row.
        """
        from app.db.models import RewardLedger

        self._ensure_enabled()
        self._ensure_chain_config()

        from sqlalchemy import select

        reward = await self.db.scalar(select(RewardLedger).where(RewardLedger.id == reward_id, RewardLedger.user_id == user_id))
        if not reward:
            raise APIError(404, "REWARD_NOT_FOUND", "Reward not found.")
        if reward.status != "claimable":
            raise APIError(409, "REWARD_NOT_CLAIMABLE", "This reward is not claimable.")

        claimant = normalize_address(wallet_address)
        from app.db.models import WalletLink

        link = await self.db.scalar(select(WalletLink).where(WalletLink.wallet_address == claimant, WalletLink.user_id == user_id))
        if not link or link.status != "verified":
            raise APIError(409, "WALLET_NOT_VERIFIED", "Verify this wallet before claiming.")

        from app.db.models import ClaimReservation

        existing = await self.db.scalar(select(ClaimReservation).where(ClaimReservation.reward_id == reward_id))
        if existing and existing.claim_id:
            if existing.state in ("confirmed", "released"):
                raise APIError(409, "REWARD_ALREADY_CLAIMED", "This reward has already been finalized.")
            raise APIError(409, "REWARD_ALREADY_RESERVED", "This reward already has a prepared claim.")

        chain = chain_id or self.settings.web3_chain_id
        verifying_contract = normalize_address(self.settings.web3_distributor_address)
        token_address = normalize_address(self.settings.web3_token_address)

        claim_id = "0x" + keccak(f"{reward_id}:{claimant}".encode()).hex()
        amount_wei = _wei(reward.amount)
        deadline = int(time.time()) + self.settings.claim_reservation_ttl_hours * 3600

        typed = self.signer.typed_message(
            chain_id=chain,
            verifying_contract=verifying_contract,
            claim_id=claim_id,
            recipient=claimant,
            amount=amount_wei,
            deadline=deadline,
        )
        signature, digest = self.signer.sign(typed)

        claim = ClaimReservation(
            reward_id=reward_id,
            user_id=user_id,
            state="signed",
            signed_payload_hash=digest.hex(),
            chain_id=chain,
            claim_id=claim_id,
            wallet_address=claimant,
            contract_address=verifying_contract,
            deadline=deadline,
            reserved_at=datetime.now(UTC),
            signed_at=datetime.now(UTC),
        )
        self.db.add(claim)
        reward.status = "reserved_for_web3"
        audit(self.db, user_id, "web3_claim_prepared", "claim_reservation", claim.id)
        await self.db.flush()

        from decimal import Decimal

        return {
            "claim_id": claim_id,
            "reward_id": claim.reward_id,
            "recipient": claimant,
            "token_address": token_address,
            "verifying_contract": verifying_contract,
            "chain_id": chain,
            "amount_fixai": str(Decimal(reward.amount)),
            "amount_wei": str(amount_wei),
            "deadline": deadline,
            "eip712": typed,
            "signature": signature,
            "digest": digest.hex(),
        }

    async def confirm_claim(self, *, claim_id: str, user_id: str, tx_hash: str, chain_id: int | None = None) -> dict:
        """Verifies the on-chain ClaimPaid event, then marks the DB claim confirmed."""
        from sqlalchemy import select

        from app.db.models import ClaimReservation

        self._ensure_enabled()
        self._ensure_chain_config()

        claim = await self.db.scalar(select(ClaimReservation).where(ClaimReservation.claim_id == claim_id, ClaimReservation.user_id == user_id))
        if not claim:
            raise APIError(404, "CLAIM_NOT_FOUND", "Claim not found.")
        if claim.state == "confirmed":
            raise APIError(409, "CLAIM_ALREADY_CONFIRMED", "This claim is already confirmed.")
        if claim.state not in ("signed", "submitted"):
            raise APIError(409, "INVALID_CLAIM_STATE", "Claim is in an unexpected state.")

        receipt = await self.chain.get_receipt(tx_hash)
        if receipt.get("status") != 1:
            raise APIError(422, "WEB3_TX_FAILED", "The on-chain transaction reverted.")

        event = self.chain._find_claim_paid(receipt, self.settings.web3_distributor_address, claim_id)
        if event is None:
            raise APIError(422, "WEB3_CLAIM_EVENT_MISSING", "ClaimPaid event not found for the claim.")
        paid_amount, paid_deadline = self.chain._decode_claim_paid_data(event["data"])

        # Amounts are recovered from the reward ledger (authoritative), never from the client.
        from app.db.models import RewardLedger

        reward = await self.db.get(RewardLedger, claim.reward_id)
        expected_amount = _wei(reward.amount) if reward else None

        if expected_amount is not None and paid_amount != expected_amount:
            raise APIError(422, "WEB3_AMOUNT_MISMATCH", "On-chain payout amount does not match the reward.")
        if normalize_address(event["recipient"]) != normalize_address(claim.wallet_address):
            raise APIError(422, "WEB3_RECIPIENT_MISMATCH", "On-chain payout recipient does not match the claim.")

        claim.state = "confirmed"
        claim.tx_hash = str(tx_hash).strip().lower()
        claim.confirmed_at = datetime.now(UTC)
        if reward:
            reward.status = "claimed_onchain"
            reward.claimed_at = datetime.now(UTC)
        from sqlalchemy import select as _select

        existing_tx = await self.db.scalar(_select(Web3Transaction).where(Web3Transaction.tx_hash == claim.tx_hash))
        if not existing_tx:
            self.db.add(
                Web3Transaction(
                    user_id=user_id,
                    claim_id=claim_id,
                    tx_type="claim",
                    tx_hash=claim.tx_hash,
                    chain_id=chain_id or claim.chain_id,
                    status="confirmed",
                    from_address=claim.wallet_address,
                    to_address=claim.contract_address,
                    block_number=receipt.get("blockNumber"),
                    confirmed_at=datetime.now(UTC),
                )
            )
        audit(self.db, user_id, "web3_claim_confirmed", "claim_reservation", claim.id)
        notify(self.db, user_id, "Reward settled on-chain", "Your FIXAI reward has been paid.", kind="reward", href="/rewards")
        logger.info(
            "web3_claim_confirmed",
            extra={"fields": {"claim_id": claim.claim_id, "tx_hash": claim.tx_hash, "status": "confirmed", "chain_id": chain_id or claim.chain_id}},
        )
        await self.db.flush()

        return {
            "status": "confirmed",
            "claim_id": claim.claim_id,
            "reward_id": claim.reward_id,
            "tx_hash": claim.tx_hash,
            "confirmed_at": claim.confirmed_at,
        }

    async def record_stake(self, *, contribution_id: str, user_id: str, wallet_address: str, tx_hash: str, chain_id: int | None = None) -> dict:
        """Verifies a Staked event and records the transaction (no DB staking state yet)."""
        self._ensure_enabled()
        self._ensure_chain_config()
        if not self.settings.web3_stake_vault_address:
            raise APIError(503, "WEB3_STAKE_VAULT_UNCONFIGURED", "Stake vault contract is not configured.")


        cid = contribution_id.lower()
        receipt = await self.chain.get_receipt(tx_hash)
        if receipt.get("status") != 1:
            raise APIError(422, "WEB3_TX_FAILED", "The on-chain transaction reverted.")

        event = self.chain._find_staked(receipt, self.settings.web3_stake_vault_address, cid)
        if event is None:
            raise APIError(422, "WEB3_STAKE_EVENT_MISSING", "Staked event not found for the contribution.")
        staked_amount = self.chain._decode_staked_data(event["data"])
        if normalize_address(event["wallet"]) != normalize_address(wallet_address):
            raise APIError(422, "WEB3_STAKE_WALLET_MISMATCH", "Staker does not match the verified wallet.")

        th = str(tx_hash).strip().lower()
        from sqlalchemy import select

        existing_tx = await self.db.scalar(select(Web3Transaction).where(Web3Transaction.tx_hash == th))
        if not existing_tx:
            self.db.add(
                Web3Transaction(
                    user_id=user_id,
                    tx_type="stake",
                    tx_hash=th,
                    chain_id=chain_id or self.settings.web3_chain_id,
                    status="confirmed",
                    from_address=normalize_address(wallet_address),
                    to_address=normalize_address(self.settings.web3_stake_vault_address),
                    block_number=receipt.get("blockNumber"),
                    confirmed_at=datetime.now(UTC),
                )
            )
        audit(self.db, user_id, "web3_stake_confirmed", "web3_transaction", None)
        await self.db.flush()
        return {"status": "confirmed", "contribution_id": cid, "tx_hash": th, "amount_wei": str(staked_amount)}

    async def confirm_stake_settlement(
        self, *, contribution_id: str, user_id: str, tx_hash: str, kind: str, chain_id: int | None = None
    ) -> dict:
        """Verifies a stake Released/Slashed event and records the settlement transaction.

        `kind` must be "release" or "slash". Settlement is verified from node data only;
        the operator-broadcast transaction is confirmed independently, never trusted from
        a client message. Release/slash is initiated by the protocol operator role, not by
        the frontend or any AI component.
        """
        if kind not in ("release", "slash"):
            raise APIError(422, "INVALID_SETTLEMENT_KIND", "Settlement kind must be release or slash.")
        self._ensure_enabled()
        self._ensure_chain_config()
        if not self.settings.web3_stake_vault_address:
            raise APIError(503, "WEB3_STAKE_VAULT_UNCONFIGURED", "Stake vault contract is not configured.")

        cid = contribution_id.lower()
        receipt = await self.chain.get_receipt(tx_hash)
        if receipt.get("status") != 1:
            raise APIError(422, "WEB3_TX_FAILED", "The on-chain transaction reverted.")

        vault = normalize_address(self.settings.web3_stake_vault_address)
        th = str(tx_hash).strip().lower()

        if kind == "release":
            event = self.chain._find_released(receipt, vault, cid)
            if event is None:
                raise APIError(422, "WEB3_RELEASE_EVENT_MISSING", "Released event not found for the contribution.")
            returned = self.chain._decode_released_data(event["data"])
            slashed = 0
            tx_type = "stake_release"
        else:
            event = self.chain._find_slashed(receipt, vault, cid)
            if event is None:
                raise APIError(422, "WEB3_SLASH_EVENT_MISSING", "Slashed event not found for the contribution.")
            slashed, returned = self.chain._decode_slashed_data(event["data"])
            tx_type = "stake_slash"

        wallet = event["wallet"]
        from sqlalchemy import select

        existing_tx = await self.db.scalar(select(Web3Transaction).where(Web3Transaction.tx_hash == th))
        if not existing_tx:
            self.db.add(
                Web3Transaction(
                    user_id=user_id,
                    tx_type=tx_type,
                    tx_hash=th,
                    chain_id=chain_id or self.settings.web3_chain_id,
                    status="confirmed",
                    from_address=vault,
                    to_address=wallet,
                    block_number=receipt.get("blockNumber"),
                    confirmed_at=datetime.now(UTC),
                )
            )
        audit(self.db, user_id, f"web3_stake_{kind}", "web3_transaction", None)
        logger.info(
            "web3_stake_settlement_confirmed",
            extra={"fields": {"kind": kind, "contribution_id": cid, "tx_hash": th, "status": "confirmed", "chain_id": chain_id or self.settings.web3_chain_id}},
        )
        await self.db.flush()
        return {
            "status": "confirmed",
            "contribution_id": cid,
            "tx_hash": th,
            "wallet_address": wallet,
            "slashed_wei": str(slashed),
            "returned_wei": str(returned),
        }