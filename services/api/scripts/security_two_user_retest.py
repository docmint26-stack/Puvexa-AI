r"""Two-user security retest against live staging (real Supabase + real DB).

Spawns two real Supabase users (A and B), boots the real FastAPI app as a local
staging server (uvicorn) and proves object-level isolation over real HTTP:

  App-level (live JWT against the running server):
    - anon is rejected (401)
    - B cannot read/see A's case, evidence, diagnosis, contribution, outcome,
      reward, claim, transaction, notification, or settings
    - B's dashboard/rewards/claims/transactions lists never contain A's rows
    - evidence signed URLs exist but B cannot mint or obtain A's URL (404)
    - settings PATCH is strictly per-user

  DB-level (RLS with real role=authenticated claims for A and B):
    - A sees own wallet_links; B sees zero of A's rows

Also reports the wallet API-flow status honestly: signature verification is
engineered to be DISABLED until `wallet_signature_verifier=eip191` is opted in,
so live wallet linking is BLOCKED by design (never accepts unverified sigs).

Run from services/api with .venv:
  .\.venv\Scripts\python.exe scripts\security_two_user_retest.py
Exit 0 only if all applicable checks pass. Prints no secrets.
"""
import asyncio
import secrets
import struct
import sys
import uuid
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.core.config import get_settings  # noqa: E402

RESULTS: list[tuple[str, bool, str]] = []


def report(name: str, ok: bool, note: str = "") -> None:
    RESULTS.append((name, ok, note))
    print(f"  [{'PASS' if ok else 'BLOCKED'}] {name}" + (f"  ({note})" if note else ""), flush=True)


def fake_png() -> bytes:
    raw = b"screenshot evidence for security retest"
    w = h = 32

    def chunk(tag: bytes, d: bytes) -> bytes:
        c = tag + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    rows = b"".join(b"\x00" + raw[:w] + b"\x00" * (w * 2) for _ in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


async def bootstrap() -> tuple[list[dict], None]:
    s = get_settings()
    base = s.supabase_url.rstrip("/")
    pub, sec = s.supabase_anon_key, s.supabase_service_role_key
    hp = {"apikey": pub, "Authorization": f"Bearer {pub}", "Content-Type": "application/json"}
    hs = {"apikey": sec, "Authorization": f"Bearer {sec}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        users = []
        for label in ("A", "B"):
            email = f"retest.{label}.{uuid.uuid4().hex[:8]}@supabase-staging.dev"
            password = "Retest-Pass-2026!staging"
            r = await c.post(f"{base}/auth/v1/admin/users", headers=hs, json={"email": email, "password": password, "email_confirm": True, "user_metadata": {"display_name": f"Retest {label}"}})
            if r.status_code not in (200, 201):
                raise RuntimeError(f"seed {label}: {r.status_code} {r.text[:120]}")
            uid = r.json()["id"]
            r = await c.post(f"{base}/auth/v1/token?grant_type=password", headers=hp, json={"email": email, "password": password})
            if r.status_code != 200:
                raise RuntimeError(f"signin {label}: {r.status_code}")
            users.append({"id": uid, "token": r.json()["access_token"]})
        created = [u["id"] for u in users]
        yield users, None
        for uid in created:
            try:
                await c.delete(f"{base}/auth/v1/admin/users/{uid}", headers=hs)
            except Exception:
                pass


async def app_level(users: list[dict], port: int = 8857) -> None:
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--log-level",
        "warning",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        async with httpx.AsyncClient(timeout=40) as c:
            for _ in range(40):
                try:
                    if (await c.get(f"{base}/ready")).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.5)
            else:
                raise RuntimeError("staging api did not become ready")

            a, b = users[0], users[1]
            ha = {"Authorization": f"Bearer {a['token']}"}
            hb = {"Authorization": f"Bearer {b['token']}"}
            ids: dict[str, str] = {}

            r_anon = await c.get(f"{base}/api/v1/cases")
            report("anon rejected on protected routes", r_anon.status_code in (401, 403), f"status {r_anon.status_code}")

            r = await c.post(f"{base}/api/v1/cases", headers=ha, json={"title": "Retest hydration mismatch case", "description": "User A created this private case for the security retest scenario.", "category": "Coding Error", "severity": "medium", "environment": {"node": "20"}})
            ids["case"] = r.json()["id"]
            report("A creates case", r.status_code == 201, f"status {r.status_code}")
            report("A reads own case", (await c.get(f"{base}/api/v1/cases/{ids['case']}", headers=ha)).status_code == 200)
            report("B cannot read A's case", (await c.get(f"{base}/api/v1/cases/{ids['case']}", headers=hb)).status_code == 404, "404 owned()")
            report("anon cannot read A's case", (await c.get(f"{base}/api/v1/cases/{ids['case']}")).status_code in (401, 403))

            r = await c.post(f"{base}/api/v1/cases/{ids['case']}/evidence", headers=ha, data={"evidence_type": "log", "text_content": "hydration mismatch between server and client rendering of current time"})
            ids["evidence"] = r.json()["id"]
            report("A uploads text evidence", r.status_code == 201, f"status {r.status_code}")
            report("B cannot list A's evidence", (await c.get(f"{base}/api/v1/cases/{ids['case']}/evidence", headers=hb)).status_code == 404, "404 owned()")
            report("B cannot download A's evidence", (await c.get(f"{base}/api/v1/evidence/{ids['evidence']}/download", headers=hb)).status_code == 404)

            r = await c.post(f"{base}/api/v1/cases/{ids['case']}/evidence", headers=ha, files={"file": ("screen.png", fake_png(), "image/png")}, data={"evidence_type": "screenshot"})
            file_ev = r.json()
            report("A uploads screenshot evidence", r.status_code == 201, f"status {r.status_code}")
            r = await c.get(f"{base}/api/v1/evidence/{file_ev['id']}/download", headers=ha)
            url = (r.json().get("url") or "") if r.status_code == 200 else ""
            scoped = f"users/{a['id']}/cases/{ids['case']}/" in url and "/object/sign/" in url
            report("A downloads own signed URL", r.status_code == 200 and scoped and r.json().get("expires_in") == 60, "60s capability token under A's folder")
            report("B cannot mint signed URL for A's file", (await c.get(f"{base}/api/v1/evidence/{file_ev['id']}/download", headers=hb)).status_code == 404)

            r = await c.post(f"{base}/api/v1/cases/{ids['case']}/diagnose", headers=ha)
            ids["diagnosis"] = r.json()["id"]
            report("A diagnoses case", r.status_code == 201, f"status {r.status_code}")
            report("A reads own diagnosis", (await c.get(f"{base}/api/v1/diagnoses/{ids['diagnosis']}", headers=ha)).status_code == 200)
            report("B cannot read A's diagnosis", (await c.get(f"{base}/api/v1/diagnoses/{ids['diagnosis']}", headers=hb)).status_code == 404)
            report("B cannot read A's diagnosis sources", (await c.get(f"{base}/api/v1/diagnoses/{ids['diagnosis']}/sources", headers=hb)).status_code == 404)

            r = await c.post(f"{base}/api/v1/contributions", headers=ha, json={"contribution_type": "new_fix", "title": "Render timestamp in effect after mount", "description": "User A contributed a fix that avoids server/client mismatch for time display.", "case_id": ids["case"]})
            ids["contribution"] = r.json()["id"]
            report("A creates contribution", r.status_code == 201, f"status {r.status_code}")
            report("B cannot read A's contribution", (await c.get(f"{base}/api/v1/contributions/{ids['contribution']}", headers=hb)).status_code == 404)
            r = await c.get(f"{base}/api/v1/contributions", headers=hb)
            report("B's contributions list excludes A's", ids["contribution"] not in {x["id"] for x in r.json()["items"]}, "user-scoped")

            r = await c.get(f"{base}/api/v1/notifications", headers=ha)
            notifs = [n["id"] for n in r.json()["items"]]
            hidden = True
            for nid in notifs:
                if (await c.get(f"{base}/api/v1/notifications/{nid}", headers=hb)).status_code != 404:
                    hidden = False
                    break
            report("A's notifications inaccessible to B", bool(notifs) and hidden, "owned() 404 on every A notification")

            report("A saves dark theme", (await c.patch(f"{base}/api/v1/settings", headers=ha, json={"theme": "dark"})).status_code == 200)
            report("B saves light theme", (await c.patch(f"{base}/api/v1/settings", headers=hb, json={"theme": "light"})).status_code == 200)
            theme_a = (await c.get(f"{base}/api/v1/settings", headers=ha)).json().get("theme")
            report("B's settings change does not touch A", theme_a == "dark", f"A theme still {theme_a}")

            addr = "0x" + uuid.uuid4().hex[:40]
            r = await c.post(f"{base}/api/v1/wallet/challenge", headers=ha, json={"address": addr, "chain_id": 97})
            nonce = r.json().get("nonce") if r.status_code == 201 else None
            report("A wallet challenge (nonce issued)", r.status_code == 201, f"status {r.status_code}")
            r = await c.post(f"{base}/api/v1/wallet/verify", headers=ha, json={"address": addr, "chain_id": 97, "signature": "0x" + "ab" * 32, "nonce": nonce or ""})
            if get_settings().wallet_signature_verifier in (None, "", "none"):
                report("wallet verify refused (verifier disabled by design)", r.status_code in (400, 422, 403, 503), f"status {r.status_code}; safety invariant: enable eip191 to opt in")

            from app.db.models import (  # noqa: PLC0415
                ClaimReservation,
                Fix,
                FixAttempt,
                Outcome,
                RewardLedger,
                Web3Transaction,
            )
            from app.db.session import Session  # noqa: PLC0415

            async with Session() as db:
                fix_row = Fix(
                    title="Render timestamps after mount to avoid hydration mismatch",
                    summary="Defer time-dependent rendering to the client after hydration.",
                    instructions=["Render the timestamp via useEffect once mounted."],
                    category="Coding Error",
                    source_type="curated",
                )
                db.add(fix_row)
                await db.flush()
                fa = FixAttempt(case_id=ids["case"], fix_id=str(fix_row.id), user_id=a["id"], notes="security retest attempt")
                db.add(fa)
                await db.flush()
                oc = Outcome(case_id=ids["case"], fix_attempt_id=str(fa.id), user_id=a["id"], reported_result="resolved", verification_method="self report", verification_confidence=0.2, verification_status="pending", before_data={}, after_data={})
                db.add(oc)
                await db.flush()
                oc_id = str(oc.id)
                rw = RewardLedger(user_id=a["id"], event_type="fix_accepted", reference_type="outcome", reference_id=oc_id, amount=2.5, status="claimable", reason="retest reward", idempotency_key=f"retest-{uuid.uuid4()}")
                db.add(rw)
                await db.flush()
                rw_id = str(rw.id)
                claim_id = "0x" + secrets.token_hex(32)
                cr = ClaimReservation(reward_id=rw_id, user_id=a["id"], state="reserved", chain_id=97, claim_id=claim_id)
                db.add(cr)
                await db.flush()
                cr_id = str(cr.id)
                tx = Web3Transaction(user_id=a["id"], claim_id=claim_id, tx_type="claim", tx_hash="0x" + uuid.uuid4().hex, chain_id=97, status="submitted")
                db.add(tx)
                await db.flush()
                tx_hash = tx.tx_hash
                await db.commit()
                seeded = {"outcome": oc_id, "reward": rw_id, "claim": claim_id, "claim_row": cr_id, "tx": tx_hash}

            report("outcome seeded for A", True, "")
            report("B cannot read A's outcome", (await c.get(f"{base}/api/v1/outcomes/{seeded['outcome']}", headers=hb)).status_code == 404, "404 owned()")
            r_claim = await c.get(f"{base}/api/v1/web3/claims/{seeded['claim']}", headers=hb)
            report("B claim lookup for A's claim 404", r_claim.status_code == 404, "404 user-scoped")
            b_claims = {x["id"] for x in (await c.get(f"{base}/api/v1/web3/claims", headers=hb)).json().get("items", [])}
            report("B web3 claims exclude A's", seeded["claim_row"] not in b_claims)
            b_txs = {x["tx_hash"] for x in (await c.get(f"{base}/api/v1/web3/transactions", headers=hb)).json().get("items", [])}
            report("B web3 transactions exclude A's", seeded["tx"] not in b_txs)
            b_rewards = {x["id"] for x in (await c.get(f"{base}/api/v1/rewards/history", headers=hb)).json().get("items", [])}
            report("B reward history excludes A's", seeded["reward"] not in b_rewards)
            b_reservations = {x["id"] for x in (await c.get(f"{base}/api/v1/claim-reservations", headers=hb)).json().get("items", [])}
            report("B claim reservations exclude A's", seeded["claim_row"] not in b_reservations)
            b_recent = {cc["id"] for cc in (await c.get(f"{base}/api/v1/dashboard", headers=hb)).json()["recent_cases"]["items"]}
            report("B dashboard hides A's case", ids["case"] not in b_recent, "user-scoped dashboard")

            r = await c.delete(f"{base}/api/v1/cases/{ids['case']}", headers=ha)
            report("cleanup A's case (cascades evidence/outcome)", r.status_code == 200, f"status {r.status_code}")
    finally:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=10)
        except asyncio.TimeoutError:
            proc.kill()


async def db_level(users: list[dict]) -> None:
    import asyncpg  # noqa: PLC0415

    s = get_settings()
    dsn = s.database_url.replace("+asyncpg", "")
    a, b = users[0], users[1]
    conn = await asyncpg.connect(dsn, timeout=20)
    try:
        async def as_user(uid, fn):
            async with conn.transaction():
                await conn.execute("set local role authenticated")
                claims = '{"sub":"%s","role":"authenticated"}' % uid
                try:
                    await conn.execute("set local request.jwt.claims = '%s'" % claims.replace("'", "''"))
                except Exception:
                    pass
                await conn.execute("set local request.jwt.claim.sub = '%s'" % uid)
                return await fn()

        wallet_a = "0x" + uuid.uuid4().hex[:40]
        await conn.execute("delete from wallet_links where user_id = $1::uuid", a["id"])
        await conn.execute(
            "insert into wallet_links (id,user_id,wallet_address,chain_id,status,created_at,updated_at) values ($1,$2,$3,97,'verified',now(),now())",
            str(uuid.uuid4()),
            a["id"],
            wallet_a,
        )

        async def wallet_counts():
            return (
                await conn.fetchval("select count(*) from wallet_links where user_id = $1::uuid", a["id"]),
                await conn.fetchval("select count(*) from wallet_links where user_id = $1::uuid", b["id"]),
                await conn.fetchval("select count(*) from wallet_links"),
                await conn.fetchval("select count(*) from profiles where auth_user_id = $1::uuid", b["id"]),
            )

        mine, other, total, b_profile = await as_user(a["id"], wallet_counts)
        report("RLS: A sees own wallet", mine == 1, f"count {mine}")
        report("RLS: A sees zero of B's wallets", other == 0, f"count {other}")
        report("RLS: A cannot enumerate other wallets", total == 1, f"count {total}")
        report("RLS: A cannot read B's profile", b_profile == 0, f"count {b_profile}")

        async def b_only():
            return await conn.fetchval("select count(*) from wallet_links")

        other_view = await as_user(b["id"], b_only)
        report("RLS: B sees zero wallets (none are B's)", other_view == 0, f"count {other_view}")
    finally:
        await conn.close()


async def main() -> None:
    agen = bootstrap()
    users, _ = await anext(agen)
    try:
        print("Two-user security retest (project:", get_settings().supabase_url.split("//")[-1].split(".")[0], ")", flush=True)
        await app_level(users)
        await db_level(users)
    finally:
        try:
            await anext(agen)
        except StopAsyncIteration:
            pass


if __name__ == "__main__":
    asyncio.run(main())
    bad = [r for r in RESULTS if not r[1]]
    print(f"\nSecurity retest: {len(RESULTS) - len(bad)}/{len(RESULTS)} PASS; blocked={[n for n, ok, _ in bad]}", flush=True)
    sys.exit(1 if bad else 0)