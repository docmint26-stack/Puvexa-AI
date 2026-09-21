"""Secret and sensitive data redaction for Puvexa AI.

Ensures credentials, API keys, JWTs, private keys, database URLs, and auth headers
are redacted before sending logs/code/text to external AI providers.
"""
import re

PATTERNS = [
    # 1. Private keys (PEM format)
    (
        "private_key",
        re.compile(r"-----BEGIN [A-Z0-9_\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9_\s]+PRIVATE KEY-----"),
        "[REDACTED_PRIVATE_KEY]",
    ),
    # 2. OpenAI / Anthropic / Generic API keys (sk-...)
    (
        "api_key_sk",
        re.compile(r"\b(sk-[a-zA-Z0-9_\-]{20,})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 3. Google / Gemini API keys (AIza...)
    (
        "google_api_key",
        re.compile(r"\b(AIza[0-9A-Za-z\-_]{35})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 3b. Gemini API keys (new AI Studio format: AQ.<40+ base64url chars>)
    (
        "gemini_aq_api_key",
        re.compile(r"\b(AQ\.[0-9A-Za-z\-_]{20,})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 4. AWS Access Key IDs
    (
        "aws_access_key",
        re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "[REDACTED_AWS_KEY]",
    ),
    # 5. JWT tokens (Header.Payload.Signature starting with ey...)
    (
        "jwt_token",
        re.compile(r"\b(ey[a-zA-Z0-9_-]{10,}\.ey[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+)\b"),
        "[REDACTED_JWT]",
    ),
    # 6. Database / Service Connection URIs with credentials (postgres, mysql, redis, etc.)
    (
        "db_connection_string",
        re.compile(r"(?i)((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s:@]+:)([^\s:@]+)(@[^\s]+)"),
        r"\1[REDACTED]\3",
    ),
    # 7. Authorization header (Bearer / Basic / Token — scheme and value collapsed)
    (
        "auth_header",
        re.compile(r"(?i)(authorization\s*:\s*)(?:bearer|basic|token)?\s*[^\r\n]+"),
        r"\1[REDACTED]",
    ),
    # 8. Cookies (Cookie / Set-Cookie headers)
    (
        "cookie_header",
        re.compile(r"(?i)((?:set-cookie|cookie)\s*:\s*)[^\r\n]+"),
        r"\1[REDACTED_COOKIE]",
    ),
    # 9. Key-value secrets (e.g. password=..., api_key=..., client_secret=..., JSON "password": "..." and "password" : "x")
    (
        "kv_secret",
        re.compile(
            r"(?i)\b((?:password|passwd|pwd|secret|api_key|apikey|auth_token|client_secret|access_token|private_token)\s*[\"']?\s*[:=]\s*[\"']?)([^\"'\s\r\n]{4,})([\"']?)"
        ),
        r"\1[REDACTED]\3",
    ),
    # 10. Generic high-entropy hex/base64 tokens in env-style lines (e.g. TOKEN=a8f9c...)
    (
        "env_token",
        re.compile(r"(?i)\b([A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASS)[A-Z0-9_]*\s*=\s*[\"']?)([a-zA-Z0-9_\-\.]{16,})([\"']?)"),
        r"\1[REDACTED]\3",
    ),
    # 11. GitHub tokens (ghp_ PAT, gho_, ghu_, ghs_, ghr_)
    (
        "github_token",
        re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{35,})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 12. npm access tokens
    (
        "npm_token",
        re.compile(r"\b(npm_[a-zA-Z0-9]{35,})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 13. Slack tokens (xoxb-, xoxa-, xoxp-, xoxr-, xoxs-)
    (
        "slack_token",
        re.compile(r"\b(xox[a-z]-[a-zA-Z0-9-]{10,})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 14. Stripe secret keys (live and test)
    (
        "stripe_token",
        re.compile(r"\b(sk_(?:live|test)_[a-zA-Z0-9]{16,})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 15. Telegram bot tokens (1234567:AA...)
    (
        "telegram_token",
        re.compile(r"\b(\d{5,}:[a-zA-Z0-9_-]{30,})\b"),
        "[REDACTED_API_KEY]",
    ),
]


def redact_secrets(text: str) -> tuple[str, list[str]]:
    """Redacts known secret patterns from the provided text.

    Returns:
        tuple[str, list[str]]: (sanitized_text, list_of_detected_secret_categories)
    """
    if not text:
        return "", []

    sanitized = text
    detected: list[str] = []

    for category, pattern, replacement in PATTERNS:
        if pattern.search(sanitized):
            detected.append(category)
            sanitized = pattern.sub(replacement, sanitized)

    return sanitized, detected


def has_secrets(text: str) -> bool:
    """Checks whether any secret patterns match the text."""
    if not text:
        return False
    return any(pattern.search(text) for _, pattern, _ in PATTERNS)

