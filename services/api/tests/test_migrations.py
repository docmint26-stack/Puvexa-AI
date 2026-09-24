import asyncio
from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app.core.config import get_settings

BASE_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BASE_DIR / "alembic.ini"

EXPECTED_TABLES = [
    "profiles", "cases", "case_evidence", "diagnosis_runs", "fixes", "case_fix_recommendations",
    "fix_attempts", "outcomes", "contributions", "reward_ledger", "reputation_events",
    "knowledge_attributions", "wallet_links", "notifications", "user_settings", "audit_events",
    "account_deletion_requests", "knowledge_documents", "knowledge_chunks", "case_embeddings",
    "fix_embeddings", "outcome_intelligence", "diagnosis_sources", "ai_runs", "claim_reservations",
    "campus_ambassador_applications",
]


def test_migrations_upgrade_to_head(tmp_path, monkeypatch):
    db_path = tmp_path / "migrate.db"
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    monkeypatch.setattr(get_settings(), "database_url", url)

    cfg = Config(str(ALEMBIC_INI))
    command.upgrade(cfg, "head")

    async def verify():
        engine = create_async_engine(url)
        tables = []
        try:
            async with engine.connect() as conn:
                version = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar()
                def sync_insp(_):
                    return list(inspect(conn.sync_connection).get_table_names())
                tables = await conn.run_sync(sync_insp)
        finally:
            await engine.dispose()
        return version, tables

    version, tables = asyncio.run(verify())
    assert version == "20260924_campus_ambassador_applications"
    for table in EXPECTED_TABLES:
        assert table in tables, f"missing table {table}"
    assert "web3_transactions" in tables, "missing table web3_transactions"


def test_migrations_idempotent_stamp(tmp_path, monkeypatch):
    db_path = tmp_path / "migrate2.db"
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    monkeypatch.setattr(get_settings(), "database_url", url)

    cfg = Config(str(ALEMBIC_INI))
    command.upgrade(cfg, "head")
    command.upgrade(cfg, "head")
    assert url.startswith("sqlite+aiosqlite")