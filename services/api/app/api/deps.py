import asyncio

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import APIError
from app.core.security import Identity, bearer, get_identity, verify_token
from app.db.models import Profile, UserSettings
from app.db.session import get_db


async def get_current_user(identity: Identity = Depends(get_identity), db: AsyncSession = Depends(get_db)):
    profile = await db.scalar(select(Profile).where(Profile.auth_user_id == identity.id))
    if profile is None:
        # Supabase UUID is also the application profile ID; never accept it from request bodies.
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
        await db.execute(insert(Profile).values(id=identity.id, auth_user_id=identity.id, display_name=identity.display_name).on_conflict_do_nothing())
        await db.execute(insert(UserSettings).values(user_id=identity.id).on_conflict_do_nothing())
        profile = await db.scalar(select(Profile).where(Profile.auth_user_id == identity.id))
    return profile


async def get_optional_identity(credentials=Depends(bearer)):
    """Identity when a bearer token is present; None for guests."""
    if credentials is None:
        return None
    try:
        return await asyncio.to_thread(verify_token, credentials.credentials)
    except APIError:
        return None


async def get_optional_user(identity: Identity | None = Depends(get_optional_identity), db: AsyncSession = Depends(get_db)):
    """Current profile for signed-in users, None for guests."""
    if identity is None:
        return None
    return await get_current_user(identity=identity, db=db)
