from datetime import timedelta
from decimal import Decimal
from typing import Protocol

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.base import now
from app.db.models import (
    Case,
    Contribution,
    Fix,
    FixAttempt,
    Outcome,
    Profile,
    ReputationEvent,
    RewardLedger,
)
from app.services.attribution import AttributionService
from app.services.events import audit, notify
from app.services.rewards import grant_fix_acceptance, grant_reputation

TRANSITIONS = {"draft": {"submitted"}, "submitted": {"analyzing"}, "analyzing": {"suggested", "needs_review"}, "needs_review": {"suggested"}, "suggested": {"applied"}, "applied": {"monitoring"}, "monitoring": {"verified", "partially_verified", "failed", "needs_review"}}


def transition(case, target):
    if target not in TRANSITIONS.get(case.status, set()):
        raise APIError(409, "INVALID_TRANSITION", "This case cannot move to that state.")
    case.status = target


class AIProvider(Protocol):
    async def analyze_case(self, case): ...
    async def rank_fixes(self, case): ...
    async def verify_outcome(self, outcome): ...
    async def score_contribution(self, contribution): ...
    async def summarize_evidence(self, evidence): ...


class UnconfiguredAIProvider:
    async def analyze_case(self, case):
        return {"status": "unavailable", "model_provider": "unconfigured", "analysis_metadata": {"code": "AI_PROVIDER_NOT_CONFIGURED", "message": "AI diagnosis engine is not configured yet."}}


class DevelopmentDeterministicProvider(UnconfiguredAIProvider):
    async def analyze_case(self, case):
        return {"status": "completed", "model_provider": "development_deterministic", "problem_summary": case.description, "analysis_metadata": {"message": "Development fixture only; no AI analysis performed."}}


class OutcomeVerifier:
    methods = {"test_result": "test_result", "output": "output_diff", "log": "system_log", "diagnostic": "diagnostic", "after_image": "screenshot_compare"}
    preferred = ("diagnostic", "log")

    def evaluate(self, evidence_types):
        method = next((self.methods[k] for k in self.preferred if k in evidence_types), "self_report")
        # Presence is not authenticity. Client-provided evidence cannot establish verification.
        return method, Decimal("0.35") if method != "self_report" else Decimal("0.20")


class CodingIssueVerifier(OutcomeVerifier):
    preferred = ("test_result", "output", "log")


class SystemIssueVerifier(OutcomeVerifier):
    pass


class NetworkIssueVerifier(OutcomeVerifier):
    preferred = ("diagnostic", "test_result", "log")


class ApplicationIssueVerifier(OutcomeVerifier):
    preferred = ("output", "after_image", "test_result")


class ManualOutcomeVerifier(OutcomeVerifier):
    preferred = ()


def verifier_for(category):
    return {"Coding Error": CodingIssueVerifier, "Windows / OS": SystemIssueVerifier, "Network & Wi-Fi": NetworkIssueVerifier, "Apps & Productivity": ApplicationIssueVerifier}.get(category, ManualOutcomeVerifier)()


def reputation_level(points):
    return next((label for threshold, label in [(5000, "Master Contributor"), (2000, "Expert Solver"), (500, "Trusted Solver"), (100, "Contributor")] if points >= threshold), "New Solver")


async def accept_outcome(db, outcome_id: str):
    """Trusted review operation. Intentionally not exposed through a user API."""
    outcome = await db.scalar(select(Outcome).where(Outcome.id == outcome_id).with_for_update())
    if not outcome:
        raise APIError(404, "OUTCOME_NOT_FOUND", "Outcome not found.")
    if outcome.verification_status != "pending":
        return outcome
    case = await db.get(Case, outcome.case_id)
    attempt = await db.get(FixAttempt, outcome.fix_attempt_id)
    fix = await db.get(Fix, attempt.fix_id)
    target = {"resolved": "verified", "partially_resolved": "partially_verified", "not_resolved": "failed"}[outcome.reported_result]
    transition(case, target)
    outcome.verification_status = "verified" if target != "partially_verified" else "partially_verified"
    outcome.verification_confidence = Decimal("0.9")
    outcome.verification_summary = "Accepted by trusted review; Phase 3 deterministic baseline."
    outcome.verified_at = now()
    if target == "verified":
        case.resolved_at = now()
    await db.flush()
    # Aggregate trusted, final outcomes only. Partial/inconclusive excluded from the rate.
    results = (await db.execute(select(Outcome.reported_result, func.count()).join(FixAttempt, Outcome.fix_attempt_id == FixAttempt.id).where(FixAttempt.fix_id == fix.id, Outcome.verification_status.in_(["verified", "partially_verified"])).group_by(Outcome.reported_result))).all()
    counts = dict(results)
    fix.success_count = counts.get("resolved", 0)
    fix.failure_count = counts.get("not_resolved", 0)
    fix.partial_count = counts.get("partially_resolved", 0)
    sample = fix.success_count + fix.failure_count
    fix.verified_success_rate = Decimal(fix.success_count) / sample if sample >= get_settings().min_success_rate_sample else None
    if target == "verified":
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
        key = f"verified_outcome:{outcome.id}"
        await db.execute(insert(RewardLedger).values(user_id=outcome.user_id, event_type="verified_outcome", reference_type="outcome", reference_id=outcome.id, amount=8, status="claimable", reason="Trusted verified outcome", idempotency_key=key, claimable_at=now()).on_conflict_do_nothing())
        await db.execute(insert(ReputationEvent).values(user_id=outcome.user_id, event_type="verified_outcome", reference_id=outcome.id, points=20, reason="Trusted verified outcome", idempotency_key=key).on_conflict_do_nothing())
        profile = await db.scalar(select(Profile).where(Profile.id == outcome.user_id).with_for_update())
        profile.reputation_score = await db.scalar(select(func.coalesce(func.sum(ReputationEvent.points), 0)).where(ReputationEvent.user_id == profile.id))
        profile.reputation_level = reputation_level(profile.reputation_score)
        notify(db, outcome.user_id, "Reward unlocked", "8 off-chain FIX are now eligible. No blockchain transaction occurred.", "reward", "/rewards")
        audit(db, outcome.user_id, "reward_generated", "outcome", outcome.id)
    notify(db, outcome.user_id, "Outcome reviewed", f"Review completed: {target.replace('_', ' ')}.", href=f"/cases/{case.id}")
    return outcome


async def accept_contribution(db, contribution_id: str, actor_user_id: str):
    """Admin-approved contribution acceptance. Idempotent per contribution.

    Creates or attaches the fix, grants creator attribution (100%), and schedules an
    idempotent off-chain reward (`accepted_fix:{fix_id}:{user_id}`) plus reputation.
    """
    contrib = await db.scalar(select(Contribution).where(Contribution.id == contribution_id).with_for_update())
    if not contrib:
        raise APIError(404, "CONTRIBUTION_NOT_FOUND", "Contribution not found.")
    if contrib.status == "accepted":
        return contrib
    if contrib.status != "submitted":
        raise APIError(409, "CONTRIBUTION_NOT_REVIEWABLE", "Only submitted contributions can be accepted.")

    evidence_summary = contrib.evidence_summary or {}
    steps = evidence_summary.get("steps", []) if isinstance(evidence_summary.get("steps"), list) else []
    category = evidence_summary.get("category", "Apps & Productivity")
    if category not in {"Coding Error", "Windows / OS", "Network & Wi-Fi", "Hardware & Devices", "Apps & Productivity", "Performance", "Security"}:
        category = "Apps & Productivity"

    if contrib.fix_id:
        fix = await db.get(Fix, contrib.fix_id)
        if not fix:
            raise APIError(404, "FIX_NOT_FOUND", "Referenced fix no longer exists.")
    else:
        fix = Fix(
            created_by_user_id=contrib.user_id,
            title=contrib.title,
            summary=contrib.description,
            instructions=list(steps),
            category=category,
            source_type="community",
            verification_status="unverified",
        )
        db.add(fix)
        await db.flush()
        contrib.fix_id = fix.id

    contrib.status = "accepted"
    contrib.reviewed_at = now()
    await db.flush()

    attribution = AttributionService(db)
    await attribution.set_creator(fix.id, contrib.user_id, 1.0)

    _, reward_created = await grant_fix_acceptance(
        db, fix_id=fix.id, user_id=contrib.user_id, actor_user_id=actor_user_id
    )
    _, reputation_created = await grant_reputation(
        db,
        user_id=contrib.user_id,
        event_type="contribution_accepted",
        reference_id=fix.id,
        points=50,
        reason="Contribution accepted into the Puvexa knowledge graph.",
        idempotency_key=f"accepted_fix:{fix.id}:{contrib.user_id}",
        actor_user_id=actor_user_id,
    )
    audit(db, actor_user_id, "contribution_accepted", "contribution", contrib.id)

    if reward_created:
        notify(db, contrib.user_id, "Contribution accepted", "Your fix is live in the graph and a reward is now claimable.", "reward", "/rewards")
    else:
        notify(db, contrib.user_id, "Contribution accepted", "Your fix is live in the graph.", href="/leaderboard")
    return contrib


async def reject_contribution(db, contribution_id: str, actor_user_id: str):
    """Admin-approved contribution rejection. Idempotent per contribution."""
    contrib = await db.scalar(select(Contribution).where(Contribution.id == contribution_id).with_for_update())
    if not contrib:
        raise APIError(404, "CONTRIBUTION_NOT_FOUND", "Contribution not found.")
    if contrib.status == "rejected":
        return contrib
    if contrib.status != "submitted":
        raise APIError(409, "CONTRIBUTION_NOT_REVIEWABLE", "Only submitted contributions can be rejected.")
    contrib.status = "rejected"
    contrib.reviewed_at = now()
    await db.flush()
    audit(db, actor_user_id, "contribution_rejected", "contribution", contrib.id)
    notify(db, contrib.user_id, "Contribution not accepted", "Reviewers did not accept your submission.", "/leaderboard")
    return contrib


class Web3RewardProvider(Protocol):
    async def verify_wallet(self, payload): ...
    async def prepare_claim(self, payload): ...
    async def record_claim(self, payload): ...
    async def stake(self, payload): ...
    async def settle_royalty(self, payload): ...


class OffChainRewardProvider:
    async def prepare_claim(self, payload):
        raise APIError(409, "WEB3_UNAVAILABLE", "Web3 claiming will be enabled after wallet verification and smart contract deployment.")


OBSERVATION_WINDOW = timedelta(hours=24)
