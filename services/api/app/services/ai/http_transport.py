"""Bounded provider HTTP requests with safe, stable public error codes."""
import asyncio

import httpx

from app.core.config import get_settings
from app.core.exceptions import APIError


async def provider_post(url: str, api_key: str, payload: dict, timeout: float):
    attempts = get_settings().ai_retry_count + 1
    for attempt in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
            if response.status_code == 200:
                try:
                    return response.json()
                except ValueError:
                    raise APIError(502, "VALIDATION_FAILED", "Provider returned invalid JSON.") from None
            detail = ""
            try:
                body = response.json()
                err = body.get("error", {})
                detail = str(err.get("message", "")) if isinstance(err, dict) else str(err)
            except ValueError:
                detail = response.text[:200]
            detail = (" " + detail.strip().replace("\n", " ")[:200]) if detail.strip() else ""
            code = "AI_PROVIDER_RATE_LIMIT" if response.status_code == 429 else "AI_PROVIDER_ERROR"
            if response.status_code < 500 and response.status_code != 429:
                raise APIError(502, "AI_PROVIDER_ERROR", f"AI provider could not complete this request.{detail}") from None
            raise APIError(502, code, f"AI provider could not complete this request.{detail}") from None
        except httpx.TimeoutException:
            code = "AI_PROVIDER_TIMEOUT"
        except httpx.RequestError:
            code = "AI_PROVIDER_ERROR"
        if attempt + 1 == attempts:
            raise APIError(502, code, "AI provider could not complete this request.")
        await asyncio.sleep(min(0.25 * 2 ** attempt, 2))
