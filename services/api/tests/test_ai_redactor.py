"""Unit tests for secret and sensitive data redaction."""
from app.services.ai.redactor import has_secrets, redact_secrets


def test_redact_openai_api_key():
    raw = "Here is my key: sk-abcdef1234567890abcdef1234567890 please keep it safe."
    redacted, cats = redact_secrets(raw)
    assert "sk-abcdef" not in redacted
    assert "[REDACTED_API_KEY]" in redacted
    assert "api_key_sk" in cats


def test_redact_google_api_key():
    raw = "GEMINI_API_KEY=AIzaSyD-1234567890123456789012345678901"
    redacted, cats = redact_secrets(raw)
    assert "AIzaSyD" not in redacted
    assert "[REDACTED_API_KEY]" in redacted
    assert "google_api_key" in cats


def test_redact_gemini_aq_api_key():
    raw = "GEMINI_API_KEY=AQ.TEST_ONLY_NOT_A_REAL_KEY_xxxxxxxxxxxxxxxxxxxxxxxx please keep safe."
    redacted, cats = redact_secrets(raw)
    assert "TEST_ONLY_NOT_A_REAL_KEY_xxxxxxxxxxxxxxxxxxxxxxxx" not in redacted
    assert "[REDACTED_API_KEY]" in redacted
    assert "gemini_aq_api_key" in cats


def test_redact_aws_access_key():
    raw = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE"
    redacted, cats = redact_secrets(raw)
    assert "AKIAIOSFODNN7EXAMPLE" not in redacted
    assert "[REDACTED_AWS_KEY]" in redacted
    assert "aws_access_key" in cats


def test_redact_jwt_token():
    raw = "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    redacted, cats = redact_secrets(raw)
    assert "eyJhbGciOiJI" not in redacted
    assert "[REDACTED_JWT]" in redacted
    assert "jwt_token" in cats


def test_redact_database_connection_string():
    raw = "DATABASE_URL=postgresql://appuser:super_secret_pw123@db.supabase.co:5432/puvexa"
    redacted, cats = redact_secrets(raw)
    assert "super_secret_pw123" not in redacted
    assert "postgresql://appuser:[REDACTED]@db.supabase.co:5432/puvexa" in redacted
    assert "db_connection_string" in cats


def test_redact_authorization_header():
    raw = "GET /api/v1/cases HTTP/1.1\nAuthorization: Bearer secret_bearer_token_xyz\nHost: puvexa.ai"
    redacted, cats = redact_secrets(raw)
    assert "secret_bearer_token_xyz" not in redacted
    assert "Authorization: [REDACTED]" in redacted


def test_redact_private_key():
    raw = """-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz0123456789
-----END RSA PRIVATE KEY-----"""
    redacted, cats = redact_secrets(raw)
    assert "MIIEowIBAAKCAQEA0Y1" not in redacted
    assert "[REDACTED_PRIVATE_KEY]" in redacted
    assert "private_key" in cats


def test_redact_kv_passwords():
    raw = '{"username": "admin", "password": "MySecretPassword!2026", "timeout": 30}'
    redacted, cats = redact_secrets(raw)
    assert "MySecretPassword!2026" not in redacted
    assert '"password": "[REDACTED]"' in redacted


def test_has_secrets_detects_secrets():
    assert has_secrets("export OPENAI_API_KEY=sk-123456789012345678901234567890")
    assert not has_secrets("console.log('User signed in successfully');")


def test_redact_authorization_collapses_scheme_variants():
    for scheme in ("Bearer", "Basic", "Token"):
        raw = f"Authorization: {scheme} abcdef_secret_value_123"
        redacted, cats = redact_secrets(raw)
        assert "abcdef_secret_value_123" not in redacted
        assert redacted == "Authorization: [REDACTED]"
        assert "auth_header" in cats


def test_redact_cookie_and_set_cookie_headers():
    raw = "Set-Cookie: session=abc123supersecret; HttpOnly\nCookie: theme=dark; auth=zzz999"
    redacted, cats = redact_secrets(raw)
    assert "abc123supersecret" not in redacted
    assert "zzz999" not in redacted
    assert "[REDACTED_COOKIE]" in redacted
    assert "cookie_header" in cats


def test_redact_env_style_high_entropy_tokens():
    raw = "DB_PASSWORD=SuperSecretPass123\nMY_TOKEN=abcdef0123456789abcdef"
    redacted, cats = redact_secrets(raw)
    assert "SuperSecretPass123" not in redacted
    assert "abcdef0123456789abcdef" not in redacted
    assert "env_token" in cats


def test_redact_platform_tokens():
    cases = {
        "github": ("ghp_" + "A" * 36, "github_token"),
        "npm": ("npm_" + "b" * 36, "npm_token"),
        "slack": ("xoxb-" + "1" * 12 + "-" + "a" * 16, "slack_token"),
        "stripe": ("sk_live_" + "c" * 24, "stripe_token"),
        "telegram": ("123456789:" + "D" * 35, "telegram_token"),
    }
    for label, (token, category) in cases.items():
        redacted, cats = redact_secrets(f"Credential value {token} end")
        assert token not in redacted, f"{label} token leaked"
        assert category in cats, f"{label} category not detected"
        assert "[REDACTED_API_KEY]" in redacted


def test_redact_is_idempotent():
    raw = "password=hunter2secret and sk-abcdef1234567890abcdef1234567890"
    once, _ = redact_secrets(raw)
    twice, _ = redact_secrets(once)
    assert once == twice

