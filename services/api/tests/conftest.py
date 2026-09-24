import os
import tempfile
from types import SimpleNamespace
from uuid import NAMESPACE_URL, uuid4, uuid5

_TEST_DIR = tempfile.mkdtemp(prefix="puvexa-tests-")
_TEST_DB = os.path.join(_TEST_DIR, "test.db").replace("\\", "/")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB}"
os.environ["APP_ENV"] = "development"
os.environ["AI_PROVIDER"] = "unconfigured"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_ANON_KEY"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["SUPABASE_JWKS_URL"] = ""

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import select, text, update  # noqa: E402

from app import main as main_module  # noqa: E402
from app.api.deps import get_identity  # noqa: E402
from app.core.security import Identity  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.models import Case, CaseFixRecommendation, DiagnosisRun, Fix  # noqa: E402
from app.db.session import Session, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.scripts.seed_dev import SEEDS  # noqa: E402
from app.services.storage import get_storage  # noqa: E402

TRUNCATE = [
    "ai_runs",
    "diagnosis_sources",
    "outcome_intelligence",
    "fix_embeddings",
    "case_embeddings",
    "knowledge_chunks",
    "knowledge_documents",
    "account_deletion_requests",
    "audit_events",
    "case_evidence",
    "case_fix_recommendations",
    "knowledge_attributions",
    "wallet_links",
    "claim_reservations",
    "web3_transactions",
    "notifications",
    "reward_ledger",
    "reputation_events",
    "contributions",
    "outcomes",
    "fix_attempts",
    "diagnosis_runs",
    "fixes",
    "cases",
    "campus_ambassador_applications",
    "user_settings",
    "profiles",
]


class FakeStorage:
    def __init__(self):
        self.paths = []
        self.files = {}

    async def upload(self, user_id, case_id, extension, content, mime):
        path = f"users/{user_id}/cases/{case_id}/{uuid4()}{extension}"
        self.files[path] = content
        self.paths.append(path)
        return path

    async def signed_url(self, path):
        return f"https://storage.example/{path}"

    async def delete(self, paths):
        for path in paths or []:
            self.files.pop(path, None)


@pytest.fixture(scope="session")
async def migrated_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


async def seed_fixes():
    async with Session() as db:
        for title, category, steps in SEEDS:
            identifier = str(uuid5(NAMESPACE_URL, "puvexa:curated:" + title))
            db.add(Fix(id=identifier, title=title, summary="Curated development guidance. No verified outcome statistics yet.", category=category, instructions=list(steps)))
        await db.commit()


@pytest.fixture(autouse=True)
async def clean_db(migrated_db):
    await reset_rate_limits()
    async with Session() as db:
        for table in TRUNCATE:
            await db.execute(text(f'DELETE FROM "{table}"'))
        await db.commit()
    await seed_fixes()
    yield
    await reset_rate_limits()
    app.dependency_overrides.clear()


async def reset_rate_limits():
    main_module.limits.clear()


@pytest.fixture()
def alice():
    return Identity(id=str(uuid4()), email="alice@example.com", display_name="Alice")


@pytest.fixture()
def bob():
    return Identity(id=str(uuid4()), email="bob@example.com", display_name="Bob")


@pytest.fixture()
async def api(migrated_db):
    overrides = {}

    def set_identity(identity):
        overrides[get_identity] = identity
        ns.current_identity = identity
        app.dependency_overrides[get_identity] = lambda: identity

    def set_storage(storage):
        overrides[get_storage] = storage
        app.dependency_overrides[get_storage] = lambda: storage

    ns = SimpleNamespace()
    ns.app = app
    ns.fake_storage = FakeStorage()
    ns.set_identity = set_identity
    ns.set_storage = set_storage

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        ns.client = client

        async def create_case(**extra):
            payload = {
                "title": "Bluetooth audio keeps dropping",
                "description": "Every few minutes the headset reconnects and the sound cuts out while streaming video.",
                "category": "Hardware & Devices",
            }
            payload.update(extra)
            resp = await client.post("/api/v1/cases", json=payload)
            assert resp.status_code == 201, resp.text
            return resp.json()

        async def prepare_suggested(category="Coding Error", diagnose=True):
            case = await create_case(category=category)
            diagnosis = None
            if diagnose:
                resp = await client.post(f'/api/v1/cases/{case["id"]}/diagnose')
                assert resp.status_code == 201, resp.text
                diagnosis = resp.json()
                assert diagnosis["status"] == "unavailable"
            async with Session() as db:
                fix = (await db.scalars(select(Fix).where(Fix.category == category))).first()
                assert fix is not None
                stored_case = (await db.scalars(select(Case).where(Case.id == case["id"]))).first()
                if diagnosis is None:
                    diagnosis = {"id": str(uuid4())}
                    db.add(DiagnosisRun(id=diagnosis["id"], case_id=stored_case.id, user_id=stored_case.user_id))
                    await db.flush()
                db.add(CaseFixRecommendation(case_id=stored_case.id, diagnosis_run_id=diagnosis["id"], fix_id=fix.id, rank=1, explanation="Recommended by test fixture."))
                await db.execute(update(Case).where(Case.id == case["id"]).values(status="suggested"))
                await db.commit()
            resp = await client.get(f'/api/v1/cases/{case["id"]}/recommendations')
            items = resp.json()
            assert items, "no recommendation was created"
            fix_id = items[0]["fix"]["id"]
            return {"case": case, "diagnosis": diagnosis, "fix_id": fix_id, "fix_title": items[0]["fix"]["title"]}

        async def make_scenario(reported_result="resolved", before_data=None, after_data=None, category="Coding Error", diagnose=True):
            prepared = await prepare_suggested(category=category, diagnose=diagnose)
            case, diagnosis = prepared["case"], prepared["diagnosis"]
            fix_id = prepared["fix_id"]
            resp = await client.post(f'/api/v1/cases/{case["id"]}/attempts', json={"fix_id": fix_id})
            assert resp.status_code == 201, resp.text
            attempt_id = resp.json()["id"]
            resp = await client.post(f'/api/v1/attempts/{attempt_id}/outcomes', json={"reported_result": reported_result, "before_data": before_data or {}, "after_data": after_data or {}})
            assert resp.status_code == 201, resp.text
            return {"case": case, "diagnosis": diagnosis, "attempt_id": attempt_id, "outcome": resp.json(), "fix_id": fix_id, "fix_title": prepared["fix_title"]}

        ns.create_case = create_case
        ns.prepare_suggested = prepare_suggested
        ns.make_scenario = make_scenario
        yield ns

    for key in overrides:
        app.dependency_overrides.pop(key, None)