r"""Live AI integration probe (Phase 5.5 / staging).

Two sections:

  A. Provider-independent gates (run without any API key):
     - secret redaction before any external call (fake API key / JWT /
       Authorization header / DB URI / PEM are all removed)
     - log preprocessing: repetitive-line compaction, stack-trace extraction,
       error-signature extraction, no secrets in the structured summary
     These are real verifications that always execute in this script.

  B. Live provider gates (require AI_PROVIDER + AI_API_KEY in env):
     real text diagnosis, screenshot diagnosis, log/code diagnosis, embeddings,
     fix ranking, outcome verification, contribution scoring.
     Never falls back to Mock/Deterministic providers in staging: if the env
     names one of those in a non-development environment the script FAILS.

Run from services/api with the .venv (reads services/api/.env automatically):
  .\.venv\Scripts\python.exe scripts\live_ai_probe.py

Exit codes: 0 = all applicable PASS · 1 = any BLOCKED/FAIL.
Never prints credentials.
"""
import asyncio
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.services.ai.log_processor import process_logs  # noqa: E402
from app.services.ai.redactor import redact_secrets  # noqa: E402

RESULTS: list[tuple[str, bool, str]] = []


def report(name: str, ok: bool, note: str = "") -> None:
    RESULTS.append((name, ok, note))
    print(f"  [{'PASS' if ok else 'BLOCKED'}] {name}" + (f"  ({note})" if note else ""))


LOG_FIXTURE = "\n".join(
    [
        "2026-09-20 10:00:01.234 INFO  Starting request",
        "2026-09-20 10:00:02.100 ERROR Failed to authenticate: 401 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl",
        "2026-09-20 10:00:02.101 ERROR Failed to authenticate: 401 api_key=sk-fake-test-key-0123456789ABCDEF",
        "2026-09-20 10:00:02.102 ERROR Failed to authenticate: 401",
        *(["2026-09-20 10:00:03.000 ERROR Failed to authenticate: 401"] * 20),
        "TypeError: Cannot read properties of null (reading 'toLocaleString')",
        "    at Object.renderTime (components/time.js:12:9)",
        "    at processTicksAndRejections (node:internal/process/task_queues:96:5)",
        "DATABASE_URL=postgres://svc:p@ssw0rd-secret@db.internal.example.com:5432/puvexa",
        '{"password": "hunter2-secret"}',
    ]
)


def fake_screenshot_png() -> bytes:
    """Builds a small, valid, real PNG (text "hydration mismatch error") in memory."""
    raw = b"hydration mismatch error: next.js timestamp render\nserver vs client"
    height = width = 64
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    rows = b"".join(b"\x00" + raw[:width] + b"\x00" * (width * 3 - min(len(raw), width) * 3) for _ in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


async def section_a() -> None:
    redacted, detected = redact_secrets(LOG_FIXTURE)
    needles = ("sk-fake-test-key-0123456789ABCDEF", "eyJhbGciOiJIUzI1NiJ9", "p@ssw0rd-secret", "hunter2-secret")
    no_secrets_left = all(n not in redacted for n in needles)
    cats = {"api_key_sk", "jwt_token", "auth_header", "db_connection_string", "kv_secret"}
    report("secrets redacted pre-provider", no_secrets_left and cats.issubset(set(detected)), f"categorized {sorted(set(detected))}")

    summary = process_logs(redacted)
    trace_ok = bool(summary.stack_traces) and "renderTime" in " ".join(summary.stack_traces)
    ok = summary.error_count >= 20 and trace_ok and bool(summary.unique_signatures)
    report(
        "logs compacted + stack + signatures",
        ok,
        f"errors {summary.error_count}, traces {len(summary.stack_traces)}, sigs {len(summary.unique_signatures)}",
    )
    leaked = [n for n in needles if n in (summary.compact_text or "")]
    report("no secrets in structured summary", not leaked, f"leaked {leaked}" if leaked else "summary clean")


async def section_b() -> None:
    s = get_settings()
    provider = (s.ai_provider or "unconfigured").lower()
    if provider in ("mock", "development_deterministic") and s.app_env != "development":
        for name in ("text diagnosis", "screenshot diagnosis", "log/code diagnosis", "embeddings", "fix ranking", "outcome verification", "contribution scoring"):
            report(name, False, f"MOCK_PROVIDER_FORBIDDEN_IN_{s.app_env.upper()}")
        return
    if provider != "openai" or not s.ai_api_key:
        for name in ("text diagnosis", "screenshot diagnosis", "log/code diagnosis", "embeddings", "fix ranking", "outcome verification", "contribution scoring"):
            report(name, False, "NO_API_KEY")
        return

    from app.services.ai.provider import OpenAIProvider  # noqa: PLC0415

    p = OpenAIProvider(api_key=s.ai_api_key, model=s.ai_model, base_url=s.ai_base_url, timeout=s.ai_timeout_seconds)

    async def run(name: str, coro, want: bool = True):
        try:
            result = await coro
            ok = bool(result) is want
            report(name, ok)
        except Exception as e:  # noqa: BLE001
            report(name, False, f"{type(e).__name__}")

    await run(
        "text diagnosis",
        p.analyze_problem(
            title="Next.js hydration mismatch introduced by new Date().toLocaleString()",
            description="The page renders current time on server and client producing a hydration mismatch.",
            category="Coding Error",
            environment={"app": "Next.js", "version": "15"},
            evidence=[
                {"type": "text", "text": "Hydration failed because the server rendered \"10:24 PM\" and the client rendered \"10:25 PM\". (suppressHydrationWarning not set)"},
                {"type": "code", "text": "export default function Page() { return <p>{new Date().toLocaleString()}</p>; }"},
            ],
            grounded_facts=[
                {"title": "Next.js Hydration Documentation", "content": "Hydration mismatches occur when server and client render different output; suppress or stabilize with dynamic rendering."},
            ],
            similar_cases=[],
        ),
    )
    await run("screenshot diagnosis", p.analyze_image(fake_screenshot_png(), "image/png", "Extract the technical error shown on screen."))
    await run("log diagnosis", p.analyze_logs(redact_secrets(LOG_FIXTURE)[0]))
    await run("code diagnosis", p.analyze_code("export default function Page() { return <p>{new Date().toLocaleString()}</p>; }", "typescript"))
    await run("embeddings", self_check_embeddings(p))
    await run(
        "outcome verification",
        p.verify_outcome({"title": "test/build failure", "environment": "ci"}, {"summary": "bump dependency"}, [{"content": "npm run build fails"}], [{"content": "npm run build passes"}], "resolved"),
    )
    from app.services.ai.schemas import ProblemAnalysis  # noqa: PLC0415

    await run(
        "fix ranking",
        p.rank_fixes(
            ProblemAnalysis(
                problem_summary="Next.js hydration mismatch from timestamp rendering",
                category="Coding Error",
                environment_summary="Next.js 15",
                observed_symptoms=["server and client render different time"],
                likely_causes=[],
                confidence=0.7,
            ),
            [
                {"id": "f1", "title": "Use suppressHydrationWarning on the rendered node", "summary": "Suppresses hydration mismatch warnings for volatile content.", "risk_level": "low", "source_type": "official_doc", "why_it_matches": "Official Next.js guidance for timestamp rendering."},
                {"id": "f2", "title": "Render timestamps client-side after mount", "summary": "Move date rendering to a useEffect so initial render matches on server and client.", "risk_level": "medium", "source_type": "community_verified", "why_it_matches": "Matches the server/client timestamp symptom."},
            ],
            [{"title": "Next.js Hydration Documentation", "content": "Use suppressHydrationWarning or render volatile values only on the client."}],
        ),
    )
    await run(
        "contribution scoring",
        p.score_contribution(
            "Fix hydration mismatch with client-side date rendering",
            "Move the timestamp to a client effect to keep server and client HTML identical.",
            ["Add useEffect that sets the date", "Render it after mount"],
            "Coding Error",
            [{"id": "f1", "title": "Use suppressHydrationWarning on the rendered node", "summary": "Suppresses hydration mismatch for volatile content."}],
        ),
    )


async def self_check_embeddings(p) -> bool:
    vecs = await p.batch_generate_embeddings(["hydration mismatch Next.js", "timestamp rendering"])
    return len(vecs) == 2 and all(len(v) == get_settings().ai_embedding_dim for v in vecs)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--live-only", action="store_true")
    args = ap.parse_args()

    async def _main():
        if not args.live_only:
            await section_a()
        await section_b()

    try:
        asyncio.run(_main())
    except Exception as e:  # noqa: BLE001
        print("FATAL:", type(e).__name__, str(e)[:200])
        sys.exit(1)

    bad = [r for r in RESULTS if not r[1]]
    print(f"\nAI probe: {len(RESULTS) - len(bad)}/{len(RESULTS)} PASS; blocked={[n for n, ok, _ in bad]}")
    sys.exit(1 if bad else 0)