import secrets
from datetime import timedelta
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, inspect, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_optional_user
from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.base import now
from app.db.models import (
    AccountDeletionRequest,
    AIRun,
    CampusAmbassadorApplication,
    Case,
    CaseEvidence,
    CaseFixRecommendation,
    ClaimReservation,
    Contribution,
    DiagnosisRun,
    DiagnosisSource,
    Fix,
    FixAttempt,
    KnowledgeChunk,
    KnowledgeDocument,
    Notification,
    Outcome,
    Profile,
    ReputationEvent,
    RewardLedger,
    UserSettings,
    WalletLink,
    Web3Transaction,
)
from app.db.session import get_db
from app.schemas.requests import (
    AttemptCreate,
    AttemptPatch,
    AttrCreate,
    CampusAmbassadorApplicationCreate,
    CampusAmbassadorApplicationPatch,
    CaseCreate,
    CasePatch,
    ClaimConfirmCreate,
    ClaimSignCreate,
    ContributionCreate,
    ContributionPatch,
    DeleteAccountRequest,
    EvidenceType,
    OutcomeCreate,
    ProfilePatch,
    SettingsPatch,
    WalletChallengeCreate,
    WalletVerifyCreate,
    Web3ClaimConfirmCreate,
    Web3ClaimPrepareCreate,
    Web3StakeCreate,
    Web3StakeSettleCreate,
)
from app.services.ai.orchestrator import PuvexaIntelligenceService
from app.services.ai.provider import get_ai_provider
from app.services.attribution import AttributionService
from app.services.claims import ClaimReservationService
from app.services.storage import get_storage, read_upload
from app.services.verification.anti_abuse import ContributionAntiAbuseEngine
from app.services.verification.learning import OutcomeLearningEngine
from app.services.wallet import WalletVerificationService
from app.services.web3_economy import Web3ConfigError, Web3EconomyService
from app.services.workflows import (
    OBSERVATION_WINDOW,
    DevelopmentDeterministicProvider,
    UnconfiguredAIProvider,
    accept_contribution,
    audit,
    notify,
    reject_contribution,
    transition,
    verifier_for,
)

router = APIRouter(prefix="/api/v1")
DB = Annotated[AsyncSession, Depends(get_db)]
User = Annotated[Profile, Depends(get_current_user)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


def serialize(obj):
    return jsonable_encoder({c.key: getattr(obj, c.key) for c in inspect(obj).mapper.column_attrs})


def serialize_ambassador(row):
    """Public shape for a campus ambassador application (camelCase, no internal fields)."""
    return {
        "id": row.id,
        "applicationId": row.application_id,
        "fullName": row.full_name,
        "email": row.email,
        "status": row.status,
        "submittedAt": row.submitted_at.isoformat() if row.submitted_at else None,
        "lookupToken": row.lookup_token,
    }


async def owned(db, model, identifier, user_id):
    row = await db.scalar(select(model).where(model.id == str(identifier), model.user_id == user_id))
    if row is None:
        raise APIError(404, "NOT_FOUND", "Record not found.")
    return row


async def paginate(db, query, page=1, page_size=20):
    total = await db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = (await db.scalars(query.offset((page - 1) * page_size).limit(page_size))).all()
    return {"items": [serialize(x) for x in items], "page": page, "page_size": page_size, "total": total, "has_more": page * page_size < total}


def patch(row, payload):
    for key, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(row, key, value)


@router.get("/auth/me")
@router.get("/profile")
async def profile(user: User):
    return serialize(user)


@router.patch("/profile")
async def update_profile(body: ProfilePatch, db: DB, user: User):
    patch(user, body)
    await db.flush()
    return serialize(user)


@router.get("/profile/stats")
async def profile_stats(db: DB, user: User):
    counts = dict((await db.execute(select(Case.status, func.count()).where(Case.user_id == user.id).group_by(Case.status))).all())
    contributions = await db.scalar(select(func.count()).select_from(Contribution).where(Contribution.user_id == user.id, Contribution.status == "accepted"))
    return {"total_cases": sum(counts.values()), "resolved_count": counts.get("verified", 0), "active_cases": sum(v for k, v in counts.items() if k not in ("verified", "failed", "partially_verified")), "verified_contributions": contributions, "reputation": user.reputation_score}


@router.post("/cases", status_code=201)
async def create_case(body: CaseCreate, db: DB, user: User):
    row = Case(user_id=user.id, **body.model_dump())
    db.add(row)
    await db.flush()
    notify(db, user.id, "Case created", row.title, href=f"/cases/{row.id}")
    audit(db, user.id, "case_created", "case", row.id)
    return serialize(row)


@router.get("/cases")
async def list_cases(db: DB, user: User, page: Page = 1, page_size: PageSize = 20, status: str | None = None, category: str | None = None, search: Annotated[str, Query(max_length=200)] = "", sort: Literal["newest", "oldest", "updated"] = "newest"):
    query = select(Case).where(Case.user_id == user.id)
    if status:
        query = query.where(Case.status == status)
    if category:
        query = query.where(Case.category == category)
    if search:
        query = query.where(Case.title.icontains(search, autoescape=True) | Case.description.icontains(search, autoescape=True))
    order = {"newest": Case.created_at.desc(), "oldest": Case.created_at.asc(), "updated": Case.updated_at.desc()}[sort]
    return await paginate(db, query.order_by(order, Case.id), page, page_size)


@router.get("/cases/{case_id}")
async def case_detail(case_id: UUID, db: DB, user: User):
    row = await owned(db, Case, case_id, user.id)
    result = serialize(row)
    for key, model in [("evidence", CaseEvidence), ("diagnoses", DiagnosisRun), ("attempts", FixAttempt), ("outcomes", Outcome)]:
        result[key] = (await paginate(db, select(model).where(model.case_id == row.id).order_by(model.created_at.desc()), page_size=100))["items"]
    result["recommendations"] = await recommendations(case_id, db, user)
    result["sources"] = await diagnosis_sources(UUID(row.current_diagnosis_id), db, user) if row.current_diagnosis_id else []
    outcome_ids = select(Outcome.id).where(Outcome.case_id == row.id)
    result["rewards"] = (await paginate(db, select(RewardLedger).where(RewardLedger.user_id == user.id, RewardLedger.reference_id.in_(outcome_ids)), page_size=100))["items"]
    return result


@router.patch("/cases/{case_id}")
async def update_case(case_id: UUID, body: CasePatch, db: DB, user: User):
    row = await owned(db, Case, case_id, user.id)
    if body.status:
        transition(row, body.status)
    values = body.model_copy(update={"status": None})
    patch(row, values)
    await db.flush()
    return serialize(row)


@router.delete("/cases/{case_id}")
async def delete_case(case_id: UUID, db: DB, user: User, storage=Depends(get_storage)):
    row = await owned(db, Case, case_id, user.id)
    paths = (await db.scalars(select(CaseEvidence.file_path).where(CaseEvidence.case_id == row.id, CaseEvidence.file_path.is_not(None)))).all()
    await storage.delete(list(paths))
    await db.delete(row)
    audit(db, user.id, "case_deleted", "case", str(case_id))
    return {"deleted": True}


async def attach_evidence(case_id, db, user, evidence_type, text_content, file, storage, outcome_id=None):
    case = await owned(db, Case, case_id, user.id)
    if text_content and len(text_content) > get_settings().ai_max_evidence_chars:
        raise APIError(413, "EVIDENCE_TOO_LARGE", "Evidence text exceeds the configured size limit.")
    if not file and not text_content:
        raise APIError(422, "EMPTY_EVIDENCE", "Attach a file or paste evidence text.")
    row = CaseEvidence(case_id=case.id, user_id=user.id, evidence_type=evidence_type, text_content=text_content, outcome_id=outcome_id)
    if file:
        name, extension, content = await read_upload(file)
        row.file_path = await storage.upload(user.id, case.id, extension, content, file.content_type)
        row.original_filename, row.mime_type, row.size_bytes = name, file.content_type, len(content)
    db.add(row)
    await db.flush()
    audit(db, user.id, "evidence_uploaded", "evidence", row.id)
    return serialize(row)


@router.post("/cases/{case_id}/evidence", status_code=201)
async def upload_evidence(case_id: UUID, db: DB, user: User, evidence_type: Annotated[EvidenceType, Form()], text_content: Annotated[str | None, Form(max_length=100000)] = None, file: UploadFile | None = File(None), storage=Depends(get_storage)):
    return await attach_evidence(case_id, db, user, evidence_type, text_content, file, storage)


@router.get("/cases/{case_id}/evidence")
async def evidence_list(case_id: UUID, db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    await owned(db, Case, case_id, user.id)
    return await paginate(db, select(CaseEvidence).where(CaseEvidence.case_id == str(case_id)).order_by(CaseEvidence.created_at.desc()), page, page_size)


@router.get("/evidence/{evidence_id}/download")
async def download_evidence(evidence_id: UUID, db: DB, user: User, storage=Depends(get_storage)):
    row = await owned(db, CaseEvidence, evidence_id, user.id)
    if row.file_path:
        return {"url": await storage.signed_url(row.file_path), "expires_in": 60}
    return {"text_content": row.text_content}


@router.delete("/evidence/{evidence_id}")
async def delete_evidence(evidence_id: UUID, db: DB, user: User, storage=Depends(get_storage)):
    row = await owned(db, CaseEvidence, evidence_id, user.id)
    await storage.delete([row.file_path] if row.file_path else [])
    await db.delete(row)
    return {"deleted": True}


@router.post("/cases/{case_id}/diagnose", status_code=201)
async def diagnose(case_id: UUID, db: DB, user: User, background_tasks: BackgroundTasks):
    case = await owned(db, Case, case_id, user.id)
    used = await db.scalar(select(func.count()).select_from(DiagnosisRun).where(
        DiagnosisRun.user_id == user.id, DiagnosisRun.created_at >= now() - timedelta(days=1)))
    if used >= get_settings().ai_rate_limit_per_day:
        raise APIError(429, "AI_PROVIDER_RATE_LIMIT", "Daily diagnosis limit reached. Please retry later.")
    previous = await db.get(DiagnosisRun, case.current_diagnosis_id) if case.current_diagnosis_id else None
    if case.status == "needs_review" and previous and previous.status in ("failed", "unavailable"):
        case.status = "analyzing"
    else:
        transition(case, "analyzing")
    settings = get_settings()

    is_unconfigured = (
        settings.ai_provider == "unconfigured"
        or (settings.ai_provider == "openai" and not settings.ai_api_key)
        or (settings.ai_provider == "gemini" and not settings.gemini_api_key)
    )
    is_development = settings.app_env == "development" and settings.ai_provider == "development_deterministic"

    # Deterministic and unconfigured providers resolve synchronously for demo continuity.
    if is_unconfigured or is_development:
        provider = DevelopmentDeterministicProvider() if is_development else UnconfiguredAIProvider()
        output = await provider.analyze_case(case)
        row = DiagnosisRun(
            case_id=case.id,
            user_id=user.id,
            input_snapshot={"title": case.title, "description": case.description, "environment": case.environment},
            completed_at=now(),
            **output,
        )
        db.add(row)
        await db.flush()
        case.current_diagnosis_id = row.id
        transition(case, "needs_review")
        notify(db, user.id, "Diagnosis request saved", output["analysis_metadata"]["message"], href=f"/cases/{case.id}")
        return serialize(row)

    # Real or Mock AI pipeline: persist a pending run, then execute in background so
    # clients can poll GET /diagnoses/{id}/status for live stage progress.
    row = DiagnosisRun(
        case_id=case.id,
        user_id=user.id,
        input_snapshot={"title": case.title, "description": case.description, "environment": case.environment},
        status="pending",
        analysis_metadata={"stage": "RECEIVED", "stage_percent": 5, "stage_message": "Diagnosis initialized"},
    )
    db.add(row)
    await db.flush()
    case.current_diagnosis_id = row.id
    await db.commit()
    background_tasks.add_task(run_diagnosis_in_background, str(row.id), str(case.id), user.id)
    return serialize(row)


async def run_diagnosis_in_background(diagnosis_run_id: str, case_id: str, user_id: str):
    """Executes the full AI diagnosis pipeline after the request returns.

    Uses a fresh session because the request-scoped dependency session is closed
    once the response is sent. Stage progress is committed per-stage by the
    orchestrator, enabling status polling from other sessions.
    """
    from app.db.session import Session

    async with Session() as db:
        case = await db.get(Case, case_id)
        run = await db.get(DiagnosisRun, diagnosis_run_id)
        if case is None or run is None:
            return
        orchestrator = PuvexaIntelligenceService(db, get_ai_provider(get_settings()))
        await orchestrator.run_diagnosis_pipeline(case, run)
        if run.status in ("completed", "failed", "unavailable"):
            state = "completed" if run.status == "completed" else "updated"
            notify(
                db,
                user_id,
                f"Diagnosis {state}",
                run.problem_summary or "Review recommendations.",
                href=f"/cases/{case_id}",
            )
            audit(db, user_id, "case_diagnosed", "diagnosis", run.id)
            await db.commit()


@router.get("/cases/{case_id}/diagnoses")
async def diagnoses(case_id: UUID, db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    await owned(db, Case, case_id, user.id)
    return await paginate(db, select(DiagnosisRun).where(DiagnosisRun.case_id == str(case_id)).order_by(DiagnosisRun.created_at.desc()), page, page_size)


@router.get("/diagnoses/{diagnosis_id}")
async def diagnosis(diagnosis_id: UUID, db: DB, user: User):
    return serialize(await owned(db, DiagnosisRun, diagnosis_id, user.id))


@router.get("/diagnoses/{diagnosis_id}/status")
async def diagnosis_status(diagnosis_id: UUID, db: DB, user: User):
    run = await owned(db, DiagnosisRun, diagnosis_id, user.id)
    meta = run.analysis_metadata or {}
    stage = meta.get("stage", "COMPLETED" if run.status == "completed" else "FAILED" if run.status == "failed" else "UNKNOWN")
    percent = meta.get("stage_percent", 100 if run.status == "completed" else 0)
    message = meta.get("stage_message", meta.get("message", "Processing diagnosis"))
    return {
        "id": run.id,
        "case_id": run.case_id,
        "status": run.status,
        "stage": stage,
        "stage_message": message,
        "stage_percent": percent,
        "completed_at": run.completed_at,
        "confidence": float(run.confidence) if run.confidence else None,
        "error": {"code": meta.get("code"), "message": meta.get("message")} if run.status in ("failed", "unavailable") else None,
    }


@router.get("/diagnoses/{diagnosis_id}/recommendations")
async def diagnosis_recommendations(diagnosis_id: UUID, db: DB, user: User):
    await owned(db, DiagnosisRun, diagnosis_id, user.id)
    rows = (await db.execute(
        select(CaseFixRecommendation, Fix)
        .join(Fix, Fix.id == CaseFixRecommendation.fix_id)
        .where(CaseFixRecommendation.diagnosis_run_id == str(diagnosis_id))
        .order_by(CaseFixRecommendation.rank)
        .limit(100)
    )).all()
    min_sample = get_settings().min_success_rate_sample
    results = []
    for rec, fix in rows:
        sample = fix.success_count + fix.failure_count
        stat_status = (
            f"{int(float(fix.verified_success_rate) * 100)}% verified success across {sample} outcomes"
            if (fix.verified_success_rate is not None and sample >= min_sample)
            else "Not enough verified outcomes yet"
        )
        trust_label = (
            "Outcome-Backed Fix" if (fix.verified_success_rate is not None and sample >= min_sample)
            else "Official Guidance" if fix.source_type == "official_doc"
            else "Curated Fix" if fix.source_type == "curated"
            else "AI Suggestion"
        )
        results.append({
            **serialize(rec),
            "fix": serialize(fix),
            "sample_size": sample,
            "min_success_rate_sample": min_sample,
            "statistical_status": stat_status,
            "trust_label": trust_label,
            "why_it_matches": rec.explanation or fix.summary,
        })
    return results


@router.get("/diagnoses/{diagnosis_id}/sources")
async def diagnosis_sources(diagnosis_id: UUID, db: DB, user: User):
    await owned(db, DiagnosisRun, diagnosis_id, user.id)
    sources = (await db.scalars(
        select(DiagnosisSource)
        .where(DiagnosisSource.diagnosis_id == str(diagnosis_id))
        .order_by(DiagnosisSource.relevance_score.desc().nullslast())
    )).all()
    results = []
    for source in sources:
        # Publish only curated document provenance, never raw outcome context or evidence.
        item = {"id": source.id, "source_type": source.source_type,
                "relevance_score": float(source.relevance_score) if source.relevance_score is not None else None,
                "usage_type": source.usage_type}
        if source.source_type == "knowledge_chunk":
            document = await db.scalar(select(KnowledgeDocument).join(KnowledgeChunk).where(KnowledgeChunk.id == source.source_id))
            if document:
                item.update(title=document.title, source_url=document.source_url)
        else:
            item["title"] = "Verified Outcome Pattern"
        results.append(item)
    return results


@router.get("/cases/{case_id}/recommendations")
async def recommendations(case_id: UUID, db: DB, user: User):
    await owned(db, Case, case_id, user.id)
    rows = (await db.execute(select(CaseFixRecommendation, Fix).join(Fix, Fix.id == CaseFixRecommendation.fix_id).where(CaseFixRecommendation.case_id == str(case_id)).order_by(CaseFixRecommendation.rank).limit(100))).all()
    min_sample = get_settings().min_success_rate_sample
    results = []
    for rec, fix in rows:
        sample = fix.success_count + fix.failure_count
        stat_status = (
            f"{int(float(fix.verified_success_rate) * 100)}% verified success across {sample} outcomes"
            if (fix.verified_success_rate is not None and sample >= min_sample)
            else "Not enough verified outcomes yet"
        )
        trust_label = (
            "Outcome-Backed Fix" if (fix.verified_success_rate is not None and sample >= min_sample)
            else "Official Guidance" if fix.source_type == "official_doc"
            else "Curated Fix" if fix.source_type == "curated"
            else "AI Suggestion"
        )
        results.append({
            **serialize(rec),
            "fix": serialize(fix),
            "sample_size": sample,
            "min_success_rate_sample": min_sample,
            "statistical_status": stat_status,
            "trust_label": trust_label,
            "why_it_matches": rec.explanation or fix.summary,
        })
    return results



@router.get("/fixes/{fix_id}")
async def get_fix(fix_id: UUID, db: DB, user: User):
    row = await db.get(Fix, str(fix_id))
    if not row or (row.source_type != "curated" and row.created_by_user_id != user.id and row.verification_status != "verified"):
        raise APIError(404, "NOT_FOUND", "Fix not found.")
    return serialize(row)


@router.post("/cases/{case_id}/attempts", status_code=201)
async def start_attempt(case_id: UUID, body: AttemptCreate, db: DB, user: User):
    case = await owned(db, Case, case_id, user.id)
    rec = await db.scalar(select(CaseFixRecommendation).where(CaseFixRecommendation.case_id == case.id, CaseFixRecommendation.fix_id == str(body.fix_id)))
    if rec is None:
        raise APIError(422, "FIX_NOT_RECOMMENDED", "Choose a fix recommended for this case.")
    transition(case, "applied")
    row = FixAttempt(case_id=case.id, fix_id=str(body.fix_id), user_id=user.id)
    db.add(row)
    await db.flush()
    audit(db, user.id, "fix_attempt_started", "attempt", row.id)
    return serialize(row)


@router.patch("/attempts/{attempt_id}")
async def update_attempt(attempt_id: UUID, body: AttemptPatch, db: DB, user: User):
    row = await owned(db, FixAttempt, attempt_id, user.id)
    if row.status != "started":
        raise APIError(409, "ATTEMPT_COMPLETE", "This attempt is already complete.")
    patch(row, body)
    await db.flush()
    return serialize(row)


@router.post("/attempts/{attempt_id}/outcomes", status_code=201)
async def submit_outcome(attempt_id: UUID, body: OutcomeCreate, db: DB, user: User):
    attempt = await owned(db, FixAttempt, attempt_id, user.id)
    existing = await db.scalar(select(Outcome).where(Outcome.fix_attempt_id == attempt.id))
    if existing:
        if existing.reported_result != body.reported_result:
            raise APIError(409, "OUTCOME_EXISTS", "An outcome has already been submitted for this attempt.")
        return serialize(existing)
    case = await owned(db, Case, attempt.case_id, user.id)
    transition(case, "monitoring")
    types = (await db.scalars(select(CaseEvidence.evidence_type).where(CaseEvidence.case_id == case.id))).all()
    if body.before_data and body.after_data:
        types = [*types, "output"]
    method, confidence = verifier_for(case.category).evaluate(types)
    row = Outcome(case_id=case.id, fix_attempt_id=attempt.id, user_id=user.id, verification_method=method, verification_confidence=confidence, observation_started_at=now(), observation_ends_at=now() + OBSERVATION_WINDOW, verification_summary="Evidence received. Trusted verification is pending; no AI assessment has occurred.", **body.model_dump())
    db.add(row)
    attempt.status, attempt.completed_at, attempt.user_reported_result = "completed", now(), body.reported_result
    await db.flush()
    notify(db, user.id, "Verification pending", "Your outcome was saved for review.", href=f"/cases/{case.id}")
    audit(db, user.id, "outcome_submitted", "outcome", row.id)
    return serialize(row)


@router.post("/attempts/{attempt_id}/verify", status_code=200)
async def verify_attempt(attempt_id: UUID, db: DB, user: User):
    attempt = await owned(db, FixAttempt, attempt_id, user.id)
    outcome_row = await db.scalar(select(Outcome).where(Outcome.fix_attempt_id == attempt.id))
    if not outcome_row:
        raise APIError(422, "NO_OUTCOME_SUBMITTED", "Submit an outcome before requesting verification.")

    types = list((await db.scalars(select(CaseEvidence.evidence_type).where(CaseEvidence.case_id == attempt.case_id))).all())
    if outcome_row.before_data and outcome_row.after_data:
        types.append("output")

    learning_engine = OutcomeLearningEngine(db)
    assessment = await learning_engine.verify_and_learn(outcome_row, types)
    audit(db, user.id, "attempt_verified", "outcome", outcome_row.id)
    return {
        "outcome": serialize(outcome_row),
        "assessment": {
            "status": assessment.status,
            "confidence": float(assessment.confidence),
            "method": assessment.method,
            "strength": assessment.strength,
            "summary": assessment.summary,
        },
    }


@router.get("/cases/{case_id}/outcomes")
async def outcomes(case_id: UUID, db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    await owned(db, Case, case_id, user.id)
    return await paginate(db, select(Outcome).where(Outcome.case_id == str(case_id)).order_by(Outcome.created_at.desc()), page, page_size)


@router.get("/outcomes/{outcome_id}")
async def outcome(outcome_id: UUID, db: DB, user: User):
    return serialize(await owned(db, Outcome, outcome_id, user.id))


@router.get("/outcomes/{outcome_id}/verification")
async def outcome_verification(outcome_id: UUID, db: DB, user: User):
    outcome_row = await owned(db, Outcome, outcome_id, user.id)
    return {
        "outcome_id": outcome_row.id,
        "case_id": outcome_row.case_id,
        "verification_status": outcome_row.verification_status,
        "verification_method": outcome_row.verification_method,
        "verification_confidence": float(outcome_row.verification_confidence) if outcome_row.verification_confidence else 0.0,
        "verification_summary": outcome_row.verification_summary,
        "verified_at": outcome_row.verified_at,
        "observation_started_at": outcome_row.observation_started_at,
        "observation_ends_at": outcome_row.observation_ends_at,
    }


@router.post("/outcomes/{outcome_id}/evidence", status_code=201)
async def outcome_evidence(outcome_id: UUID, db: DB, user: User, evidence_type: Annotated[EvidenceType, Form()], text_content: Annotated[str | None, Form(max_length=100000)] = None, file: UploadFile | None = File(None), storage=Depends(get_storage)):
    row = await owned(db, Outcome, outcome_id, user.id)
    if row.verification_status != "pending":
        raise APIError(409, "REVIEW_COMPLETE", "Reviewed evidence cannot be changed.")
    result = await attach_evidence(row.case_id, db, user, evidence_type, text_content, file, storage, row.id)
    case = await db.get(Case, row.case_id)
    types = (await db.scalars(select(CaseEvidence.evidence_type).where(CaseEvidence.outcome_id == row.id))).all()
    row.verification_method, row.verification_confidence = verifier_for(case.category).evaluate(types)
    return result



@router.post("/contributions", status_code=201)
async def submit_contribution(body: ContributionCreate, db: DB, user: User):
    if body.case_id:
        await owned(db, Case, body.case_id, user.id)
    if body.fix_id:
        await get_fix(body.fix_id, db, user)
    values = body.model_dump(mode="json")
    row = Contribution(user_id=user.id, **values)
    db.add(row)
    await db.flush()
    audit(db, user.id, "contribution_submitted", "contribution", row.id)
    notify(db, user.id, "Contribution submitted", "Your submission is pending review. Rewards require acceptance.", href="/contribute")
    return serialize(row)


@router.get("/contributions/tasks")
async def contribution_tasks(user: User):
    return {"items": [], "page": 1, "page_size": 20, "total": 0, "has_more": False}


@router.get("/contributions")
@router.get("/profile/contributions")
async def contributions(db: DB, user: User, page: Page = 1, page_size: PageSize = 20, status: str | None = None):
    query = select(Contribution).where(Contribution.user_id == user.id)
    if status:
        query = query.where(Contribution.status == status)
    return await paginate(db, query.order_by(Contribution.created_at.desc()), page, page_size)


@router.get("/contributions/{contribution_id}")
async def contribution(contribution_id: UUID, db: DB, user: User):
    return serialize(await owned(db, Contribution, contribution_id, user.id))


@router.patch("/contributions/{contribution_id}")
async def update_contribution(contribution_id: UUID, body: ContributionPatch, db: DB, user: User):
    row = await owned(db, Contribution, contribution_id, user.id)
    if row.status not in ("draft", "submitted"):
        raise APIError(409, "REVIEW_STARTED", "This contribution is already being reviewed.")
    patch(row, body)
    await db.flush()
    return serialize(row)


@router.post("/contributions/{contribution_id}/analyze", status_code=200)
async def analyze_contribution_endpoint(contribution_id: UUID, db: DB, user: User):
    contrib = await owned(db, Contribution, contribution_id, user.id)
    used = await db.scalar(select(func.count()).select_from(AIRun).where(
        AIRun.user_id == user.id, AIRun.task_type == "contribution_analysis",
        AIRun.created_at >= now() - timedelta(days=1)))
    if used >= get_settings().contribution_review_rate_limit_per_day:
        raise APIError(429, "AI_PROVIDER_RATE_LIMIT", "Daily contribution analysis limit reached. Please retry later.")
    steps = contrib.evidence_summary.get("steps", []) if isinstance(contrib.evidence_summary, dict) else []
    category = contrib.evidence_summary.get("category", "Apps & Productivity") if isinstance(contrib.evidence_summary, dict) else "Apps & Productivity"

    engine = ContributionAntiAbuseEngine(db)
    analysis = await engine.analyze_contribution(
        user_id=user.id,
        title=contrib.title,
        description=contrib.description,
        steps=steps,
        category=category,
        exclude_id=contrib.id,
    )
    contrib.novelty_score = Decimal(str(analysis.novelty))
    contrib.quality_score = Decimal(str(analysis.evidence_quality))
    contrib.utility_score = Decimal(str(analysis.utility))
    meta = dict(contrib.evidence_summary or {})
    meta["ai_analysis"] = analysis.model_dump()
    contrib.evidence_summary = meta
    db.add(AIRun(
        user_id=user.id,
        case_id=None,
        task_type="contribution_analysis",
        provider=get_settings().ai_provider,
        model=get_settings().ai_model,
        prompt_version="contrib_v1",
        status="completed",
    ))
    await db.flush()
    audit(db, user.id, "contribution_analyzed", "contribution", contrib.id)
    return {"contribution_id": contrib.id, "analysis": analysis.model_dump()}


@router.get("/contributions/{contribution_id}/analysis")
async def get_contribution_analysis(contribution_id: UUID, db: DB, user: User):
    contrib = await owned(db, Contribution, contribution_id, user.id)
    analysis = contrib.evidence_summary.get("ai_analysis") if isinstance(contrib.evidence_summary, dict) else None
    if not analysis:
        return await analyze_contribution_endpoint(contribution_id, db, user)
    return {"contribution_id": contrib.id, "analysis": analysis}



@router.get("/rewards/summary")
async def reward_summary(db: DB, user: User):
    rows = (await db.execute(select(RewardLedger.status, func.sum(RewardLedger.amount)).where(RewardLedger.user_id == user.id).group_by(RewardLedger.status))).all()
    totals = {k: float(v) for k, v in rows}
    royalty = await db.scalar(select(func.coalesce(func.sum(RewardLedger.amount), 0)).where(RewardLedger.user_id == user.id, RewardLedger.event_type == "royalty", RewardLedger.status.notin_(["cancelled", "pending"])))
    return {"balance": totals.get("claimed_offchain", 0), "pending": totals.get("pending", 0), "claimable": totals.get("claimable", 0), "lifetime_earned": sum(v for k, v in totals.items() if k not in ("cancelled", "pending")), "royalty_earned": float(royalty), "staked_or_reserved": totals.get("reserved_for_web3", 0)}


@router.get("/rewards/history")
async def rewards(db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    return await paginate(db, select(RewardLedger).where(RewardLedger.user_id == user.id).order_by(RewardLedger.created_at.desc()), page, page_size)


@router.get("/rewards/claimable")
async def claimable_rewards(db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    return await paginate(db, select(RewardLedger).where(RewardLedger.user_id == user.id, RewardLedger.status == "claimable").order_by(RewardLedger.created_at.desc()), page, page_size)


# ---- Phase 4.5: wallet verification (one-time nonce challenges) ----

def wallet_verification_service(db):
    """Builds the wallet service with the configured signature verifier.

    The default is "none": signatures are refused until an operator opts in to a
    concrete verifier via the `wallet_signature_verifier` setting (e.g. "eip191").
    This keeps the safety invariant that signatures are never accepted without
    cryptographic confirmation.
    """
    from app.services.wallet import EIP191SignatureVerifier

    verifier = None
    if get_settings().wallet_signature_verifier == "eip191":
        verifier = EIP191SignatureVerifier()
    return WalletVerificationService(db, verifier=verifier)


@router.post("/wallet/challenge", status_code=201)
async def wallet_challenge(body: WalletChallengeCreate, db: DB, user: User):
    service = wallet_verification_service(db)
    return await service.create_challenge(user.id, body.address, body.chain_id)


@router.post("/wallet/verify")
async def wallet_verify(body: WalletVerifyCreate, db: DB, user: User):
    service = wallet_verification_service(db)
    return await service.verify(user.id, body.address, body.signature, body.chain_id, body.nonce)


@router.post("/wallet/{wallet_id}/revoke")
async def wallet_revoke(wallet_id: UUID, db: DB, user: User):
    link = await owned(db, WalletLink, wallet_id, user.id)
    link.status = "revoked"
    link.nonce = None
    link.nonce_expires_at = None
    link.nonce_used_at = None
    await db.flush()
    audit(db, user.id, "wallet_link_revoked", "wallet", link.id)
    return serialize(link)


# ---- Phase 4.5: knowledge attribution (ownership <= 100%) ----

@router.post("/attributions", status_code=201)
async def create_attribution(body: AttrCreate, db: DB, user: User):
    service = AttributionService(db)
    if body.attribution_type == "creator":
        return serialize(await service.set_creator(body.fix_id, user.id, body.share))
    return serialize(await service.add_contribution_share(body.fix_id, user.id, body.share, body.attribution_type, body.version, user.id))


@router.get("/attributions/{fix_id}")
async def list_attributions(fix_id: UUID, db: DB, user: User, version: int = 1):
    service = AttributionService(db)
    rows = await service.list_for_fix(str(fix_id), version)
    return {"items": [serialize(r) for r in rows], "total": len(rows), "remaining_share": float(await service.remaining_share(str(fix_id), version))}


# ---- Phase 4.5: future claim reservations (state machine) ----

@router.post("/rewards/{reward_id}/claim-reservation", status_code=201)
async def reserve_future_claim(reward_id: UUID, db: DB, user: User):
    service = ClaimReservationService(db)
    claim = await service.reserve(str(reward_id), user.id)
    return serialize(claim)


@router.post("/claim-reservations/{claim_id}/sign")
async def sign_claim(claim_id: UUID, body: ClaimSignCreate, db: DB, user: User):
    service = ClaimReservationService(db)
    return serialize(await service.record_signed(str(claim_id), user.id, body.signed_payload_hash))


@router.post("/claim-reservations/{claim_id}/submit")
async def submit_claim(claim_id: UUID, db: DB, user: User, chain_id: int | None = Query(default=None, ge=1)):
    service = ClaimReservationService(db)
    return serialize(await service.submit(str(claim_id), user.id, chain_id))


@router.post("/claim-reservations/{claim_id}/confirm")
async def confirm_claim(claim_id: UUID, body: ClaimConfirmCreate, db: DB, user: User):
    if not get_settings().web3_claim_enabled:
        raise APIError(409, "WEB3_UNAVAILABLE", "On-chain claim confirmation is not enabled yet.")
    service = ClaimReservationService(db)
    return serialize(await service.confirm(str(claim_id), user.id, body.chain_id, body.tx_hash))


@router.post("/claim-reservations/{claim_id}/release")
async def release_claim(claim_id: UUID, db: DB, user: User):
    service = ClaimReservationService(db)
    return serialize(await service.release(str(claim_id), user.id))


@router.post("/claim-reservations/{claim_id}/fail")
async def fail_claim(claim_id: UUID, db: DB, user: User):
    service = ClaimReservationService(db)
    return serialize(await service.fail(str(claim_id), user.id))


@router.post("/claim-reservations/{claim_id}/retry")
async def retry_claim(claim_id: UUID, db: DB, user: User):
    service = ClaimReservationService(db)
    return serialize(await service.reserve_after_failure(str(claim_id), user.id))


@router.get("/claim-reservations")
async def list_claims(db: DB, user: User, page: Page = 1, page_size: PageSize = 20, state: str | None = None):
    query = select(ClaimReservation).where(ClaimReservation.user_id == user.id)
    if state:
        query = query.where(ClaimReservation.state == state)
    return await paginate(db, query.order_by(ClaimReservation.created_at.desc()), page, page_size)


# ---- Phase 5: web3 economy (EIP-712 claims, stakes, transactions) ----


@router.get("/web3/status")
async def web3_status(db: DB, user: User):
    return await Web3EconomyService(db).status()


@router.post("/web3/claims/prepare", status_code=201)
async def web3_claim_prepare(body: Web3ClaimPrepareCreate, db: DB, user: User):
    service = Web3EconomyService(db)
    try:
        return await service.prepare_claim(
            reward_id=str(body.reward_id),
            user_id=user.id,
            wallet_address=body.wallet_address,
            chain_id=body.chain_id,
        )
    except Web3ConfigError as exc:
        raise exc


@router.post("/web3/claims/confirm")
async def web3_claim_confirm(body: Web3ClaimConfirmCreate, db: DB, user: User):
    service = Web3EconomyService(db)
    return await service.confirm_claim(
        claim_id=body.claim_id,
        user_id=user.id,
        tx_hash=body.tx_hash,
        chain_id=body.chain_id,
    )


@router.get("/web3/claims")
async def web3_list_claims(db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    query = select(ClaimReservation).where(
        ClaimReservation.user_id == user.id,
        ClaimReservation.claim_id.is_not(None),
    )
    return await paginate(db, query.order_by(ClaimReservation.created_at.desc()), page, page_size)


@router.get("/web3/claims/{claim_id}")
async def web3_get_claim(claim_id: str, db: DB, user: User):
    if not claim_id.startswith("0x") or len(claim_id) != 66:
        raise APIError(422, "INVALID_CLAIM_ID", "Claim id must be a 32-byte hex string.")
    claim = await db.scalar(
        select(ClaimReservation).where(
            ClaimReservation.claim_id == claim_id.lower(),
            ClaimReservation.user_id == user.id,
        )
    )
    if claim is None:
        raise APIError(404, "CLAIM_NOT_FOUND", "Claim not found.")
    return serialize(claim)


@router.post("/web3/stakes/confirm")
async def web3_stake_confirm(body: Web3StakeCreate, db: DB, user: User):
    service = Web3EconomyService(db)
    return await service.record_stake(
        contribution_id=body.contribution_id,
        user_id=user.id,
        wallet_address=body.wallet_address,
        tx_hash=body.tx_hash,
        chain_id=body.chain_id,
    )


@router.post("/web3/stakes/{contribution_id}/release")
async def web3_stake_release(contribution_id: str, body: Web3StakeSettleCreate, db: DB, user: User):
    service = Web3EconomyService(db)
    return await service.confirm_stake_settlement(
        contribution_id=contribution_id,
        user_id=user.id,
        tx_hash=body.tx_hash,
        kind="release",
        chain_id=body.chain_id,
    )


@router.post("/web3/stakes/{contribution_id}/slash")
async def web3_stake_slash(contribution_id: str, body: Web3StakeSettleCreate, db: DB, user: User):
    service = Web3EconomyService(db)
    return await service.confirm_stake_settlement(
        contribution_id=contribution_id,
        user_id=user.id,
        tx_hash=body.tx_hash,
        kind="slash",
        chain_id=body.chain_id,
    )


@router.get("/web3/transactions")
async def web3_transactions(db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    return await paginate(db, select(Web3Transaction).where(Web3Transaction.user_id == user.id).order_by(Web3Transaction.created_at.desc()), page, page_size)


@router.get("/web3/token")
async def web3_token(db: DB, user: User):
    return Web3EconomyService(db).token_config()


# ---- Phase 4.5: admin contribution review ----

async def admin_or_staff(user: User):
    if user.role not in ("admin", "staff"):
        raise APIError(403, "FORBIDDEN", "Administrator review is required.")
    return user


@router.post("/admin/contributions/{contribution_id}/accept")
async def admin_accept_contribution(contribution_id: UUID, db: DB, user: Annotated[Profile, Depends(admin_or_staff)]):
    return serialize(await accept_contribution(db, str(contribution_id), user.id))


@router.post("/admin/contributions/{contribution_id}/reject")
async def admin_reject_contribution(contribution_id: UUID, db: DB, user: Annotated[Profile, Depends(admin_or_staff)]):
    return serialize(await reject_contribution(db, str(contribution_id), user.id))


@router.get("/reputation/me")
async def reputation(user: User):
    return {"score": user.reputation_score, "level": user.reputation_level}


@router.get("/reputation/history")
async def reputation_history(db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    return await paginate(db, select(ReputationEvent).where(ReputationEvent.user_id == user.id).order_by(ReputationEvent.created_at.desc()), page, page_size)


@router.get("/leaderboard")
async def leaderboard(db: DB, user: User, period: Literal["weekly", "monthly", "all_time"] = "weekly", page: Page = 1, page_size: PageSize = 20):
    events = select(ReputationEvent.user_id, func.sum(ReputationEvent.points).label("score")).group_by(ReputationEvent.user_id)
    if period != "all_time":
        events = events.where(ReputationEvent.created_at >= now() - timedelta(days=7 if period == "weekly" else 30))
    scores = events.subquery()
    ranked = select(Profile.id, Profile.display_name, Profile.avatar_url, Profile.reputation_level, func.coalesce(scores.c.score, 0).label("reputation"), func.row_number().over(order_by=(func.coalesce(scores.c.score, 0).desc(), Profile.id)).label("rank")).join(UserSettings, UserSettings.user_id == Profile.id).outerjoin(scores, scores.c.user_id == Profile.id).where(UserSettings.leaderboard_opt_in.is_(True)).subquery()
    total = await db.scalar(select(func.count()).select_from(ranked))
    rows = (await db.execute(select(ranked).order_by(ranked.c.rank).offset((page - 1) * page_size).limit(page_size))).mappings().all()
    result = []
    for row in rows:
        verified = await db.scalar(select(func.count()).select_from(Outcome).where(Outcome.user_id == row["id"], Outcome.verification_status == "verified", Outcome.reported_result == "resolved"))
        accepted = await db.scalar(select(func.count()).select_from(Contribution).where(Contribution.user_id == row["id"], Contribution.status == "accepted"))
        result.append({**dict(row), "verified_fixes": accepted, "verified_outcomes": verified, "success_rate": None, "knowledge_impact": accepted + verified, "badge": row["reputation_level"], "is_current_user": row["id"] == user.id})
    rank = await db.scalar(select(ranked.c.rank).where(ranked.c.id == user.id))
    return {"items": result, "page": page, "page_size": page_size, "total": total, "has_more": page * page_size < total, "current_user_rank": rank, "period": period}


@router.get("/notifications")
async def notifications(db: DB, user: User, page: Page = 1, page_size: PageSize = 20):
    result = await paginate(db, select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()), page, page_size)
    result["unread"] = await db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)))
    return result


@router.patch("/notifications/{notification_id}/read")
async def read_notification(notification_id: UUID, db: DB, user: User):
    row = await owned(db, Notification, notification_id, user.id)
    row.read_at = row.read_at or now()
    return serialize(row)


@router.post("/notifications/read-all")
async def read_all(db: DB, user: User):
    await db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)).values(read_at=now()))
    return {"ok": True}


@router.get("/settings")
async def settings(db: DB, user: User):
    return serialize(await db.get(UserSettings, user.id))


@router.patch("/settings")
async def update_settings(body: SettingsPatch, db: DB, user: User):
    row = await db.get(UserSettings, user.id)
    patch(row, body)
    await db.flush()
    return serialize(row)


@router.post("/account/deletion-request", status_code=202)
async def request_deletion(body: DeleteAccountRequest, db: DB, user: User):
    row = await db.scalar(select(AccountDeletionRequest).where(AccountDeletionRequest.user_id == user.id))
    if not row:
        row = AccountDeletionRequest(user_id=user.id)
        db.add(row)
        await db.flush()
    return {"id": row.id, "status": row.status, "message": "Deletion requested. Your account remains active until an operator processes the request."}


@router.get("/dashboard")
async def dashboard(db: DB, user: User):
    return {"profile": serialize(user), "stats": await profile_stats(db, user), "rewards": await reward_summary(db, user), "recent_cases": await list_cases(db, user, page_size=5), "recent_contributions": await contributions(db, user, page_size=5), "notifications": await notifications(db, user, page_size=5), "leaderboard": await leaderboard(db, user, page_size=5)}


@router.post("/programs/campus-ambassador/applications", status_code=201)
async def create_campus_ambassador_application(body: CampusAmbassadorApplicationCreate, db: DB, user: User | None = Depends(get_optional_user)):
    email = body.email.strip().lower()
    existing = await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.email == email).limit(1))
    if existing is not None:
        raise APIError(409, "ALREADY_APPLIED", f"An application already exists for {email}.")
    if user is not None:
        owned_row = await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.user_id == user.id).limit(1))
        if owned_row is not None:
            raise APIError(409, "ALREADY_APPLIED", f"You already submitted an application ({owned_row.application_id}).")
    if not body.consent:
        raise APIError(422, "CONSENT_REQUIRED", "Consent is required to submit an application.")
    year = str(now().year)
    for _ in range(20):
        application_id = f"AMB-{year}-{secrets.token_hex(3).upper()}"
        if await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.application_id == application_id).limit(1)) is None:
            break
    else:
        application_id = f"AMB-{year}-{uuid4().hex[:6].upper()}"
    values = body.model_dump(mode="json", exclude={"email"})
    row = CampusAmbassadorApplication(
        user_id=user.id if user else None,
        email=email,
        application_id=application_id,
        lookup_token=secrets.token_urlsafe(18),
        **values,
    )
    db.add(row)
    await db.flush()
    audit(db, user.id if user else None, "ambassador_application_submitted", "campus_ambassador_applications", row.id)
    return serialize_ambassador(row)


@router.get("/programs/campus-ambassador/applications/my-application")
async def my_campus_ambassador_application(db: DB, user: User):
    row = await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.user_id == user.id).order_by(CampusAmbassadorApplication.submitted_at.desc()).limit(1))
    if row is None:
        raise APIError(404, "NOT_FOUND", "No application on file.")
    return serialize_ambassador(row)


@router.get("/programs/campus-ambassador/applications/lookup")
async def campus_ambassador_application_lookup(db: DB, token: Annotated[str, Query(min_length=6, max_length=100)]):
    row = await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.lookup_token == token).limit(1))
    if row is None:
        raise APIError(404, "NOT_FOUND", "No application matches this token.")
    return serialize_ambassador(row)


@router.patch("/programs/campus-ambassador/applications/my-application")
async def update_campus_ambassador_application(body: CampusAmbassadorApplicationPatch, db: DB, user: User):
    row = await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.user_id == user.id).order_by(CampusAmbassadorApplication.submitted_at.desc()).limit(1))
    if row is None:
        raise APIError(404, "NOT_FOUND", "No application on file.")
    if row.status != "submitted":
        raise APIError(409, "REVIEW_STARTED", "This application is already being reviewed.")
    patch(row, body)
    await db.flush()
    return serialize_ambassador(row)
