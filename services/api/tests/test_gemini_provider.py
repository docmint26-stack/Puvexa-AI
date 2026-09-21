"""Offline unit tests for GeminiProvider (injected fake client, no network)."""
import math
from types import SimpleNamespace

import pytest

from app.core.config import get_settings
from app.core.exceptions import APIError
from app.services.ai.provider import GeminiProvider, UnconfiguredAIProvider, get_ai_provider

AQ_KEY = "AQ.TEST_ONLY_NOT_A_REAL_KEY_xxxxxxxxxxxxxxxxxxxxxxxx"

PROBLEM_JSON = """{
  "problem_summary": "Hydration mismatch from timestamp rendering",
  "category": "Coding Error",
  "subcategory": "React / Next.js",
  "environment_summary": "Next.js 15",
  "observed_symptoms": ["server and client render different time"],
  "likely_causes": [{"title": "Volatile timestamp on initial render", "explanation": "toLocaleString() differs between server and client", "confidence": 0.9}],
  "missing_information": [],
  "risk_flags": [],
  "search_queries": [],
  "confidence": 0.8
}"""

VISION_JSON = """{
  "app_or_framework": "Next.js",
  "error_family": "hydration mismatch",
  "visible_message": "Hydration failed because the server rendered different markup",
  "error_code": "500",
  "ui_state": "error overlay",
  "environment_context": {"browser": "chrome"},
  "confidence": 0.9
}"""


class _FakeModels:
    def __init__(self):
        self.gen_response = lambda **kw: SimpleNamespace(
            text=PROBLEM_JSON,
            usage_metadata=SimpleNamespace(prompt_token_count=10, response_token_count=5),
        )
        self.emb_response = None
        self.last_gen = None
        self.last_emb = None

    def generate_content(self, **kwargs):
        self.last_gen = kwargs
        return self.gen_response(**kwargs)

    def embed_content(self, **kwargs):
        self.last_emb = kwargs
        if self.emb_response is not None:
            return self.emb_response(**kwargs)
        dim = kwargs["config"].output_dimensionality or 1536
        n = len(kwargs.get("contents", []))
        return SimpleNamespace(embeddings=[SimpleNamespace(values=[round(math.sin((i + j) * 1e-3), 6) for j in range(dim)]) for i in range(n)])


class _FakeClient:
    def __init__(self, models=None, fail=None):
        self.models = models or _FakeModels()
        self._fail = fail

    def raise_if_fail(self):
        if self._fail is not None:
            raise self._fail


def _provider(fake) -> GeminiProvider:
    return GeminiProvider(api_key=AQ_KEY, model="gemini-2.5-flash", vision_model="gemini-2.5-flash",
                          embedding_model="gemini-embedding-001", embedding_dim=1536, timeout=5.0, client=fake)


def test_gemini_provider_factory_requires_key(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    assert isinstance(get_ai_provider(settings), UnconfiguredAIProvider)
    monkeypatch.setattr(settings, "gemini_api_key", AQ_KEY)
    assert isinstance(get_ai_provider(settings), GeminiProvider)


async def test_gemini_generate_embedding_requests_dim_and_redacts():
    fake = _FakeClient()
    provider = _provider(fake)
    vec = await provider.generate_embedding(f"password={AQ_KEY} hydration mismatch")
    assert len(vec) == 1536
    norm = math.sqrt(sum(x * x for x in vec))
    assert abs(norm - 1.0) < 1e-3
    assert fake.models.last_emb["model"] == "gemini-embedding-001"
    assert fake.models.last_emb["config"].output_dimensionality == 1536
    assert AQ_KEY not in " ".join(fake.models.last_emb["contents"])


async def test_gemini_embedding_wrong_dimension_raises():
    fake = _FakeClient()
    fake.models.emb_response = lambda **kw: SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1] * 3000)])
    provider = _provider(fake)
    with pytest.raises(APIError) as exc_info:
        await provider.generate_embedding("text")
    assert exc_info.value.code == "VALIDATION_FAILED"


async def test_gemini_batch_embedding_wrong_count_raises():
    fake = _FakeClient()
    fake.models.emb_response = lambda **kw: SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1] * 1536)])
    provider = _provider(fake)
    with pytest.raises(APIError) as exc_info:
        await provider.batch_generate_embeddings(["a", "b"])
    assert exc_info.value.code == "VALIDATION_FAILED"


async def test_gemini_analyze_problem_structured_and_metrics():
    fake = _FakeClient()
    provider = _provider(fake)
    fake.models.gen_response = lambda **kw: SimpleNamespace(
        text=PROBLEM_JSON,
        usage_metadata=SimpleNamespace(prompt_token_count=22, response_token_count=11),
    )
    result, metrics = await provider.analyze_problem(
        title="Next.js hydration mismatch",
        description="Timestamp renders differently per environment",
        category="Coding Error",
        environment={"app": "Next.js", "version": "15"},
        evidence=[{"type": "text", "text": f"token={AQ_KEY} render mismatch"}],
        grounded_facts=[{"title": "Docs", "content": "stabilize volatile output"}],
        similar_cases=[],
    )
    assert result.problem_summary == "Hydration mismatch from timestamp rendering"
    assert result.likely_causes[0].title == "Volatile timestamp on initial render"
    assert metrics.provider == "gemini"
    assert metrics.input_tokens == 22
    assert metrics.output_tokens == 11
    assert metrics.prompt_version == "2026.09.1"
    contents = fake.models.last_gen["contents"]
    config = fake.models.last_gen["config"]
    assert AQ_KEY not in contents
    assert config.response_mime_type == "application/json"
    assert config.response_schema is not None
    assert fake.models.last_gen["model"] == "gemini-2.5-flash"


async def test_gemini_analyze_image_multimodal():
    fake = _FakeClient()
    provider = _provider(fake)
    fake.models.gen_response = lambda **kw: SimpleNamespace(
        text=VISION_JSON,
        usage_metadata=SimpleNamespace(prompt_token_count=8, response_token_count=4),
    )
    result, metrics = await provider.analyze_image(b"\x89PNG\r\n\x1a\nfakepng", "image/png", "read the error")
    assert result.error_family == "hydration mismatch"
    assert result.confidence == 0.9
    assert metrics.provider == "gemini"
    assert metrics.model == "gemini-2.5-flash"


async def test_gemini_analyze_image_rejects_unsupported_mime():
    provider = _provider(_FakeClient())
    with pytest.raises(APIError) as exc_info:
        await provider.analyze_image(b"not-an-image", "image/gif")
    assert exc_info.value.status == 422


async def test_gemini_quota_error_maps_to_rate_limit():
    from google.genai import errors

    quota = errors.APIError(
        code=429,
        response_json={"error": {"message": "Quota exceeded for metric 'generativelanguage.googleapis.com/gemini_api_requests' and time range '1 second'. Please retry."}},
    )
    fake = _FakeClient()
    fake._fail = quota
    fake.models.gen_response = lambda **kw: fake.raise_if_fail()
    provider = _provider(fake)
    with pytest.raises(APIError) as exc_info:
        await provider.analyze_logs("boom")
    assert exc_info.value.code == "AI_PROVIDER_RATE_LIMIT"
    assert "Quota exceeded" in exc_info.value.message
    assert AQ_KEY not in exc_info.value.message


async def test_gemini_secret_never_leaks_into_error():
    from google.genai import errors

    server = errors.APIError(code=500, response_json={"error": {"message": "internal"}})
    fake = _FakeClient()
    fake._fail = server
    fake.models.gen_response = lambda **kw: fake.raise_if_fail()
    provider = _provider(fake)
    with pytest.raises(APIError) as exc_info:
        await provider.analyze_problem(
            title="x", description=f"password={AQ_KEY}", category="z", environment={},
            evidence=[], grounded_facts=[],
        )
    assert exc_info.value.code == "AI_PROVIDER_ERROR"
    assert AQ_KEY not in exc_info.value.message


async def test_gemini_invalid_json_output_raises_validation_failed():
    fake = _FakeClient()
    provider = _provider(fake)
    fake.models.gen_response = lambda **kw: SimpleNamespace(
        text="this is not json",
        usage_metadata=SimpleNamespace(prompt_token_count=1, response_token_count=1),
    )
    with pytest.raises(APIError) as exc_info:
        await provider.verify_outcome({}, {}, [], [], "resolved")
    assert exc_info.value.code == "VALIDATION_FAILED"