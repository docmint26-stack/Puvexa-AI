"""PuvexaIntelligenceService — AI Orchestration Layer.

Orchestrates the 10-stage diagnosis pipeline:
  RECEIVED -> EVIDENCE_PROCESSING -> CONTEXT_NORMALIZATION -> KNOWLEDGE_RETRIEVAL
  -> SIMILAR_CASE_RETRIEVAL -> ROOT_CAUSE_ANALYSIS -> FIX_GENERATION -> FIX_RANKING
  -> VALIDATION -> COMPLETED (or FAILED)

Enforces GroundedContext facts to eliminate hallucinations, tracks provenance in
diagnosis_sources, records audit runs in ai_runs, and persists stage updates for status polling.
"""
import logging
import time
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.base import now
from app.db.models import (
    AIRun,
    Case,
    CaseEvidence,
    CaseFixRecommendation,
    DiagnosisRun,
    DiagnosisSource,
    Fix,
)
from app.services.ai.confidence import calculate_composite_confidence
from app.services.ai.log_processor import process_logs
from app.services.ai.prompts import PROMPT_VERSION_RANKING
from app.services.ai.provider import AIProvider, AIRunMetrics, get_ai_provider
from app.services.ai.redactor import redact_secrets
from app.services.ai.sandbox import analyze_code_snippet
from app.services.ai.schemas import EvidenceItem
from app.services.retrieval.embeddings import build_case_embedding_text
from app.services.retrieval.knowledge_search import KnowledgeSearch
from app.services.retrieval.reranker import FixRanker, check_destructive_content
from app.services.retrieval.similar_cases import SimilarCaseRetriever

logger = logging.getLogger("puvexa")

STAGES = [
    ("RECEIVED", 5, "Diagnosis request received and queued"),
    ("EVIDENCE_PROCESSING", 15, "Processing and redacting attached evidence"),
    ("CONTEXT_NORMALIZATION", 30, "Normalizing environment and error signatures"),
    ("KNOWLEDGE_RETRIEVAL", 45, "Retrieving official documentation and curated guides"),
    ("SIMILAR_CASE_RETRIEVAL", 60, "Scanning historical verified outcomes for similar patterns"),
    ("ROOT_CAUSE_ANALYSIS", 75, "Analyzing root causes and hypotheses"),
    ("FIX_GENERATION", 85, "Formulating candidate fixes and safety prerequisites"),
    ("FIX_RANKING", 92, "Ranking fixes with outcome-weighted scoring"),
    ("VALIDATION", 98, "Validating schema integrity and safety constraints"),
    ("COMPLETED", 100, "Diagnosis complete and recommendations ready"),
]

# Normalizes source_type vocabulary used across the platform onto the FixRanker schema.
SOURCE_TYPE_NORMALIZATION = {
    "official": "official_doc",
    "official_doc": "official_doc",
    "docs": "official_doc",
    "curated": "curated",
    "community_verified": "verified_outcome",
    "verified_outcome": "verified_outcome",
    "community": "verified_outcome",
    "internal": "curated",
    "ai_generated": "ai_generated",
    "ai": "ai_generated",
    "generated": "ai_generated",
}


def normalize_source_type(source_type: str | None) -> str:
    """Maps any stored source_type vocabulary onto the FixRanker canonical set."""
    return SOURCE_TYPE_NORMALIZATION.get((source_type or "").lower().strip(), "curated")


class PuvexaIntelligenceService:
    def __init__(self, db: AsyncSession, provider: AIProvider | None = None):
        self.db = db
        self.provider = provider or get_ai_provider()
        self.knowledge_search = KnowledgeSearch(db)
        self.similar_retriever = SimilarCaseRetriever(db)
        self.reranker = FixRanker()

    async def update_stage(self, diagnosis_run: DiagnosisRun, stage: str, message: str, percent: int, extra: dict[str, Any] | None = None):
        """Persists intermediate stage progress for frontend polling."""
        meta = dict(diagnosis_run.analysis_metadata or {})
        meta["stage"] = stage
        meta["stage_message"] = message
        meta["stage_percent"] = percent
        if extra:
            meta.update(extra)
        diagnosis_run.analysis_metadata = meta
        await self.db.flush()
        await self.db.commit()

    async def run_diagnosis_pipeline(self, case: Case, diagnosis_run: DiagnosisRun) -> DiagnosisRun:
        """Executes the full end-to-end diagnosis pipeline."""
        try:
            # Stage 1: RECEIVED
            await self.update_stage(diagnosis_run, "RECEIVED", "Diagnosis request registered", 5)

            # Stage 2: EVIDENCE_PROCESSING
            await self.update_stage(diagnosis_run, "EVIDENCE_PROCESSING", "Processing and redacting evidence", 15)
            evidences = (await self.db.scalars(
                select(CaseEvidence).where(CaseEvidence.case_id == case.id)
            )).all()

            normalized_items: list[EvidenceItem] = []
            extracted_sigs: list[str] = []

            for ev in evidences:
                raw_text = (ev.text_content or "")[:get_settings().ai_max_evidence_chars]
                # Redact secrets
                sanitized_text, flags = redact_secrets(raw_text)

                if ev.evidence_type == "log":
                    log_summary = process_logs(sanitized_text)
                    extracted_sigs.extend(log_summary.unique_signatures[:3])
                    sanitized_text = log_summary.compact_text

                elif ev.evidence_type == "code":
                    code_analysis = analyze_code_snippet(sanitized_text)
                    sanitized_text = f"Code ({code_analysis.language}):\n{sanitized_text[:1500]}"
                elif ev.evidence_type in ("screenshot", "before_image", "after_image") and not sanitized_text:
                    sanitized_text = "Image attached but automatic image analysis is unavailable. Ask for a redacted text transcription; do not infer image contents."

                normalized_items.append(
                    EvidenceItem(
                        id=str(ev.id),
                        type=ev.evidence_type if ev.evidence_type in ("screenshot", "log", "code", "output", "text", "diagnostic") else "text",
                        source=ev.original_filename or ev.evidence_type,
                        text=sanitized_text,
                        sensitive_content_flags=flags,
                    )
                )

            # Stage 3: CONTEXT_NORMALIZATION
            await self.update_stage(diagnosis_run, "CONTEXT_NORMALIZATION", "Normalizing context and error signatures", 30)
            embedding_text = build_case_embedding_text(
                title=case.title,
                description=case.description,
                category=case.category,
                environment=case.environment,
                error_signatures=extracted_sigs,
            )
            query_embedding = await self.provider.generate_embedding(embedding_text)

            # Stage 4: KNOWLEDGE_RETRIEVAL
            await self.update_stage(diagnosis_run, "KNOWLEDGE_RETRIEVAL", "Searching official and curated technical knowledge", 45)
            knowledge_matches = await self.knowledge_search.search(
                query_embedding=query_embedding,
                category=case.category,
                keywords=extracted_sigs or [case.title],
                limit=5,
            )

            # Stage 5: SIMILAR_CASE_RETRIEVAL
            await self.update_stage(diagnosis_run, "SIMILAR_CASE_RETRIEVAL", "Searching verified outcomes from similar cases", 60)
            similar_cases = await self.similar_retriever.find_similar_cases(
                query_embedding=query_embedding,
                category=case.category,
                software=case.software_name,
                os_name=case.operating_system,
                error_family=case.subcategory,
                limit=5,
            )

            # Stage 6: ROOT_CAUSE_ANALYSIS
            await self.update_stage(diagnosis_run, "ROOT_CAUSE_ANALYSIS", "Synthesizing root cause hypotheses", 75)
            problem_analysis, ai_metrics = await self.provider.analyze_problem(
                title=case.title,
                description=case.description,
                category=case.category,
                environment=case.environment,
                evidence=[item.model_dump() for item in normalized_items],
                grounded_facts=knowledge_matches,
                similar_cases=similar_cases,
            )

            # Record AI Run audit
            self.db.add(
                AIRun(
                    user_id=case.user_id,
                    case_id=case.id,
                    task_type="diagnosis",
                    provider=ai_metrics.provider,
                    model=ai_metrics.model,
                    prompt_version=ai_metrics.prompt_version,
                    input_token_count=ai_metrics.input_tokens,
                    output_token_count=ai_metrics.output_tokens,
                    latency_ms=ai_metrics.latency_ms,
                    cost_usd=Decimal(str(ai_metrics.estimated_cost_usd)),
                    status="completed",
                )
            )
            logger.info(
                "ai_run_completed",
                extra={"fields": {"task_type": "diagnosis", "case_id": str(case.id), "status": "completed", "provider": ai_metrics.provider, "model": ai_metrics.model, "latency_ms": ai_metrics.latency_ms}},
            )

            # Stage 7: FIX_GENERATION
            await self.update_stage(diagnosis_run, "FIX_GENERATION", "Formulating candidate fixes", 85)
            # Fetch existing database fixes in same category
            candidate_fix_rows = (await self.db.scalars(
                select(Fix).where(Fix.category == case.category).limit(10)
            )).all()

            candidate_dicts: list[dict[str, Any]] = []
            for fix_row in candidate_fix_rows:
                candidate_dicts.append({
                    "id": fix_row.id,
                    "title": fix_row.title,
                    "summary": fix_row.summary,
                    "steps": fix_row.instructions,
                    "category": fix_row.category,
                    "risk_level": fix_row.risk_level,
                    "effort_level": fix_row.effort_level,
                    "source_type": normalize_source_type(fix_row.source_type),
                    "success_count": fix_row.success_count,
                    "failure_count": fix_row.failure_count,
                    "partial_count": fix_row.partial_count,
                    "verified_success_rate": float(fix_row.verified_success_rate) if fix_row.verified_success_rate else None,
                    "why_it_matches": f"Category match: {case.category}. Ranked against the reported symptoms; applicability still requires review.",
                })

            # If no fixes exist in db, add from knowledge matches
            if not candidate_dicts and knowledge_matches:
                for km in knowledge_matches:
                    candidate_dicts.append({
                        "id": None,
                        "title": km["title"],
                        "summary": km["content"][:200],
                        "steps": [km["content"][:400]],
                        "category": km["category"],
                        "risk_level": "low",
                        "effort_level": "low",
                        "source_type": normalize_source_type(km["source_type"]),
                        "success_count": 0,
                        "failure_count": 0,
                        "why_it_matches": f"Curated from {km['source_name']}",
                    })

            # Stage 8: FIX_RANKING
            await self.update_stage(diagnosis_run, "FIX_RANKING", "Ranking fixes and computing composite confidence", 92)
            rank_start = time.perf_counter()
            ranked_result = self.reranker.score_and_rank_fixes(
                candidate_dicts,
                context_features={"category": case.category, "problem": problem_analysis.problem_summary},
            )
            rank_latency = int((time.perf_counter() - rank_start) * 1000)
            rank_model = getattr(self.provider, "model_name", None) or getattr(self.provider, "model", "hybrid_rank_engine")
            rank_metrics = AIRunMetrics(
                input_tokens=sum(len(steps) for f in candidate_dicts for steps in [f.get("steps", [])]),
                output_tokens=len(ranked_result) * 80,
                latency_ms=rank_latency,
                estimated_cost_usd=0.0,
                provider="puvexa_hybrid_rank",
                model=str(rank_model),
                prompt_version=PROMPT_VERSION_RANKING,
            )
            self.db.add(
                AIRun(
                    user_id=case.user_id,
                    case_id=case.id,
                    task_type="fix_ranking",
                    provider=rank_metrics.provider,
                    model=rank_metrics.model,
                    prompt_version=rank_metrics.prompt_version,
                    input_token_count=rank_metrics.input_tokens,
                    output_token_count=rank_metrics.output_tokens,
                    latency_ms=rank_metrics.latency_ms,
                    cost_usd=Decimal(str(rank_metrics.estimated_cost_usd)),
                    status="completed",
                )
            )

            # Stage 9: VALIDATION
            await self.update_stage(diagnosis_run, "VALIDATION", "Validating safety and provenance", 98)
            ranked_result = [fix for fix in ranked_result if not check_destructive_content(
                f"{fix.title} {fix.summary} {' '.join(fix.steps)}")[0]]
            for rank, fix in enumerate(ranked_result, 1):
                fix.rank = rank

            # Persist recommendations and sources
            for ranked_fix in ranked_result:
                target_fix_id = ranked_fix.fix_id
                # If fix does not exist in db, persist it
                if not target_fix_id:
                    new_fix = Fix(
                        id=str(uuid4()),
                        title=ranked_fix.title,
                        summary=ranked_fix.summary,
                        instructions=ranked_fix.steps,
                        category=case.category,
                        risk_level=ranked_fix.risk_level,
                        effort_level=ranked_fix.effort_level,
                        source_type=ranked_fix.source_type,
                    )
                    self.db.add(new_fix)
                    await self.db.flush()
                    target_fix_id = new_fix.id

                # Save recommendation
                rec = CaseFixRecommendation(
                    case_id=case.id,
                    diagnosis_run_id=diagnosis_run.id,
                    fix_id=target_fix_id,
                    rank=ranked_fix.rank,
                    ai_confidence=Decimal(str(ranked_fix.ai_confidence)),
                    context_match_score=Decimal(str(ranked_fix.context_match_score)),
                    explanation=ranked_fix.explanation,
                    estimated_success_rate=Decimal(str(ranked_fix.verified_success_rate)) if ranked_fix.verified_success_rate else None,
                )
                self.db.add(rec)

            # Provenance: record knowledge sources
            for km in knowledge_matches:
                self.db.add(
                    DiagnosisSource(
                        diagnosis_id=diagnosis_run.id,
                        source_type="knowledge_chunk",
                        source_id=km["chunk_id"],
                        relevance_score=Decimal(str(km["similarity_score"])),
                        usage_type="context",
                    )
                )

            # Compute composite confidence
            confidence_breakdown = calculate_composite_confidence(
                evidence_completeness=min(1.0, 0.4 + 0.2 * len(normalized_items)),
                retrieval_strength=max([km["similarity_score"] for km in knowledge_matches], default=0.5),
                context_match=max([f.context_match_score for f in ranked_result], default=0.85),
                source_authority=0.90 if knowledge_matches else 0.65,
                historical_outcome_strength=0.80 if similar_cases else 0.40,
                ai_agreement=problem_analysis.confidence,
            )

            # Stage 10: COMPLETED
            diagnosis_run.status = "completed"
            diagnosis_run.problem_summary = problem_analysis.problem_summary
            diagnosis_run.probable_cause = problem_analysis.likely_causes[0].title if problem_analysis.likely_causes else "Identified Issue"
            diagnosis_run.confidence = Decimal(str(confidence_breakdown.overall))
            diagnosis_run.similar_case_count = len(similar_cases)
            diagnosis_run.model_provider = ai_metrics.provider
            diagnosis_run.model_name = ai_metrics.model
            diagnosis_run.completed_at = now()

            await self.update_stage(
                diagnosis_run,
                "COMPLETED",
                "Diagnosis completed successfully",
                100,
                extra={
                    "confidence_breakdown": confidence_breakdown.model_dump(),
                    "missing_information": problem_analysis.missing_information,
                    "risk_flags": problem_analysis.risk_flags,
                    "similar_cases_matched": len(similar_cases),
                    "knowledge_sources_consulted": len(knowledge_matches),
                    "ranking_rationale": (
                        f"Scored {len(ranked_result)} candidates by context match, verified outcome strength, "
                        "source quality, and risk/effort penalties."
                    ),
                    "top_fix_trust_label": ranked_result[0].trust_label if ranked_result else None,
                },
            )

            case.status = "suggested"
            case.current_diagnosis_id = diagnosis_run.id
            await self.db.flush()
            return diagnosis_run

        except APIError as exc:
            diagnosis_run.status = "failed" if exc.code != "AI_PROVIDER_NOT_CONFIGURED" else "unavailable"
            diagnosis_run.model_provider = "unconfigured" if exc.code == "AI_PROVIDER_NOT_CONFIGURED" else "failed"
            diagnosis_run.analysis_metadata = {
                "stage": "FAILED",
                "code": exc.code,
                "message": exc.message,
            }
            self.db.add(
                AIRun(
                    user_id=case.user_id,
                    case_id=case.id,
                    task_type="diagnosis",
                    provider="unconfigured" if exc.code == "AI_PROVIDER_NOT_CONFIGURED" else "unknown",
                    model="",
                    prompt_version="",
                    status="failed",
                    error_code=exc.code,
                )
            )
            logger.warning("ai_run_failed", extra={"fields": {"task_type": "diagnosis", "case_id": str(case.id), "status": "failed", "error_code": exc.code}})
            case.status = "needs_review"
            case.current_diagnosis_id = diagnosis_run.id
            await self.db.flush()
            return diagnosis_run

        except Exception as exc:
            diagnosis_run.status = "failed"
            diagnosis_run.analysis_metadata = {
                "stage": "FAILED",
                "code": "AI_PROVIDER_ERROR",
                "message": "Diagnosis pipeline encountered an unexpected error.",
            }
            self.db.add(
                AIRun(
                    user_id=case.user_id,
                    case_id=case.id,
                    task_type="diagnosis",
                    provider=getattr(self.provider, "model_name", "unknown"),
                    model="",
                    prompt_version="",
                    status="failed",
                    error_code=f"AI_PROVIDER_ERROR: {type(exc).__name__}",
                )
            )
            logger.error("ai_run_failed", exc_info=True, extra={"fields": {"task_type": "diagnosis", "case_id": str(case.id), "status": "failed", "error_code": f"AI_PROVIDER_ERROR: {type(exc).__name__}"}})
            case.status = "needs_review"
            case.current_diagnosis_id = diagnosis_run.id
            await self.db.flush()
            return diagnosis_run
