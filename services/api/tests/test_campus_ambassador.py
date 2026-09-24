from datetime import UTC, datetime

from sqlalchemy import select, update

from app.api.deps import get_optional_identity
from app.db.models import CampusAmbassadorApplication
from app.db.session import Session as DbSession
from app.main import app

URL = "/api/v1/programs/campus-ambassador/applications"


def payload(**extra):
    data = {
        "full_name": "Ada Lovelace",
        "email": "ada@example.com",
        "phone": "+1 555 000 1234",
        "country": "Nigeria",
        "city": "Lagos",
        "institution": "University of Lagos",
        "program": "BSc Computer Science",
        "graduation_year": 2027,
        "current_student": True,
        "club_involvement": "Google Developer Student Club",
        "leadership_experience": True,
        "leadership_description": "Organized a 120-person hackathon",
        "motivation": "I love helping classmates debug their projects and want to grow a fix-first community on campus.",
        "community_goals": "I want to host monthly problem-solving workshops and make verified fixes a habit in my CS club.",
        "github_url": "https://github.com/ada",
        "linkedin_url": None,
        "other_social_url": None,
        "audience_count": 500,
        "technical_level": "intermediate",
        "skill_tags": ["Community Management", "AI & Machine Learning"],
        "weekly_hours": 5,
        "availability_months": 6,
        "timezone": "WAT — Lagos",
        "resources_needed": "Event templates and a starter kit for the first workshop.",
        "previous_ambassador": False,
        "previous_ambassador_details": None,
        "consent": True,
    }
    data.update(extra)
    return data


async def set_optional_identity(app_, identity):
    if identity is None:
        app_.dependency_overrides.pop(get_optional_identity, None)
    else:
        app_.dependency_overrides[get_optional_identity] = lambda: identity


async def test_guest_can_submit(api):
    resp = await api.client.post(URL, json=payload())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["applicationId"].startswith(f"AMB-{datetime.now(UTC).year}-")
    assert body["id"]
    assert body["status"] == "submitted"
    assert body["fullName"] == "Ada Lovelace"
    assert body["email"] == "ada@example.com"
    assert body["submittedAt"]
    assert body["lookupToken"]


async def test_duplicate_email_conflict(api):
    await api.client.post(URL, json=payload())
    resp = await api.client.post(URL, json=payload())
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_APPLIED"


async def test_duplicate_email_is_case_insensitive(api):
    await api.client.post(URL, json=payload())
    resp = await api.client.post(URL, json=payload(email="ADA@example.com"))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_APPLIED"


async def test_consent_required(api):
    resp = await api.client.post(URL, json=payload(consent=False))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "CONSENT_REQUIRED"


async def test_bad_email_rejected(api):
    resp = await api.client.post(URL, json=payload(email="not-an-email"))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_status_is_server_controlled(api):
    resp = await api.client.post(URL, json=payload(status="accepted", email="sneaky@example.com"))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_authenticated_submit_is_linked_to_profile(api, alice):
    await set_optional_identity(app, alice)
    try:
        resp = await api.client.post(URL, json=payload(email="alice-auth@example.com"))
        assert resp.status_code == 201, resp.text
    finally:
        await set_optional_identity(app, None)

    api.set_identity(alice)
    mine = await api.client.get(f"{URL}/my-application")
    assert mine.status_code == 200
    body = mine.json()
    assert body["email"] == "alice-auth@example.com"
    assert body["applicationId"]


async def test_authenticated_user_can_submit_once(api, alice):
    await set_optional_identity(app, alice)
    try:
        first = await api.client.post(URL, json=payload(email="alice-two@example.com"))
        assert first.status_code == 201, first.text
        second = await api.client.post(URL, json=payload(email="other@example.com"))
        assert second.status_code == 409
        assert second.json()["error"]["code"] == "ALREADY_APPLIED"
    finally:
        await set_optional_identity(app, None)


async def test_my_application_requires_auth(api):
    resp = await api.client.get(f"{URL}/my-application")
    assert resp.status_code == 401


async def test_my_application_not_found_for_clean_user(api, alice):
    api.set_identity(alice)
    resp = await api.client.get(f"{URL}/my-application")
    assert resp.status_code == 404


async def test_lookup_by_token(api):
    created = await api.client.post(URL, json=payload())
    token = created.json()["lookupToken"]

    resp = await api.client.get(f"{URL}/lookup", params={"token": token})
    assert resp.status_code == 200
    assert resp.json()["applicationId"] == created.json()["applicationId"]

    bad = await api.client.get(f"{URL}/lookup", params={"token": "no-such-token"})
    assert bad.status_code == 404


async def test_patch_updates_submitted_application(api, alice):
    await set_optional_identity(app, alice)
    try:
        created = await api.client.post(URL, json=payload(email="alice-patch@example.com"))
        assert created.status_code == 201
    finally:
        await set_optional_identity(app, None)

    api.set_identity(alice)
    resp = await api.client.patch(f"{URL}/my-application", json={"weekly_hours": 9, "current_student": False})
    assert resp.status_code == 200, resp.text
    assert resp.json()["applicationId"] == created.json()["applicationId"]

    async with DbSession() as db:
        row = await db.scalar(select(CampusAmbassadorApplication).where(CampusAmbassadorApplication.user_id == alice.id).limit(1))
        assert row is not None
        assert row.weekly_hours == 9
        assert row.current_student is False
        assert row.email == "alice-patch@example.com"


async def test_patch_blocked_once_review_starts(api, alice):
    await set_optional_identity(app, alice)
    try:
        resp = await api.client.post(URL, json=payload(email="alice-blk@example.com"))
        assert resp.status_code == 201
    finally:
        await set_optional_identity(app, None)

    async with DbSession() as db:
        await db.execute(update(CampusAmbassadorApplication).where(CampusAmbassadorApplication.user_id == alice.id).values(status="under_review"))
        await db.commit()

    api.set_identity(alice)
    resp = await api.client.patch(f"{URL}/my-application", json={"weekly_hours": 9})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REVIEW_STARTED"


async def test_patch_requires_auth(api):
    resp = await api.client.patch(f"{URL}/my-application", json={"weekly_hours": 9})
    assert resp.status_code == 401