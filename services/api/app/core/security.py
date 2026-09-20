import asyncio
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.exceptions import APIError

bearer = HTTPBearer(auto_error=False)


class Identity(BaseModel):
    id: str
    email: str = ""
    display_name: str = "New Solver"


@lru_cache
def jwks_client(url):
    return jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=300, timeout=10)


def verify_token(token: str) -> Identity:
    settings = get_settings()
    if not settings.supabase_url:
        raise APIError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured yet.")
    try:
        key = jwks_client(
            settings.supabase_jwks_url or settings.issuer + "/.well-known/jwks.json"
        ).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            issuer=settings.issuer,
            leeway=30,
            options={"require": ["exp", "sub", "aud", "iss", "iat"]},
        )
        if claims.get("role") != "authenticated":
            raise ValueError("Invalid role")
        return Identity(
            id=str(UUID(claims["sub"])),
            email=claims.get("email", ""),
            display_name=claims.get("user_metadata", {}).get("display_name", "New Solver")[:100],
        )
    except (jwt.PyJWTError, ValueError, KeyError):
        raise APIError(401, "INVALID_TOKEN", "Your session is invalid or expired.") from None


async def get_identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise APIError(401, "AUTH_REQUIRED", "Sign in to continue.")
    return await asyncio.to_thread(verify_token, credentials.credentials)
