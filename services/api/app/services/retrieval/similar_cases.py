"""Hybrid privacy-preserving similar case retriever.

Matches incoming problem contexts against historical verified outcomes using:
semantic similarity + category match + OS/software match + error signature match + verified outcome strength.
Guarantees zero leakage of private user logs, code, screenshots, or personal identities.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.models import Fix, OutcomeIntelligence
from app.services.retrieval.embeddings import cosine_similarity


class SimilarCaseRetriever:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_similar_cases(
        self,
        query_embedding: list[float],
        category: str,
        software: str | None = None,
        os_name: str | None = None,
        error_family: str | None = None,
        limit: int = 5,
        min_score: float = 0.30,
    ) -> list[dict[str, Any]]:
        """Retrieves normalized, anonymized outcome intelligence matching the context."""
        expected_dim = get_settings().ai_embedding_dim
        if len(query_embedding) != expected_dim:
            raise APIError(502, "EMBEDDING_MISMATCH", f"Query embedding has dimension {len(query_embedding)}, expected {expected_dim}.")
        stmt = select(OutcomeIntelligence, Fix).join(Fix, OutcomeIntelligence.fix_id == Fix.id)

        rows = (await self.db.execute(stmt)).all()
        results: list[dict[str, Any]] = []

        for intel, fix in rows:
            # 1. Semantic vector similarity (0.0 to 1.0)
            sem_sim = 0.0
            if intel.embedding is not None and len(intel.embedding) > 0:
                sem_sim = cosine_similarity(query_embedding, intel.embedding)

            # 2. Category match (exact match gives full score)
            cat_match = 1.0 if (intel.category and intel.category.lower() == category.lower()) else 0.2

            # 3. Software / OS match
            env_match = 0.5
            shared_signals: list[str] = []
            if software and intel.software and software.lower() in intel.software.lower():
                env_match += 0.3
                shared_signals.append(f"Matching software: {intel.software}")
            if os_name and intel.os and os_name.lower() in intel.os.lower():
                env_match += 0.2
                shared_signals.append(f"Matching OS: {intel.os}")
            if intel.version_range and software:
                env_match = min(1.0, env_match + 0.05)
                shared_signals.append(f"Software version tracked: {intel.version_range}")

            # 4. Error signature / family match
            err_match = 0.4
            if error_family and intel.error_family and error_family.lower() in intel.error_family.lower():
                err_match = 1.0
                shared_signals.append(f"Matching error: {intel.error_family}")

            # 5. Verified outcome strength
            outcome_strength = float(intel.confidence or 0.5)
            if intel.verification_strength == "strong":
                outcome_strength = min(1.0, outcome_strength * 1.2)
            elif intel.verification_strength == "weak":
                outcome_strength *= 0.7

            # Hybrid Score formula
            # Weights: Semantic 35%, Category 20%, Error 20%, Environment 15%, Outcome Strength 10%
            hybrid_score = (
                0.35 * sem_sim
                + 0.20 * cat_match
                + 0.20 * err_match
                + 0.15 * env_match
                + 0.10 * outcome_strength
            )

            if hybrid_score >= min_score:
                results.append({
                    "intelligence_id": intel.id,
                    "similarity_score": round(hybrid_score, 3),
                    "context_match": round(0.5 * cat_match + 0.5 * env_match, 2),
                    "shared_signals": shared_signals or [f"Category: {intel.category}"],
                    "fix_id": fix.id,
                    "fix_title": fix.title,
                    "category": intel.category,
                    "error_family": intel.error_family,
                    "software": intel.software,
                    "version_range": intel.version_range,
                    "outcome": intel.result,
                    "verification_strength": intel.verification_strength,
                    "verification_confidence": float(intel.confidence),
                    "source_quality": "outcome_backed" if intel.verification_strength == "strong" else "community_verified",
                    "sample_size": fix.success_count + fix.failure_count,
                    "verified_count": fix.success_count,
                })

        # Sort descending by hybrid similarity score
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:limit]
