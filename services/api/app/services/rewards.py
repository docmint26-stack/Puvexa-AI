"""Idempotent off-chain reward scheduling.

Canonical idempotency keys:
- reward for an accepted contribution / fix:    accepted_fix:{fix_id}:{user_id}
- royalty for a fix usage:                       royalty:{usage_id}:{contributor_id}
- verified outcome reward:                       verified_outcome:{outcome_id}   (used by learning engine)

Every grant uses the same insert-on-conflict pattern so double delivery is impossible.
Reward amounts and status are always set server-side; user input never flows into them.
"""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import APIError
from app.db.base import now
from app.db.models import Profile, ReputationEvent, RewardLedger
from app.services.events import audit


def _insert_for(db: AsyncSession):
    return pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert


async def grant_reward(
    db: AsyncSession,
    *,
    user_id: str,
    event_type: str,
    reference_type: str,
    reference_id: str,
    amount: Decimal | int | float,
    status: str,
    reason: str,
    idempotency_key: str,
    claimable_at=None,
    created_by_user_id: str | None = None,
) -> tuple[RewardLedger, bool]:
    """Inserts a reward exactly once. Returns (reward_or_None, created_bool)."""
    insert = _insert_for(db)
    stmt = (
        insert(RewardLedger)
        .values(
            user_id=user_id,
            event_type=event_type,
            reference_type=reference_type,
            reference_id=reference_id,
            amount=Decimal(str(amount)),
            status=status,
            reason=reason,
            idempotency_key=idempotency_key,
            claimable_at=claimable_at or (now() if status in ("claimable", "reserved_for_web3") else None),
        )
        .on_conflict_do_nothing(index_elements=["idempotency_key"])
        .returning(RewardLedger.id, RewardLedger.status)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row:
        if created_by_user_id:
            audit(db, created_by_user_id, "reward_scheduled", "reward", row.id)
        return await db.get(RewardLedger, row.id), True

    existing = await db.scalar(select(RewardLedger).where(RewardLedger.idempotency_key == idempotency_key))
    return existing, False


async def grant_fix_acceptance(
    db: AsyncSession,
    *,
    fix_id: str,
    user_id: str,
    amount: Decimal | int | float = 12,
    actor_user_id: str | None = None,
) -> tuple[RewardLedger | None, bool]:
    """Awards an off-chain reward when a contribution fix is accepted. Idempotent per fix+user."""
    key = f"accepted_fix:{fix_id}:{user_id}"
    return await grant_reward(
        db,
        user_id=user_id,
        event_type="fix_accepted",
        reference_type="fix",
        reference_id=fix_id,
        amount=amount,
        status="claimable",
        reason="Contribution accepted into Puvexa knowledge graph",
        idempotency_key=key,
        created_by_user_id=actor_user_id,
    )


async def grant_royalty(
    db: AsyncSession,
    *,
    usage_id: str,
    contributor_id: str,
    amount: Decimal | int | float,
    actor_user_id: str | None = None,
) -> tuple[RewardLedger | None, bool]:
    """Schedules an off-chain royalty for a contributor whose fix was used. Idempotent per usage."""
    key = f"royalty:{usage_id}:{contributor_id}"
    return await grant_reward(
        db,
        user_id=contributor_id,
        event_type="royalty",
        reference_type="fix_usage",
        reference_id=usage_id,
        amount=amount,
        status="claimable",
        reason="Verified usage of a contributed fix",
        idempotency_key=key,
        created_by_user_id=actor_user_id,
    )


async def grant_reputation(
    db: AsyncSession,
    *,
    user_id: str,
    event_type: str,
    reference_id: str,
    points: int,
    reason: str,
    idempotency_key: str,
    actor_user_id: str | None = None,
) -> tuple[ReputationEvent | None, bool]:
    """Inserts a reputation event exactly once and refreshes the profile score."""
    insert = _insert_for(db)
    stmt = (
        insert(ReputationEvent)
        .values(
            user_id=user_id,
            event_type=event_type,
            reference_id=reference_id,
            points=points,
            reason=reason,
            idempotency_key=idempotency_key,
        )
        .on_conflict_do_nothing(index_elements=["idempotency_key"])
        .returning(ReputationEvent.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    created = bool(row)

    profile = await db.scalar(select(Profile).where(Profile.id == user_id).with_for_update())
    if profile:
        score = await db.scalar(
            select(func.coalesce(func.sum(ReputationEvent.points), 0)).where(ReputationEvent.user_id == user_id)
        ) or 0
        profile.reputation_score = int(score)
        profile.reputation_level = _level(int(score))

    if created and actor_user_id:
        audit(db, actor_user_id, "reputation_granted", "reputation", row.id)
    existing = await db.scalar(select(ReputationEvent).where(ReputationEvent.idempotency_key == idempotency_key))
    return existing, created


def _level(points: int) -> str:
    from app.services.workflows import reputation_level

    return reputation_level(points)


async def cancel_reward(db: AsyncSession, *, user_id: str, reward_id: str, reason: str, actor_user_id: str | None = None) -> RewardLedger:
    """Cancels a claimable reward (e.g. abuse reversal). Idempotent; already-cancelled is a no-op."""
    reward = await db.scalar(select(RewardLedger).where(RewardLedger.id == reward_id).with_for_update())
    if not reward or reward.user_id != user_id:
        raise APIError(404, "REWARD_NOT_FOUND", "Reward not found.")
    if reward.status in ("cancelled", "claimed_offchain", "claimed_onchain"):
        return reward
    reward.status = "cancelled"
    await db.flush()
    audit(db, actor_user_id or user_id, "reward_cancelled", "reward", reward.id)
    return reward