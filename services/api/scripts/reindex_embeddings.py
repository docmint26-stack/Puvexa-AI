r"""Re-index embeddings produced by a different AI provider/model (staging tool).

When switching AI providers (e.g. OpenAI -> Gemini) the stored vector space must
be rebuilt entirely in the new model, otherwise retrieval silently mixes vectors
from two models because pgvector columns are fixed at 1536 dimensions and only
enforce length, not provenance.

This script re-embeds every populated embedding surface with the ACTIVE provider
from get_ai_provider():

  - knowledge_chunks.embedding        <- chunk.content
  - outcome_intelligence.embedding    <- normalized context + result

The knowledge_chunks / outcome_intelligence tables have no model-version columns,
so the safe migration is a full overwrite (nothing old is left behind). This tool
is only for staging: run it once after switching providers, before fresh retrievals.

Run from services/api with the .venv (reads services/api/.env automatically):
  .\.venv\Scripts\python.exe scripts\reindex_embeddings.py

Exits 1 if AI_UNCONFIGURED or if any embedding comes back with the wrong dimension.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.models import KnowledgeChunk, OutcomeIntelligence  # noqa: E402
from app.db.session import Session  # noqa: E402
from app.services.ai.provider import UnconfiguredAIProvider, get_ai_provider  # noqa: E402
from app.services.retrieval.embeddings import build_case_embedding_text  # noqa: E402

BATCH_SIZE = 16


def forge_outcome_text(intel: OutcomeIntelligence) -> str:
    """Rebuilds the privacy-preserving embedding text from stored, normalized data."""
    env = {
        "os": intel.os,
        "software": intel.software,
        "software_version": (intel.normalized_context or {}).get("version"),
    }
    return build_case_embedding_text(
        title=f"{intel.error_family}: {intel.result}",
        description=f"{intel.category} resolved as {intel.result}. {intel.error_family}",
        category=intel.category or "General",
        environment=env,
    )


async def main() -> int:
    settings = get_settings()
    provider = get_ai_provider(settings)
    if isinstance(provider, UnconfiguredAIProvider) or settings.ai_provider in ("", "unconfigured"):
        print(f"AI is not configured (ai_provider={settings.ai_provider!r}); refusing to re-index.")
        return 1

    async with Session() as db:
        chunks = (await db.scalars(select(KnowledgeChunk).where(KnowledgeChunk.embedding.is_not(None)))).all()
        intel_rows = (await db.scalars(select(OutcomeIntelligence).where(OutcomeIntelligence.embedding.is_not(None)))).all()
        print(f"Re-indexing {len(chunks)} knowledge chunks and {len(intel_rows)} outcome intelligence rows "
              f"with provider={settings.ai_provider} (dim={settings.ai_embedding_dim})")

        total_failures = 0
        for label, rows in (("knowledge_chunks", chunks), ("outcome_intelligence", intel_rows)):
            for offset in range(0, len(rows), BATCH_SIZE):
                batch = rows[offset:offset + BATCH_SIZE]
                texts = [row.content for row in batch] if label == "knowledge_chunks" else [forge_outcome_text(row) for row in batch]
                vectors = await provider.batch_generate_embeddings(texts)
                for row, vec, text in zip(batch, vectors, texts):
                    if len(vec) != settings.ai_embedding_dim:
                        print(f"  FAIL dim {len(vec)} != {settings.ai_embedding_dim} for {label} row {row.id} (text starts: {text[:60]!r})")
                        total_failures += 1
                        continue
                    row.embedding = vec
                await db.flush()
            print(f"  {label}: prepared {len(rows)} rows")

        await db.commit()
        if total_failures:
            await db.rollback()
            print(f"Re-index finished with {total_failures} dimension failures; nothing was committed.")
            return 1
        print("Re-index committed. Old-model embeddings fully replaced by active provider.")
        return 0


if __name__ == "__main__":
    code = asyncio.run(main())
    sys.exit(code)