import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.api.routes import router
from app.core.config import get_settings
from app.core.exceptions import APIError
from app.core.logging import setup_logging
from app.db.session import Session, engine

setup_logging()

logger = logging.getLogger("puvexa")
settings = get_settings()


@asynccontextmanager
async def lifespan(app):
    if settings.app_env == "production" and (not settings.database_url.startswith("postgresql") or not settings.supabase_url or "*" in settings.cors_origins):
        raise RuntimeError("Production requires PostgreSQL, Supabase authentication, and explicit CORS origins.")
    yield
    await engine.dispose()


app = FastAPI(title="Puvexa API", version="0.3.0", lifespan=lifespan, docs_url="/docs" if settings.app_env != "production" else None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",")], allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type", "X-Request-ID"], allow_credentials=False)


def error(status, code, message, details=None):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details}})


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@app.exception_handler(APIError)
async def api_error(request, exc):
    logger.info("request_failed", extra={"fields": {"request_id": _request_id(request), "error_code": exc.code, "status": exc.status}})
    return error(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Never echo raw input values, tokens, or evidence in validation errors.
    logger.info("validation_failed", extra={"fields": {"request_id": _request_id(request), "error_code": "VALIDATION_ERROR"}})
    return error(422, "VALIDATION_ERROR", "Check the submitted fields.", [{"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]} for e in exc.errors()])


@app.exception_handler(IntegrityError)
async def conflict_error(request, exc):
    logger.warning("integrity_conflict", extra={"fields": {"request_id": _request_id(request), "error_code": "CONFLICT"}})
    return error(409, "CONFLICT", "This operation conflicts with an existing record.")


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    logger.error("request_failed", exc_info=True, extra={"fields": {"request_id": _request_id(request), "error_code": "INTERNAL_ERROR", "exception_type": type(exc).__name__}})
    return error(500, "INTERNAL_ERROR", "The request could not be completed.")


limits = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    # Single-process baseline. Deploy a gateway limit before using multiple replicas.
    if request.method == "POST":
        key = request.client.host if request.client else "unknown"
        current = time.monotonic()
        if len(limits) > 10000:
            for stale in list(limits):
                if not limits[stale] or limits[stale][-1] < current - 60:
                    del limits[stale]
        bucket = limits[key]
        while bucket and bucket[0] < current - 60:
            bucket.popleft()
        if len(bucket) >= 60:
            return error(429, "RATE_LIMITED", "Too many requests. Try again in a minute.")
        bucket.append(current)
        size = request.headers.get("content-length", "0")
        if size.isdigit() and int(size) > (settings.max_upload_mb + 1) * 1024 * 1024:
            return error(413, "REQUEST_TOO_LARGE", "Request exceeds the upload limit.")
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.middleware("http")
async def correlation_id(request: Request, call_next):
    # Keep the caller-provided id (frontend x-request-id) so browser and server logs line up.
    request.state.request_id = request.headers.get("x-request-id") or uuid4().hex[:16]
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    logger.info(
        "request",
        extra={
            "fields": {
                "request_id": request.state.request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": int((time.perf_counter() - start) * 1000),
            }
        },
    )
    return response


@app.get("/health")
async def health():
    try:
        async with Session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "environment": settings.app_env, "database": "connected"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "environment": settings.app_env, "database": "unavailable"})


@app.get("/ready")
async def ready():
    """Readiness surface. Reports only booleans/status words — never URLs or keys."""
    checks: dict = {}

    try:
        async with Session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"

    checks["auth"] = "configured" if settings.supabase_url else "not_configured"
    checks["storage"] = "configured" if (settings.supabase_url and settings.supabase_storage_bucket_evidence) else "not_configured"
    ai_has_key = settings.ai_provider != "unconfigured" and (settings.ai_provider == "mock" or bool(settings.ai_api_key))
    checks["ai_provider"] = "configured" if ai_has_key else "not_configured"

    checks["chain"] = "disabled"
    checks["contracts"] = "disabled"
    if settings.web3_claim_enabled:
        checks["chain"] = "unreachable"
        checks["contracts"] = "invalid"
        if settings.web3_testnet_rpc_url:
            try:
                from web3 import HTTPProvider, Web3

                checks["chain"] = "ok" if Web3(HTTPProvider(settings.web3_testnet_rpc_url, request_kwargs={"timeout": 3})).is_connected() else "unreachable"
            except Exception:
                checks["chain"] = "unreachable"
        addresses = [settings.web3_token_address, settings.web3_distributor_address, settings.web3_stake_vault_address, settings.web3_registry_address]
        checks["contracts"] = "ok" if addresses and all(a.startswith("0x") and len(a) in (42, 40) for a in addresses) and all(a for a in addresses) else "invalid"

    critical = checks["database"] == "ok"
    return JSONResponse(
        status_code=200 if critical else 503,
        content={"status": "ready" if critical else "not_ready", "environment": settings.app_env, "checks": checks},
    )


app.include_router(router)