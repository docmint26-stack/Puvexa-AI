r"""Supabase staging smoke checks (real project).

Exercises the configured live Supabase project end to end and reports PASS/BLOCKED
for each step without ever printing credentials:

  1. Auth API health            GET  /auth/v1/health
  2. JWKS endpoint              GET  /auth/v1/.well-known/jwks.json
  3. Admin seed user (secret)   POST /auth/v1/admin/users (email_confirm=true)
  4. Sign-in                    POST /auth/v1/token?grant_type=password
  5. Backend JWT verification   decode via app.core.security (JWKS, aud=authenticated)
  6. Storage bucket (secret)    POST /storage/v1/bucket (puvexa-evidence)

Run from services/api with the .venv (reads services/api/.env automatically):
  .\.venv\Scripts\python.exe scripts\staging_smoke.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from uuid import uuid4  # noqa: E402

import httpx  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import jwks_client  # noqa: E402

EXPECTED_BUCKET = "puvexa-evidence"


def step(label: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "BLOCKED"
    print(f"  [{status}] {label}" + (f"  ({detail})" if detail else ""))


def short(x: str | None, n: int = 12) -> str:
    return (x or "")[:n] + "…"


async def main() -> None:
    s = get_settings()
    base = s.supabase_url.rstrip("/")
    if not base or not s.supabase_service_role_key or not s.supabase_anon_key:
        print(
            "Supabase env not configured (SUPABASE_URL / SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)."
        )
        sys.exit(2)

    pub = s.supabase_anon_key
    sec = s.supabase_service_role_key
    headers_pub = {"apikey": pub, "Authorization": f"Bearer {pub}", "Content-Type": "application/json"}
    headers_sec = {"apikey": sec, "Authorization": f"Bearer {sec}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as c:
        # 1. health
        try:
            r = await c.get(f"{base}/auth/v1/health", headers={"apikey": pub})
            step("auth health", r.status_code == 200, f"status {r.status_code}")
        except Exception as e:
            step("auth health", False, type(e).__name__)

        # 2. jwks
        try:
            r = await c.get(f"{base}/auth/v1/.well-known/jwks.json", headers={"apikey": pub})
            keys = r.json().get("keys", []) if r.status_code == 200 else []
            step("jwks endpoint", r.status_code == 200 and len(keys) >= 1, f"{len(keys)} keys")
        except Exception as e:
            step("jwks endpoint", False, type(e).__name__)

        # 3. create a throwaway smoke user via the admin API (secret key, confirmed,
        #    no confirmation email needed). NOTE: public sign-up is available too but
        #    requires SMTP/email confirmation in this project.
        email = f"smoke.{uuid4().hex[:10]}@supabase-staging.dev"
        password = "Smoke-Pass-2026!staging"
        try:
            r = await c.post(
                f"{base}/auth/v1/admin/users",
                headers=headers_sec,
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"display_name": "Staging Smoke"},
                },
            )
            body = r.json()
            user_id = (body.get("id") or "").strip()
            ok = r.status_code in (200, 201) and bool(user_id)
            step(
                "admin seed user (secret key)",
                ok,
                f"status {r.status_code}, user {short(user_id)}"
                if ok
                else f"{body.get('msg') or body.get('error') or r.status_code}",
            )
            if not ok:
                sys.exit(1)
        except Exception as e:
            step("admin seed user (secret key)", False, type(e).__name__)
            sys.exit(1)

        # 4. sign in
        try:
            r = await c.post(
                f"{base}/auth/v1/token?grant_type=password",
                headers=headers_pub,
                json={"email": email, "password": password},
            )
            body = r.json()
            token = (body.get("access_token") or "").strip()
            ok = r.status_code == 200 and token
            step("sign-in (password grant)", ok, f"status {r.status_code}")
            if not ok:
                sys.exit(1)
        except Exception as e:
            step("sign-in (password grant)", False, type(e).__name__)
            sys.exit(1)

        # 5. backend JWT verification (exact app code path)
        try:
            key = jwks_client(
                s.supabase_jwks_url or s.issuer + "/.well-known/jwks.json"
            ).get_signing_key_from_jwt(token)
            claims = _decode_claims(token, key.key)
            step(
                "backend JWT verification",
                claims.get("sub") == user_id and claims.get("aud") == "authenticated",
                f"sub {short(claims.get('sub'))}",
            )
        except Exception as e:
            step("backend JWT verification", False, type(e).__name__)

        # 6. storage bucket availability (create idempotently with secret key)
        try:
            r = await c.post(
                f"{base}/storage/v1/bucket",
                headers=headers_sec,
                json={"id": EXPECTED_BUCKET, "name": EXPECTED_BUCKET, "public": False},
            )
            if r.status_code in (200, 201):
                step("storage bucket", True, f"bucket {EXPECTED_BUCKET} ready")
            elif r.status_code in (400, 409) and ("already exists" in r.text or r.status_code == 409):
                step("storage bucket", True, "already exists")
            else:
                step("storage bucket", False, f"status {r.status_code} {r.text[:80]}")
        except Exception as e:
            step("storage bucket", False, type(e).__name__)

        # 7. in-app auth path: /auth/me with the live token via the real FastAPI app
        try:
            from fastapi.testclient import TestClient  # noqa: PLC0415

            from app.main import app as fastapi_app  # noqa: PLC0415

            with TestClient(fastapi_app) as tc:
                resp = tc.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
            ok = resp.status_code == 200 and resp.json().get("id") == user_id
            step("in-app /auth/me (live JWT)", ok, f"status {resp.status_code}")
        except Exception as e:
            step("in-app /auth/me (live JWT)", False, type(e).__name__)

        # 8. cleanup the seeded smoke user (keep the project tidy)
        try:
            r = await c.delete(f"{base}/auth/v1/admin/users/{user_id}", headers=headers_sec)
            step("cleanup smoke user", r.status_code in (200, 204), f"status {r.status_code}")
        except Exception as e:
            step("cleanup smoke user", False, type(e).__name__)


def _decode_claims(token: str, key) -> dict:
    import jwt

    return jwt.decode(
        token,
        key,
        algorithms=["RS256", "ES256"],
        audience="authenticated",
        issuer=get_settings().issuer,
        leeway=30,
        options={"require": ["exp", "sub", "aud", "iss", "iat"]},
    )


if __name__ == "__main__":
    print("Supabase staging smoke (project:", get_settings().supabase_url.split("//")[-1].split(".")[0], ")")
    asyncio.run(main())
