"""Knowledge base search utilizing vector similarity and keyword filtering.

Supports native pgvector cosine distance on PostgreSQL and Python cosine
similarity fallback on SQLite for test environments.
"""
from typing import Any

from sqlalchemy import String, bindparam, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.db.models import KnowledgeChunk, KnowledgeDocument
from app.services.retrieval.embeddings import cosine_similarity


class KnowledgeSearch:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(
        self,
        query_embedding: list[float],
        category: str | None = None,
        keywords: list[str] | None = None,
        limit: int = 5,
        min_similarity: float = 0.35,
    ) -> list[dict[str, Any]]:
        """Performs hybrid vector search over knowledge chunks.

        Uses pgvector's native cosine distance (<=>) when connected to PostgreSQL,
        otherwise falls back to a Python cosine similarity scan (SQLite/tests).
        """
        expected_dim = get_settings().ai_embedding_dim
        if len(query_embedding) != expected_dim:
            raise APIError(502, "EMBEDDING_MISMATCH", f"Query embedding has dimension {len(query_embedding)}, expected {expected_dim}.")
        dialect = getattr(getattr(self.db.bind, "dialect", None), "name", None) if self.db.bind else None

        if dialect == "postgresql":
            stmt = select(KnowledgeChunk, KnowledgeDocument).join(
                KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id
            ).where(KnowledgeChunk.embedding.is_not(None))
            if category:
                stmt = stmt.where(KnowledgeDocument.category == category)
            # pgvector: order by embedding <=> :query LIMIT n
            stmt = stmt.order_by(
                text("embedding <=> CAST(:query_embedding AS vector)").bindparams(
                    bindparam("query_embedding", value=f"[{','.join(map(str, query_embedding))}]", type_=String())
                )
            ).limit(max(limit * 4, 20))
            rows = (await self.db.execute(stmt)).all()
        else:
            stmt = select(KnowledgeChunk, KnowledgeDocument).join(
                KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id
            )
            if category:
                stmt = stmt.where(KnowledgeDocument.category == category)
            rows = (await self.db.execute(stmt)).all()

        results: list[dict[str, Any]] = []

        for chunk, doc in rows:
            if chunk.embedding is None or len(chunk.embedding) == 0:
                continue

            # Compute similarity (Python cosine fallback; native path still rescored for consistency)
            sim = cosine_similarity(query_embedding, chunk.embedding)

            # Keyword boost if keywords present in content
            content_lower = chunk.content.lower()
            if keywords:
                for kw in keywords:
                    if kw.lower() in content_lower:
                        sim = min(1.0, sim + 0.08)

            if sim >= min_similarity:
                results.append({
                    "chunk_id": chunk.id,
                    "document_id": doc.id,
                    "title": doc.title,
                    "category": doc.category,
                    "source_type": doc.source_type,
                    "source_name": doc.source_name,
                    "source_url": doc.source_url,
                    "trust_level": doc.trust_level,
                    "content": chunk.content,
                    "similarity_score": round(sim, 3),
                })

        # Sort by similarity descending
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:limit]
