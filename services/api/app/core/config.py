from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./puvexa.db"
    supabase_url: str = ""
    supabase_anon_key: str = Field(
        "",
        validation_alias=AliasChoices(
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
            "SUPABASE_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "SUPABASE_ANON_KEY",
            "supabase_anon_key",
        ),
    )
    supabase_service_role_key: str = Field(
        "",
        validation_alias=AliasChoices(
            "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "supabase_service_role_key"
        ),
    )
    supabase_jwks_url: str = ""
    supabase_storage_bucket_evidence: str = "puvexa-evidence"
    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 15
    ai_provider: str = "unconfigured"
    ai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    ai_vision_model: str = "gpt-4o-mini"
    ai_embedding_model: str = "text-embedding-3-small"
    ai_embedding_dim: int = Field(
        1536,
        validation_alias=AliasChoices("AI_EMBEDDING_DIMENSION", "AI_EMBEDDING_DIM", "ai_embedding_dim"),
        ge=1,
    )
    ai_base_url: str = "https://api.openai.com/v1"
    ai_timeout_seconds: float = 30.0
    ai_retry_count: int = Field(2, ge=0, le=5)
    ai_max_evidence_chars: int = Field(30000, ge=1)
    ai_cost_tracking_enabled: bool = False
    ai_input_cost_per_million: float = 0.0
    ai_output_cost_per_million: float = 0.0
    min_success_rate_sample: int = 5
    ai_rate_limit_per_day: int = 50
    contribution_review_rate_limit_per_day: int = 20
    web3_claim_enabled: bool = False
    wallet_nonce_ttl_minutes: int = 15
    wallet_signature_verifier: str = "none"
    claim_reservation_ttl_hours: int = 72
    web3_chain_id: int = 97
    web3_testnet_rpc_url: str = ""
    web3_token_address: str = ""
    web3_distributor_address: str = ""
    web3_stake_vault_address: str = ""
    web3_registry_address: str = ""
    web3_reward_signer_private_key: str = ""
    allow_mainnet_deployment: bool = False

    @property
    def issuer(self):
        return self.supabase_url.rstrip("/") + "/auth/v1"


@lru_cache
def get_settings():
    return Settings()
