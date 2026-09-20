"""Knowledge attribution with strict ownership-share enforcement.

Rules enforced here:
- Each attribution row must have ownership_share in (0, 1].
- The sum of ownership shares across a fix (per version) must never exceed 100%.
- A contributor can only hold ONE attribution per fix/type/version (upsert, never duplicate).
- Creator attribution is required and unique per fix; improver/correction shares are additive
  and capped by remaining ownership.
"""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import APIError
from app.db.models import Fix, KnowledgeAttribution, Profile
from app.services.events import audit


def _dec(value: float | Decimal) -> Decimal:
    return Decimal(str(value))


class AttributionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def allocated_share(self, fix_id: str, version: int = 1) -> Decimal:
        row = await self.db.execute(
            select(func.coalesce(func.sum(KnowledgeAttribution.ownership_share), 0))
            .where(KnowledgeAttribution.fix_id == fix_id, KnowledgeAttribution.version == version)
        )
        return Decimal(str(row.scalar_one() or 0))

    async def remaining_share(self, fix_id: str, version: int = 1) -> Decimal:
        return Decimal("1.0") - await self.allocated_share(fix_id, version)

    async def set_creator(self, fix_id: str, contributor_user_id: str, share: float | Decimal = 1.0) -> KnowledgeAttribution:
        """Assigns the creator attribution for a fix (idempotent, single active creator per version)."""
        fix = await self.db.get(Fix, fix_id)
        if not fix:
            raise APIError(404, "FIX_NOT_FOUND", "Fix not found.")
        if fix.created_by_user_id != contributor_user_id:
            raise APIError(403, "CREATOR_MISMATCH", "Only the fix creator can hold creator attribution.")

        share_dec = _dec(share)
        if not (Decimal("0") < share_dec <= Decimal("1")):
            raise APIError(422, "INVALID_SHARE", "ownership_share must be greater than zero and at most 1.")
        if fix.created_by_user_id and share_dec != Decimal("1.0"):
            raise APIError(422, "CREATOR_SHARE_FULL", "The creator owns the initial fix; creator share must be 1.0.")

        existing = await self.db.scalar(
            select(KnowledgeAttribution).where(
                KnowledgeAttribution.fix_id == fix_id,
                KnowledgeAttribution.contributor_user_id == contributor_user_id,
                KnowledgeAttribution.attribution_type == "creator",
                KnowledgeAttribution.version == 1,
            )
        )
        if existing:
            existing.ownership_share = share_dec
            return existing

        row = KnowledgeAttribution(
            fix_id=fix_id,
            contributor_user_id=contributor_user_id,
            ownership_share=share_dec,
            attribution_type="creator",
            version=1,
        )
        self.db.add(row)
        await self.db.flush()
        audit(self.db, contributor_user_id, "attribution_created", "attribution", row.id)
        return row

    async def add_contribution_share(
        self,
        fix_id: str,
        contributor_user_id: str,
        share: float | Decimal,
        attribution_type: str = "improver",
        version: int = 1,
        actor_user_id: str | None = None,
    ) -> KnowledgeAttribution:
        """Adds an improver/correction share, enforcing total ownership <= 100% per fix/version."""
        fix = await self.db.get(Fix, fix_id)
        if not fix:
            raise APIError(404, "FIX_NOT_FOUND", "Fix not found.")
        profile = await self.db.get(Profile, contributor_user_id)
        if not profile:
            raise APIError(404, "CONTRIBUTOR_NOT_FOUND", "Contributor does not exist.")
        if attribution_type not in ("improver", "correction"):
            raise APIError(422, "INVALID_ATTRIBUTION_TYPE", "Attribution type must be 'creator', 'improver', or 'correction'.")

        share_dec = _dec(share)
        if not (Decimal("0") < share_dec <= Decimal("1")):
            raise APIError(422, "INVALID_SHARE", "ownership_share must be greater than zero and at most 1.")

        allocated = await self.allocated_share(fix_id, version)
        new_total = allocated + share_dec
        if new_total > Decimal("1.0"):
            raise APIError(409, "OWNERSHIP_EXCEEDS_100", f"Attribution would exceed 100%. Remaining share is {Decimal('1.0') - allocated}.")

        existing = await self.db.scalar(
            select(KnowledgeAttribution).where(
                KnowledgeAttribution.fix_id == fix_id,
                KnowledgeAttribution.contributor_user_id == contributor_user_id,
                KnowledgeAttribution.attribution_type == attribution_type,
                KnowledgeAttribution.version == version,
            )
        )
        if existing:
            delta = share_dec - existing.ownership_share
            if allocated - existing.ownership_share + share_dec > Decimal("1.0"):
                raise APIError(409, "OWNERSHIP_EXCEEDS_100", "Adjusting this share would exceed 100% total ownership.")
            existing.ownership_share = share_dec
            await self.db.flush()
            if delta != 0 and actor_user_id:
                audit(self.db, actor_user_id, "attribution_updated", "attribution", existing.id)
            return existing

        row = KnowledgeAttribution(
            fix_id=fix_id,
            contributor_user_id=contributor_user_id,
            ownership_share=share_dec,
            attribution_type=attribution_type,
            version=version,
        )
        self.db.add(row)
        await self.db.flush()
        if actor_user_id:
            audit(self.db, actor_user_id, "attribution_created", "attribution", row.id)
        return row

    async def list_for_fix(self, fix_id: str, version: int = 1) -> list[KnowledgeAttribution]:
        return list((await self.db.scalars(
            select(KnowledgeAttribution)
            .where(KnowledgeAttribution.fix_id == fix_id, KnowledgeAttribution.version == version)
            .order_by(KnowledgeAttribution.created_at)
        )).all())

    async def verify_ownership_consistency(self, fix_id: str, version: int = 1) -> bool:
        """True iff total ownership for the fix/version is within [0.999999, 1.000001] after rounding."""
        total = await self.allocated_share(fix_id, version)
        return Decimal("0.999999") <= total <= Decimal("1.000001")