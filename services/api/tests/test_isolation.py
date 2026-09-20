"""Phase 5.5: two-user data isolation matrix.

Proves that switching identity between two authenticated users never leaks the
other user's data through any route, and that direct-ID access to another
user's objects consistently fails closed with 404. This is the backend-facing
stand-in for a real Supabase-tenant-RLS check (which additionally guards every
table at the database layer via the phase55 RLS migration).
"""

from app.db.models import Notification, WalletLink, Web3Transaction
from app.db.session import Session
from app.services.workflows import accept_outcome

ADDRESS_A = "0x1111111111111111111111111111111111111111"
ADDRESS_B = "0x2222222222222222222222222222222222222222"


async def _insert_for(db, model, **kwargs):
    row = model(**kwargs)
    db.add(row)
    await db.flush()
    return row


async def test_bob_cannot_read_alice_case_evidence_outcome_diagnosis(api, alice, bob):
    api.set_identity(alice)
    case = await api.make_scenario(category="Coding Error")
    case_id, outcome_id = case["case"]["id"], case["outcome"]["id"]
    diagnosis_id = case["diagnosis"]["id"]
    ev = await api.client.post(f"/api/v1/cases/{case_id}/evidence", data={"evidence_type": "output", "text_content": "exit code 1"})
    evidence_id = ev.json()["id"]

    api.set_identity(bob)
    assert (await api.client.get(f"/api/v1/cases/{case_id}")).status_code == 404
    assert (await api.client.get("/api/v1/cases")).json()["total"] == 0
    assert (await api.client.get(f"/api/v1/cases/{case_id}/evidence")).status_code == 404
    assert (await api.client.get(f"/api/v1/evidence/{evidence_id}/download")).status_code == 404
    assert (await api.client.get(f"/api/v1/cases/{case_id}/outcomes")).status_code == 404
    assert (await api.client.get(f"/api/v1/outcomes/{outcome_id}")).status_code == 404
    assert (await api.client.get(f"/api/v1/cases/{case_id}/diagnoses")).status_code == 404
    assert (await api.client.get(f"/api/v1/diagnoses/{diagnosis_id}/status")).status_code == 404
    assert (await api.client.get(f"/api/v1/diagnoses/{diagnosis_id}/recommendations")).status_code == 404
    assert (await api.client.get(f"/api/v1/cases/{case_id}/recommendations")).status_code == 404


async def test_bob_cannot_touch_alice_claim_reservation(api, alice, bob):
    api.set_identity(alice)
    case = await api.make_scenario()
    async with Session() as db:
        await accept_outcome(db, case["outcome"]["id"])
        await db.commit()
    history = (await api.client.get("/api/v1/rewards/history")).json()
    reward_id = history["items"][0]["id"]
    reservation = (await api.client.post(f"/api/v1/rewards/{reward_id}/claim-reservation", json={})).json()

    api.set_identity(bob)
    assert (await api.client.get("/api/v1/claim-reservations")).json()["total"] == 0
    sign = await api.client.post(f"/api/v1/claim-reservations/{reservation['id']}/sign", json={"signed_payload_hash": "ab" * 32})
    assert sign.status_code == 404, sign.text
    submit = await api.client.post(f"/api/v1/claim-reservations/{reservation['id']}/submit", params={"chain_id": 97})
    assert submit.status_code == 404, submit.text
    release = await api.client.post(f"/api/v1/claim-reservations/{reservation['id']}/release")
    assert release.status_code == 404, release.text
    failed = await api.client.post(f"/api/v1/claim-reservations/{reservation['id']}/fail")
    assert failed.status_code == 404, failed.text
    retry = await api.client.post(f"/api/v1/claim-reservations/{reservation['id']}/retry")
    assert retry.status_code == 404, retry.text


async def test_bob_cannot_revoke_or_see_alice_wallet_transactions_notifications(api, alice, bob):
    api.set_identity(alice)
    await api.client.get("/api/v1/auth/me")

    async with Session() as db:
        wallet = await _insert_for(
            db,
            WalletLink,
            user_id=alice.id,
            wallet_address=ADDRESS_A,
            chain_id=97,
            status="verified",
        )
        await _insert_for(
            db,
            Web3Transaction,
            user_id=alice.id,
            tx_type="claim",
            tx_hash="0x" + "ff" * 32,
            chain_id=97,
            status="confirmed",
        )
        await _insert_for(
            db,
            Notification,
            user_id=alice.id,
            type="reward",
            title="Alice private notification",
            message="Only for Alice.",
        )
        await db.commit()

    api.set_identity(bob)
    assert (await api.client.post(f"/api/v1/wallet/{wallet.id}/revoke")).status_code == 404
    txs = (await api.client.get("/api/v1/web3/transactions")).json()
    assert txs["total"] == 0
    notifs = (await api.client.get("/api/v1/notifications")).json()
    assert notifs["total"] == 0

    # Settings are cross-user identity-scoped: Bob's settings are Bob's, never Alice's.
    settings = (await api.client.get("/api/v1/settings")).json()
    assert settings["user_id"] == bob.id


async def test_alice_cannot_read_non_owned_contribution(api, alice, bob):
    api.set_identity(alice)
    contribution = await api.client.post(
        "/api/v1/contributions",
        json={"title": "Alice's fix contribution", "description": "Owned by Alice, must never be visible to Bob."},
    )
    contribution_id = contribution.json()["id"]

    api.set_identity(bob)
    assert (await api.client.get(f"/api/v1/contributions/{contribution_id}")).status_code == 404
    listing = (await api.client.get("/api/v1/contributions")).json()
    assert listing["total"] == 0


async def test_bob_cannot_reserve_or_claim_against_alice_reward(api, alice, bob):
    api.set_identity(alice)
    case = await api.make_scenario()
    async with Session() as db:
        await accept_outcome(db, case["outcome"]["id"])
        await db.commit()
    history = (await api.client.get("/api/v1/rewards/history")).json()
    reward_id = history["items"][0]["id"]

    api.set_identity(bob)
    resp = await api.client.post(f"/api/v1/rewards/{reward_id}/claim-reservation", json={})
    assert resp.status_code in (404, 409), resp.text  # bob learns nothing about alice's reward
    summary = (await api.client.get("/api/v1/rewards/summary")).json()
    assert summary["claimable"] == 0
    assert summary["lifetime_earned"] == 0