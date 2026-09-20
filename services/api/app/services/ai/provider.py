"""AI Provider abstraction layer for Puvexa AI.

Provides a unified interface (AIProvider Protocol) decoupling the platform
from specific LLM vendors. Supports OpenAIProvider, MockAIProvider, and
UnconfiguredAIProvider for safe operation without an API key.
"""
import base64
import hashlib
import json
import math
import time
from dataclasses import asdict, dataclass
from typing import Protocol

from app.core.config import Settings, get_settings
from app.core.exceptions import APIError
from app.services.ai.http_transport import provider_post
from app.services.ai.log_processor import process_logs
from app.services.ai.prompts import (
    PROMPT_VERSION_CONTRIBUTION,
    PROMPT_VERSION_DIAGNOSIS,
    PROMPT_VERSION_RANKING,
    PROMPT_VERSION_VERIFICATION,
    SYSTEM_PROMPT_DIAGNOSIS,
    build_grounded_context_block,
    build_user_evidence_block,
)
from app.services.ai.redactor import redact_secrets
from app.services.ai.sandbox import analyze_code_snippet
from app.services.ai.schemas import (
    ContributionScore,
    FixRankingResult,
    ImageAnalysis,
    LikelyCause,
    ProblemAnalysis,
    RankedFixOutput,
    VerificationAnalysis,
)
from app.services.ai.validators import validate_and_parse

PROMPT_VERSION_VISION = "vision_v1"
PROMPT_VERSION_LOGS = "logs_v1"
PROMPT_VERSION_CODE = "code_v1"


@dataclass
class AIRunMetrics:
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    estimated_cost_usd: float = 0.0
    provider: str = "mock"
    model: str = "test-model"
    prompt_version: str = "1.0"


class AIProvider(Protocol):
    async def analyze_problem(
        self,
        title: str,
        description: str,
        category: str,
        environment: dict,
        evidence: list[dict],
        grounded_facts: list[dict],
        similar_cases: list[dict] | None = None,
    ) -> tuple[ProblemAnalysis, AIRunMetrics]: ...

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str = "",
    ) -> tuple[ImageAnalysis, AIRunMetrics]: ...

    async def analyze_logs(self, log_text: str) -> tuple[dict, AIRunMetrics]: ...

    async def analyze_code(self, code_text: str, language: str | None = None) -> tuple[dict, AIRunMetrics]: ...

    async def rank_fixes(
        self,
        problem: ProblemAnalysis,
        candidate_fixes: list[dict],
        grounded_context: list[dict],
    ) -> tuple[FixRankingResult, AIRunMetrics]: ...

    async def verify_outcome(
        self,
        case_info: dict,
        fix_info: dict,
        before_evidence: list[dict],
        after_evidence: list[dict],
        reported_result: str,
    ) -> tuple[VerificationAnalysis, AIRunMetrics]: ...

    async def score_contribution(
        self,
        title: str,
        description: str,
        steps: list[str],
        category: str,
        existing_fixes: list[dict],
    ) -> tuple[ContributionScore, AIRunMetrics]: ...

    async def summarize_evidence(self, evidence_items: list[dict]) -> str: ...

    async def generate_embedding(self, text: str) -> list[float]: ...

    async def batch_generate_embeddings(self, texts: list[str]) -> list[list[float]]: ...


class UnconfiguredAIProvider:
    """Safe provider used when no API key or provider is configured."""

    async def analyze_problem(self, *args, **kwargs) -> tuple[ProblemAnalysis, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def analyze_image(self, *args, **kwargs) -> tuple[ImageAnalysis, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def analyze_logs(self, *args, **kwargs) -> tuple[dict, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def analyze_code(self, *args, **kwargs) -> tuple[dict, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def rank_fixes(self, *args, **kwargs) -> tuple[FixRankingResult, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def verify_outcome(self, *args, **kwargs) -> tuple[VerificationAnalysis, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def score_contribution(self, *args, **kwargs) -> tuple[ContributionScore, AIRunMetrics]:
        raise APIError(422, "AI_PROVIDER_NOT_CONFIGURED", "AI diagnosis engine is not configured in this environment.")

    async def summarize_evidence(self, *args, **kwargs) -> str:
        return "AI analysis unavailable: provider not configured."

    async def generate_embedding(self, text: str) -> list[float]:
        # Fallback to zero vector for unconfigured provider
        return [0.0] * get_settings().ai_embedding_dim

    async def batch_generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * get_settings().ai_embedding_dim for _ in texts]


def generate_deterministic_embedding(text: str, dim: int = 1536) -> list[float]:
    """Generates a deterministic unit-normalized pseudo-embedding for testing."""
    vec = [0.0] * dim
    words = text.lower().split()
    if not words:
        vec[0] = 1.0
        return vec

    for idx, word in enumerate(words):
        h = int(hashlib.sha256(word.encode("utf-8")).hexdigest()[:8], 16)
        pos = h % dim
        vec[pos] += 1.0 / (idx + 1)

    # Normalize to unit length
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [round(x / norm, 6) for x in vec]
    else:
        vec[0] = 1.0
    return vec


class MockAIProvider:
    """High-fidelity deterministic AI provider for offline evaluation, unit tests, and local dev."""

    def __init__(self, model_name: str = "mock-deterministic"):
        self.model_name = model_name

    async def generate_embedding(self, text: str) -> list[float]:
        return generate_deterministic_embedding(text, get_settings().ai_embedding_dim)

    async def batch_generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        return [generate_deterministic_embedding(t, get_settings().ai_embedding_dim) for t in texts]

    async def analyze_logs(self, log_text: str) -> tuple[dict, AIRunMetrics]:
        summary = process_logs(log_text)
        return {
            "total_lines": summary.total_lines,
            "error_count": summary.error_count,
            "signatures": summary.unique_signatures,
            "stack_traces": summary.stack_traces,
            "compact_text": summary.compact_text,
        }, AIRunMetrics(input_tokens=100, output_tokens=50, latency_ms=5, provider="mock", model=self.model_name)

    async def analyze_code(self, code_text: str, language: str | None = None) -> tuple[dict, AIRunMetrics]:
        analysis = analyze_code_snippet(code_text, language)
        return {
            "language": analysis.language,
            "framework": analysis.framework,
            "has_unsafe_patterns": analysis.has_unsafe_patterns,
            "imports": analysis.imports,
            "summary": analysis.summary,
        }, AIRunMetrics(input_tokens=80, output_tokens=40, latency_ms=4, provider="mock", model=self.model_name)

    async def analyze_image(self, image_bytes: bytes, mime_type: str, prompt: str = "") -> tuple[ImageAnalysis, AIRunMetrics]:
        return ImageAnalysis(
            app_or_framework="Next.js",
            error_family="hydration mismatch",
            visible_message="Text content does not match server-rendered HTML",
            error_code=None,
            ui_state="Hydration Error Overlay",
            environment_context={"framework": "Next.js 15", "client": "Browser"},
            confidence=0.92,
        ), AIRunMetrics(input_tokens=200, output_tokens=60, latency_ms=10, provider="mock", model=self.model_name)

    async def summarize_evidence(self, evidence_items: list[dict]) -> str:
        if not evidence_items:
            return "No evidence attached."
        types = [e.get("type", "unknown") for e in evidence_items]
        return f"Evaluated {len(evidence_items)} evidence items: {', '.join(types)}."

    async def analyze_problem(
        self,
        title: str,
        description: str,
        category: str,
        environment: dict,
        evidence: list[dict],
        grounded_facts: list[dict],
        similar_cases: list[dict] | None = None,
    ) -> tuple[ProblemAnalysis, AIRunMetrics]:
        start = time.perf_counter()
        lower = f"{title} {description} {category}".lower()

        # Deterministic domain matching
        if "hydration" in lower or "server-rendered" in lower or "next" in lower:
            analysis = ProblemAnalysis(
                problem_summary="Next.js hydration mismatch caused by client/server state discrepancy.",
                category="Coding Error",
                subcategory="React / Next.js",
                environment_summary=f"Next.js app on {environment.get('os', 'Unknown OS')}",
                observed_symptoms=["Server HTML differs from client initial render", "Hydration error warning in browser console"],
                likely_causes=[
                    LikelyCause(
                        title="Dynamic or Locale-Dependent Date/Time Rendering",
                        explanation="Rendering dates with new Date().toLocaleString() produces differing server vs client strings.",
                        confidence=0.91,
                        supporting_evidence=["Visible hydration mismatch message"],
                    ),
                    LikelyCause(
                        title="Browser-Only API Accessed During SSR",
                        explanation="Accessing window, localStorage, or document directly during initial render pass.",
                        confidence=0.74,
                        supporting_evidence=["Next.js SSR environment detected"],
                    ),
                ],
                missing_information=["Does the error occur only in production or also in dev?", "Is date/time or window.innerWidth being rendered directly in JSX?"],
                risk_flags=[],
                search_queries=["Next.js hydration mismatch date locale", "suppressHydrationWarning Next.js"],
                confidence=0.89,
            )
        elif "modulenotfound" in lower or "import" in lower or "python" in lower:
            analysis = ProblemAnalysis(
                problem_summary="Python ModuleNotFoundError: target package is missing or interpreter path is unaligned.",
                category="Coding Error",
                subcategory="Python Environment",
                environment_summary="Python virtual environment",
                observed_symptoms=["ModuleNotFoundError or ImportError on startup", "Interpreter fails to resolve dependency"],
                likely_causes=[
                    LikelyCause(
                        title="Dependency Not Installed in Active Environment",
                        explanation="The package is not installed inside the currently active virtual environment.",
                        confidence=0.94,
                        supporting_evidence=["ModuleNotFoundError signature"],
                    ),
                    LikelyCause(
                        title="VS Code Interpreter Path Mismatch",
                        explanation="VS Code or terminal is running global Python instead of the workspace virtual environment.",
                        confidence=0.78,
                        supporting_evidence=["Python environment reported"],
                    ),
                ],
                missing_information=["Is virtualenv activated?", "Which Python executable is running (`which python` or `where python`)?"],
                risk_flags=[],
                search_queries=["Python ModuleNotFoundError fix active virtualenv", "VS Code select python interpreter"],
                confidence=0.92,
            )
        elif "port" in lower or "docker" in lower or "collision" in lower or "bind" in lower:
            analysis = ProblemAnalysis(
                problem_summary="Docker container port collision: target host port is already bound by another process.",
                category="Apps & Productivity",
                subcategory="Docker",
                environment_summary="Docker container runtime",
                observed_symptoms=["Bind for 0.0.0.0 failed: port is already allocated", "Container failed to start"],
                likely_causes=[
                    LikelyCause(
                        title="Orphaned or Running Container on Same Port",
                        explanation="A previous container or local service is already listening on the specified port.",
                        confidence=0.95,
                        supporting_evidence=["Port allocation failure in log"],
                    ),
                ],
                missing_information=["Which port is conflicting (e.g. 8000, 5432)?", "Is a background system daemon running on this port?"],
                risk_flags=[],
                search_queries=["Docker port is already allocated find conflicting process", "docker ps conflicting ports"],
                confidence=0.93,
            )
        elif "wi-fi" in lower or "wifi" in lower or "driver" in lower:
            analysis = ProblemAnalysis(
                problem_summary="Wi-Fi adapter disconnects after Windows driver update.",
                category="Network & Wi-Fi",
                subcategory="Wireless Adapter",
                environment_summary=f"Windows OS ({environment.get('os', 'Windows')})",
                observed_symptoms=["Wi-Fi drops periodically", "Network adapter reset events in system log"],
                likely_causes=[
                    LikelyCause(
                        title="Network Driver Regression After Windows Update",
                        explanation="The updated wireless adapter driver has a power-management or stability regression.",
                        confidence=0.86,
                        supporting_evidence=["Recent update noted in environment"],
                    ),
                    LikelyCause(
                        title="Aggressive Power Saving Mode",
                        explanation="Windows power management is turning off the adapter to save power.",
                        confidence=0.58,
                        supporting_evidence=["Periodic disconnect intervals"],
                    ),
                ],
                missing_information=["Exact network adapter model from Device Manager", "Does connection drop on other devices?"],
                risk_flags=["Requires administrative privileges for driver rollback"],
                search_queries=["Rollback Wi-Fi driver Windows 11 Device Manager", "Wi-Fi keeps disconnecting after Windows update"],
                confidence=0.85,
            )
        elif "xlookup" in lower or "excel" in lower or "#n/a" in lower:
            analysis = ProblemAnalysis(
                problem_summary="Excel XLOOKUP returns #N/A due to trailing whitespace or text/number type mismatch.",
                category="Apps & Productivity",
                subcategory="Excel Formulas",
                environment_summary="Spreadsheet / Excel",
                observed_symptoms=["Formula returns #N/A even though lookup value appears visually present"],
                likely_causes=[
                    LikelyCause(
                        title="Whitespace / Formatting Discrepancy",
                        explanation="Lookup key contains invisible trailing spaces or non-breaking spaces.",
                        confidence=0.88,
                        supporting_evidence=["XLOOKUP #N/A reported"],
                    ),
                    LikelyCause(
                        title="Data Type Mismatch (Number vs Text)",
                        explanation="One column stores IDs as numbers while lookup column stores them as text strings.",
                        confidence=0.82,
                        supporting_evidence=["Visual match without formula resolution"],
                    ),
                ],
                missing_information=["Are cells formatted as General, Text, or Number?"],
                risk_flags=[],
                search_queries=["Excel XLOOKUP #N/A whitespace TRIM", "Excel text number mismatch XLOOKUP"],
                confidence=0.87,
            )
        else:
            analysis = ProblemAnalysis(
                problem_summary=f"Technical issue identified: {title}",
                category=category or "Apps & Productivity",
                subcategory=None,
                environment_summary=str(environment),
                observed_symptoms=[description[:100]],
                likely_causes=[
                    LikelyCause(
                        title="Primary Root Cause Hypothesis",
                        explanation=f"Based on reported symptoms: {description[:120]}",
                        confidence=0.72,
                        supporting_evidence=["User description"],
                    ),
                ],
                missing_information=["Additional system logs or output details"],
                risk_flags=[],
                search_queries=[f"{title} troubleshooting"],
                confidence=0.70,
            )

        latency = int((time.perf_counter() - start) * 1000)
        metrics = AIRunMetrics(
            input_tokens=250,
            output_tokens=150,
            latency_ms=latency,
            estimated_cost_usd=0.0001,
            provider="mock",
            model=self.model_name,
            prompt_version=PROMPT_VERSION_DIAGNOSIS,
        )
        return analysis, metrics

    async def rank_fixes(
        self,
        problem: ProblemAnalysis,
        candidate_fixes: list[dict],
        grounded_context: list[dict],
    ) -> tuple[FixRankingResult, AIRunMetrics]:
        start = time.perf_counter()
        ranked: list[RankedFixOutput] = []

        for idx, fix in enumerate(candidate_fixes, 1):
            source_type = fix.get("source_type", "curated")
            sample_size = fix.get("sample_size", 0)
            verified_rate = fix.get("verified_success_rate")

            # Determine trust label (Section 61 & 86)
            if sample_size >= 5 and verified_rate is not None:
                trust_label = "Outcome-Backed Fix"
                stat_status = f"{int(verified_rate * 100)}% verified success across {sample_size} outcomes"
            elif source_type == "official_doc":
                trust_label = "Official Guidance"
                stat_status = "Curated from official documentation"
            elif source_type == "curated":
                trust_label = "Curated Fix"
                stat_status = "Curated technical guidance"
            else:
                trust_label = "AI Suggestion"
                stat_status = "Not enough verified outcomes yet"

            # Match score and rank score
            ctx_match = round(max(0.65, 0.95 - (idx - 1) * 0.1), 2)
            ai_conf = round(max(0.60, problem.confidence - (idx - 1) * 0.08), 2)
            rank_score = round(ctx_match * 0.6 + ai_conf * 0.4, 2)

            ranked.append(
                RankedFixOutput(
                    fix_id=fix.get("id"),
                    rank=idx,
                    title=fix.get("title", f"Fix #{idx}"),
                    summary=fix.get("summary", ""),
                    steps=fix.get("steps") or fix.get("instructions") or ["Apply recommended configuration changes"],
                    risk_level=fix.get("risk_level", "low"),
                    effort_level=fix.get("effort_level", "low"),
                    source_type=source_type,
                    trust_label=trust_label,
                    context_match_score=ctx_match,
                    ai_confidence=ai_conf,
                    rank_score=rank_score,
                    explanation=fix.get("why_it_matches") or f"Directly addresses {problem.problem_summary}",
                    why_it_matches=fix.get("why_it_matches") or f"Matched symptoms in {problem.category}",
                    prerequisites=fix.get("prerequisites", []),
                    rollback_steps=fix.get("rollback_steps", ["Revert changes"]),
                    requires_admin=fix.get("requires_root_or_admin", False),
                    verified_success_rate=verified_rate,
                    sample_size=sample_size,
                    statistical_status=stat_status,
                )
            )

        latency = int((time.perf_counter() - start) * 1000)
        metrics = AIRunMetrics(
            input_tokens=300,
            output_tokens=200,
            latency_ms=latency,
            estimated_cost_usd=0.00015,
            provider="mock",
            model=self.model_name,
            prompt_version=PROMPT_VERSION_RANKING,
        )
        return (
            FixRankingResult(
                ranked_fixes=ranked,
                ranking_rationale=f"Ranked {len(ranked)} candidate solutions prioritizing verified historical outcomes and official guidance.",
                similar_cases_considered=len(grounded_context),
                top_root_cause_addressed=problem.likely_causes[0].title if problem.likely_causes else "Root Cause",
            ),
            metrics,
        )

    async def verify_outcome(
        self,
        case_info: dict,
        fix_info: dict,
        before_evidence: list[dict],
        after_evidence: list[dict],
        reported_result: str,
    ) -> tuple[VerificationAnalysis, AIRunMetrics]:
        start = time.perf_counter()
        has_after_output = any(e.get("type") in ("output", "test_result", "diagnostic") for e in after_evidence)

        if reported_result == "resolved":
            if has_after_output:
                status = "verified"
                conf = 0.92
                quality = "strong"
                method = "coding_test_diff" if case_info.get("category") == "Coding Error" else "diagnostic_signal_check"
                summary = "Objective post-fix evidence confirms resolution. Test/diagnostic signals succeeded."
            else:
                status = "partially_verified"
                conf = 0.65
                quality = "medium"
                method = "self_report_observation"
                summary = "User reported resolved; provisional verification pending observation window completion."
        elif reported_result == "partially_resolved":
            status = "partially_verified"
            conf = 0.50
            quality = "medium"
            method = "self_report_partial"
            summary = "Partial resolution recorded by solver."
        else:
            status = "failed"
            conf = 0.85
            quality = "strong" if has_after_output else "medium"
            method = "failure_signal"
            summary = "Post-fix execution did not eliminate the error."

        latency = int((time.perf_counter() - start) * 1000)
        metrics = AIRunMetrics(
            input_tokens=180,
            output_tokens=80,
            latency_ms=latency,
            estimated_cost_usd=0.00008,
            provider="mock",
            model=self.model_name,
            prompt_version=PROMPT_VERSION_VERIFICATION,
        )
        return (
            VerificationAnalysis(
                verification_status=status,
                verification_method=method,
                verification_confidence=conf,
                summary=summary,
                evidence_quality=quality,
                reproducible_signals=["output_clean" if status == "verified" else "none"],
                observation_hours_needed=24 if status == "partially_verified" else 0,
            ),
            metrics,
        )

    async def score_contribution(
        self,
        title: str,
        description: str,
        steps: list[str],
        category: str,
        existing_fixes: list[dict],
    ) -> tuple[ContributionScore, AIRunMetrics]:
        start = time.perf_counter()
        # Duplicate detection check
        title_lower = title.lower()
        duplicate_id = None
        duplicate_prob = 0.0

        for fix in existing_fixes:
            fix_title = str(fix.get("title", "")).lower()
            # Simple word intersection overlap
            words1 = set(title_lower.split())
            words2 = set(fix_title.split())
            overlap = len(words1 & words2) / max(1, len(words1 | words2))
            if overlap > 0.6:
                duplicate_id = str(fix.get("id"))
                duplicate_prob = round(overlap, 2)
                break

        fraud_risk = 0.05
        if duplicate_prob > 0.7:
            rec = "suggest_improvement"
        elif fraud_risk > 0.5:
            rec = "needs_manual_review"
        else:
            rec = "accept"

        latency = int((time.perf_counter() - start) * 1000)
        metrics = AIRunMetrics(
            input_tokens=150,
            output_tokens=70,
            latency_ms=latency,
            estimated_cost_usd=0.00007,
            provider="mock",
            model=self.model_name,
            prompt_version=PROMPT_VERSION_CONTRIBUTION,
        )
        return (
            ContributionScore(
                novelty=round(1.0 - duplicate_prob, 2),
                evidence_quality=0.85,
                verification_strength=0.80,
                utility=0.90,
                fraud_risk=fraud_risk,
                duplicate_probability=duplicate_prob,
                overall_value=round(0.85 * (1.0 - duplicate_prob * 0.5), 2),
                duplicate_fix_id=duplicate_id,
                duplicate_summary=f"Matches existing fix {duplicate_id}" if duplicate_id else None,
                recommendation=rec,
                model_version="contrib_v1",
            ),
            metrics,
        )


class OpenAIProvider:
    """Production provider integrating with OpenAI REST API via httpx."""

    def __init__(self, api_key: str, model: str | None = None, base_url: str = "https://api.openai.com/v1", timeout: float = 30.0):
        self.api_key = api_key
        self.model = model or get_settings().ai_model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.vision_model = get_settings().ai_vision_model
        self.embedding_model = get_settings().ai_embedding_model

    async def generate_embedding(self, text: str) -> list[float]:
        clean_text, _ = redact_secrets(text)
        data = await provider_post(f"{self.base_url}/embeddings", self.api_key,
                                   {"input": clean_text[:8000], "model": self.embedding_model,
                                    "dimensions": get_settings().ai_embedding_dim}, self.timeout)
        return self._embedding_vectors(data, 1)[0]

    async def batch_generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        clean_texts = [redact_secrets(t)[0][:8000] for t in texts]
        data = await provider_post(f"{self.base_url}/embeddings", self.api_key,
                                   {"input": clean_texts, "model": self.embedding_model,
                                    "dimensions": get_settings().ai_embedding_dim}, self.timeout)
        return self._embedding_vectors(data, len(texts))

    def _embedding_vectors(self, data, count):
        try:
            vectors = [item["embedding"] for item in sorted(data["data"], key=lambda row: row.get("index", 0))]
            if len(vectors) != count or any(len(v) != get_settings().ai_embedding_dim or
                    not all(isinstance(x, (int, float)) and math.isfinite(x) for x in v) for v in vectors):
                raise ValueError("Invalid embedding shape")
            return vectors
        except (KeyError, TypeError, ValueError):
            raise APIError(502, "VALIDATION_FAILED", "Provider returned invalid embeddings.") from None

    async def analyze_problem(
        self,
        title: str,
        description: str,
        category: str,
        environment: dict,
        evidence: list[dict],
        grounded_facts: list[dict],
        similar_cases: list[dict] | None = None,
    ) -> tuple[ProblemAnalysis, AIRunMetrics]:
        start = time.perf_counter()
        # Redact secrets before sending to OpenAI
        clean_title, _ = redact_secrets(title)
        clean_desc, _ = redact_secrets(description)
        clean_evidence = [{"type": e.get("type", "text"), "text": redact_secrets(e.get("text", ""))[0]} for e in evidence]

        user_block = build_user_evidence_block(clean_title, clean_desc, category, environment, clean_evidence)
        facts_block = build_grounded_context_block(grounded_facts, similar_cases or [])

        system_msg = SYSTEM_PROMPT_DIAGNOSIS + "\nRequired JSON schema:\n" + json.dumps(ProblemAnalysis.model_json_schema())
        user_prompt = f"{facts_block}\n\n{user_block}\n\nDiagnose the root cause and output strict JSON matching the ProblemAnalysis schema."
        user_prompt = redact_secrets(user_prompt)[0][:get_settings().ai_max_evidence_chars]

        data = await provider_post(f"{self.base_url}/chat/completions", self.api_key, {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                }, self.timeout)
        try:
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            in_tokens = usage.get("prompt_tokens", 0)
            out_tokens = usage.get("completion_tokens", 0)
        except (KeyError, IndexError, TypeError):
            raise APIError(502, "VALIDATION_FAILED", "AI response has an invalid structure.") from None

        model_res, repaired, err = validate_and_parse(content, ProblemAnalysis)
        if model_res is None:
            raise APIError(502, "VALIDATION_FAILED", "AI response failed structured validation.")

        latency = int((time.perf_counter() - start) * 1000)
        metrics = AIRunMetrics(
            input_tokens=in_tokens,
            output_tokens=out_tokens,
            latency_ms=latency,
            estimated_cost_usd=((in_tokens * get_settings().ai_input_cost_per_million
                                 + out_tokens * get_settings().ai_output_cost_per_million) / 1_000_000
                                if get_settings().ai_cost_tracking_enabled else 0.0),
            provider="openai",
            model=self.model,
            prompt_version=PROMPT_VERSION_DIAGNOSIS,
        )
        return model_res, metrics

    def _metrics(self, in_tokens: int, out_tokens: int, latency_ms: int, prompt_version: str, model: str | None = None) -> AIRunMetrics:
        s = get_settings()
        cost = (
            (in_tokens * s.ai_input_cost_per_million + out_tokens * s.ai_output_cost_per_million) / 1_000_000
            if s.ai_cost_tracking_enabled
            else 0.0
        )
        return AIRunMetrics(
            input_tokens=in_tokens,
            output_tokens=out_tokens,
            latency_ms=latency_ms,
            estimated_cost_usd=cost,
            provider="openai",
            model=model or self.model,
            prompt_version=prompt_version,
        )

    async def _text_chat(self, system: str, user: str, model: str | None = None, temperature: float = 0.1) -> tuple[str, int, int]:
        data = await provider_post(
            f"{self.base_url}/chat/completions",
            self.api_key,
            {
                "model": model or self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "response_format": {"type": "json_object"},
                "temperature": temperature,
            },
            self.timeout,
        )
        try:
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {}) or {}
        except (KeyError, IndexError, TypeError):
            raise APIError(502, "VALIDATION_FAILED", "AI response has an invalid structure.") from None
        return str(content), int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0))

    async def analyze_image(self, image_bytes: bytes, mime_type: str, prompt: str = "") -> tuple[ImageAnalysis, AIRunMetrics]:
        start = time.perf_counter()
        if mime_type not in ("image/png", "image/jpeg", "image/webp"):
            raise APIError(422, "INVALID_MEDIA_TYPE", "Image evidence must be PNG, JPEG, or WebP.")
        if not image_bytes or len(image_bytes) > 10 * 1024 * 1024:
            raise APIError(422, "IMAGE_TOO_LARGE", "Image evidence exceeds the 10MB size limit.")
        b64 = base64.b64encode(image_bytes).decode("ascii")
        system = (
            "You are a senior technical support engineer inspecting a user-provided screenshot. Describe only what is "
            "visible in the image. If text is unclear, transcribe it as best-effort and keep confidence low; never "
            "fabricate visible messages.\nRequired JSON schema:\n" + json.dumps(ImageAnalysis.model_json_schema())
        )
        user = prompt or "Analyze the screenshot and output the required JSON."
        data = await provider_post(
            f"{self.base_url}/chat/completions",
            self.api_key,
            {
                "model": self.vision_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": [{"type": "text", "text": user},
                                                 {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}}]},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            },
            self.timeout,
        )
        try:
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {}) or {}
        except (KeyError, IndexError, TypeError):
            raise APIError(502, "VALIDATION_FAILED", "AI response has an invalid structure.") from None
        model_res, repaired, err = validate_and_parse(content, ImageAnalysis)
        if model_res is None:
            raise APIError(502, "VALIDATION_FAILED", "AI response failed structured validation.")
        latency = int((time.perf_counter() - start) * 1000)
        return model_res, self._metrics(
            int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0)), latency, PROMPT_VERSION_VISION, self.vision_model
        )

    async def analyze_logs(self, log_text: str) -> tuple[dict, AIRunMetrics]:
        start = time.perf_counter()
        cleaned = redact_secrets(log_text)[0][:get_settings().ai_max_evidence_chars]
        det = process_logs(cleaned)
        system = (
            "You are an expert diagnostics engineer. The logs are pre-cleaned: secrets redacted, repeated lines "
            "compacted, error signatures extracted. Identify the root cause and the single most useful next step.\n"
            "Output strict JSON: {\"root_cause_hypothesis\": string, \"recommended_next_steps\": [string]}"
        )
        content, in_tokens, out_tokens = await self._text_chat(system, f"Log summary:\n{det.compact_text[:8000]}")
        merged = asdict(det)
        try:
            extra = json.loads(redact_secrets(content)[0])
        except (TypeError, ValueError):
            extra = {}
        if isinstance(extra, dict):
            merged["root_cause_hypothesis"] = str(extra.get("root_cause_hypothesis") or "")
            merged["recommended_next_steps"] = list(extra.get("recommended_next_steps") or [])
        latency = int((time.perf_counter() - start) * 1000)
        return merged, self._metrics(in_tokens, out_tokens, latency, PROMPT_VERSION_LOGS)

    async def analyze_code(self, code_text: str, language: str | None = None) -> tuple[dict, AIRunMetrics]:
        start = time.perf_counter()
        cleaned = redact_secrets(code_text)[0][:get_settings().ai_max_evidence_chars]
        det = analyze_code_snippet(cleaned, language)
        base = asdict(det) if hasattr(det, "__dataclass_fields__") else dict(det) if isinstance(det, dict) else {}
        system = (
            "You are an expert software engineer reviewing a code snippet. Identify the bug, its root cause, and the "
            "recommended fix.\nOutput strict JSON: {\"identified_bug\": string, \"root_cause\": string, \"suggested_fix\": string}"
        )
        content, in_tokens, out_tokens = await self._text_chat(system, f"Language: {language or 'unknown'}\nCode:\n```\n{cleaned[:8000]}\n```")
        merged = dict(base)
        try:
            extra = json.loads(redact_secrets(content)[0])
        except (TypeError, ValueError):
            extra = {}
        if isinstance(extra, dict):
            merged["identified_bug"] = str(extra.get("identified_bug") or "")
            merged["root_cause"] = str(extra.get("root_cause") or "")
            merged["suggested_fix"] = str(extra.get("suggested_fix") or "")
        latency = int((time.perf_counter() - start) * 1000)
        return merged, self._metrics(in_tokens, out_tokens, latency, PROMPT_VERSION_CODE)

    async def rank_fixes(self, problem: ProblemAnalysis, candidate_fixes: list[dict], grounded_context: list[dict]) -> tuple[FixRankingResult, AIRunMetrics]:
        start = time.perf_counter()
        heads = [
            {
                "id": fx.get("id"),
                "title": fx.get("title", ""),
                "summary": str(fx.get("summary", ""))[:300],
                "risk_level": fx.get("risk_level", "low"),
                "source_type": fx.get("source_type", "curated"),
                "why_it_matches": str(fx.get("why_it_matches", ""))[:300],
            }
            for fx in candidate_fixes[:10]
        ]
        context = "Known facts:\n" + "\n".join(
            f"- {f.get('title', '')}: {str(f.get('content', ''))[:200]}" for f in grounded_context[:8]
        ) if grounded_context else "No grounded facts."
        system = (
            "You are a technical advice ranker. Rank the candidate solutions for the problem described, prioritizing "
            "verified historical outcomes, official guidance, and fit to the reported symptoms.\nRequired JSON schema:\n"
            + json.dumps(FixRankingResult.model_json_schema())
        )
        user = (
            f"Problem: {problem.problem_summary}\nCategory: {problem.category}\nLikely causes: "
            f"{[c.title for c in problem.likely_causes]}\n\n{context}\n\nCandidate fixes:\n{json.dumps(heads)}\n\n"
            "Output the ranked fixes in the required schema (one entry per candidate, ranked best-first)."
        )
        content, in_tokens, out_tokens = await self._text_chat(system, user[: get_settings().ai_max_evidence_chars])
        model_res, repaired, err = validate_and_parse(content, FixRankingResult)
        if model_res is None or not model_res.ranked_fixes:
            raise APIError(502, "VALIDATION_FAILED", "AI response failed structured validation.")
        latency = int((time.perf_counter() - start) * 1000)
        return model_res, self._metrics(in_tokens, out_tokens, latency, PROMPT_VERSION_RANKING)

    async def verify_outcome(self, case_info: dict, fix_info: dict, before_evidence: list[dict], after_evidence: list[dict], reported_result: str) -> tuple[VerificationAnalysis, AIRunMetrics]:
        start = time.perf_counter()
        system = (
            "You are an outcome verification analyst. Decide whether a reported resolution is genuinely verified from the "
            "evidence, or only partially verified / failed.\nRequired JSON schema:\n" + json.dumps(VerificationAnalysis.model_json_schema())
        )
        user = (
            f"Case: {json.dumps(case_info)}\nFix applied: {json.dumps(fix_info)}\nReported result: {reported_result}\n\n"
            f"Before evidence:\n{json.dumps([{k: (v or '')[:400] for k, v in e.items() if k in ('type', 'text', 'content')} for e in before_evidence])}\n"
            f"After evidence:\n{json.dumps([{k: (v or '')[:400] for k, v in e.items() if k in ('type', 'text', 'content')} for e in after_evidence])}"
        )
        content, in_tokens, out_tokens = await self._text_chat(system, user[: get_settings().ai_max_evidence_chars])
        model_res, repaired, err = validate_and_parse(content, VerificationAnalysis)
        if model_res is None:
            raise APIError(502, "VALIDATION_FAILED", "AI response failed structured validation.")
        latency = int((time.perf_counter() - start) * 1000)
        return model_res, self._metrics(in_tokens, out_tokens, latency, PROMPT_VERSION_VERIFICATION)

    async def score_contribution(self, title: str, description: str, steps: list[str], category: str, existing_fixes: list[dict]) -> tuple[ContributionScore, AIRunMetrics]:
        start = time.perf_counter()
        system = (
            "You are a community contributions reviewer. Score the novelty, evidence quality, verification strength, "
            "utility, and fraud/duplicate risk of a proposed solution.\nRequired JSON schema:\n"
            + json.dumps(ContributionScore.model_json_schema())
        )
        user = (
            f"Title: {title}\nCategory: {category}\nDescription: {description}\nProposed steps: {json.dumps(steps)}\n"
            f"Existing fixes to compare against:\n{json.dumps([{k: (f.get(k) or '')[:200] for k in ('id', 'title', 'summary')} for f in existing_fixes[:10]])}"
        )
        content, in_tokens, out_tokens = await self._text_chat(system, user[: get_settings().ai_max_evidence_chars])
        model_res, repaired, err = validate_and_parse(content, ContributionScore)
        if model_res is None:
            raise APIError(502, "VALIDATION_FAILED", "AI response failed structured validation.")
        latency = int((time.perf_counter() - start) * 1000)
        return model_res, self._metrics(in_tokens, out_tokens, latency, PROMPT_VERSION_CONTRIBUTION)

    async def summarize_evidence(self, evidence_items: list[dict]) -> str:
        return "\n".join(redact_secrets(str(item.get("text", "")))[0] for item in evidence_items)[:get_settings().ai_max_evidence_chars]


def get_ai_provider(settings: Settings | None = None) -> AIProvider:
    """Factory creating configured AIProvider based on environment settings."""
    cfg = settings or get_settings()
    provider_type = (cfg.ai_provider or "unconfigured").lower()

    if provider_type == "openai":
        if not cfg.ai_api_key:
            return UnconfiguredAIProvider()
        return OpenAIProvider(
            api_key=cfg.ai_api_key,
            model=cfg.ai_model,
            base_url=cfg.ai_base_url,
            timeout=cfg.ai_timeout_seconds,
        )
    elif provider_type in ("mock", "development_deterministic"):
        return MockAIProvider()
    else:
        return UnconfiguredAIProvider()
