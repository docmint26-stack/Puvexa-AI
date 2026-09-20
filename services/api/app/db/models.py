from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import get_settings
from app.db.base import Base, Identity, Updated, json_type, now, vector_type


class Profile(Identity, Updated, Base):
    __tablename__ = "profiles"
    auth_user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), unique=True)
    display_name: Mapped[str] = mapped_column(String(255), default='New Solver')
    username: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    role: Mapped[str] = mapped_column(String(255), default='user')
    reputation_level: Mapped[str] = mapped_column(String(255), default='New Solver')
    reputation_score: Mapped[int] = mapped_column(Integer, default=0)
    country_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str] = mapped_column(String(255), default='UTC')


class Case(Identity, Updated, Base):
    __tablename__ = "cases"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(255))
    subcategory: Mapped[str | None] = mapped_column(String(255), nullable=True)
    severity: Mapped[str] = mapped_column(String(255), default='medium')
    status: Mapped[str] = mapped_column(String(255), default='submitted')
    environment: Mapped[dict] = mapped_column(json_type, default=dict)
    software_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    software_version: Mapped[str | None] = mapped_column(String(255), nullable=True)
    operating_system: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recent_changes: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_diagnosis_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CaseEvidence(Identity, Base):
    __tablename__ = "case_evidence"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    evidence_type: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", json_type, default=dict)
    outcome_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("outcomes.id", ondelete="SET NULL"), nullable=True)


class DiagnosisRun(Identity, Base):
    __tablename__ = "diagnosis_runs"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(255), default='pending')
    problem_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    probable_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    similar_case_count: Mapped[int] = mapped_column(Integer, default=0)
    model_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_snapshot: Mapped[dict] = mapped_column(json_type, default=dict)
    analysis_metadata: Mapped[dict] = mapped_column(json_type, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Fix(Identity, Updated, Base):
    __tablename__ = "fixes"
    created_by_user_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    instructions: Mapped[list] = mapped_column(json_type, default=list)
    category: Mapped[str] = mapped_column(String(255))
    risk_level: Mapped[str] = mapped_column(String(255), default='low')
    effort_level: Mapped[str] = mapped_column(String(255), default='low')
    source_type: Mapped[str] = mapped_column(String(255), default='curated')
    verification_status: Mapped[str] = mapped_column(String(255), default='unverified')
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    partial_count: Mapped[int] = mapped_column(Integer, default=0)
    verified_success_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    reuse_count: Mapped[int] = mapped_column(Integer, default=0)


class CaseFixRecommendation(Identity, Base):
    __tablename__ = "case_fix_recommendations"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"))
    diagnosis_run_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("diagnosis_runs.id", ondelete="CASCADE"))
    fix_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("fixes.id", ondelete="RESTRICT"))
    rank: Mapped[int] = mapped_column(Integer, default=1)
    ai_confidence: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    context_match_score: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_success_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)


class FixAttempt(Identity, Updated, Base):
    __tablename__ = "fix_attempts"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"))
    fix_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("fixes.id", ondelete="RESTRICT"))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(255), default='started')
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_reported_result: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps_done: Mapped[int] = mapped_column(Integer, default=0)


class Outcome(Identity, Updated, Base):
    __tablename__ = "outcomes"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"))
    fix_attempt_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("fix_attempts.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    reported_result: Mapped[str] = mapped_column(String(255))
    verification_method: Mapped[str] = mapped_column(String(255), default='self report')
    verification_confidence: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0.2)
    verification_status: Mapped[str] = mapped_column(String(255), default='pending')
    before_data: Mapped[dict] = mapped_column(json_type, default=dict)
    after_data: Mapped[dict] = mapped_column(json_type, default=dict)
    verification_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    observation_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observation_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Contribution(Identity, Updated, Base):
    __tablename__ = "contributions"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    case_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="SET NULL"), nullable=True)
    fix_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("fixes.id", ondelete="SET NULL"), nullable=True)
    contribution_type: Mapped[str] = mapped_column(String(255), default='new fix')
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    evidence_summary: Mapped[dict] = mapped_column(json_type, default=dict)
    status: Mapped[str] = mapped_column(String(255), default='submitted')
    verification_confidence: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    novelty_score: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    quality_score: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    utility_score: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RewardLedger(Identity, Base):
    __tablename__ = "reward_ledger"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(255))
    reference_type: Mapped[str] = mapped_column(String(255))
    reference_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    status: Mapped[str] = mapped_column(String(255), default='pending')
    reason: Mapped[str] = mapped_column(Text)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)
    claimable_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ReputationEvent(Identity, Base):
    __tablename__ = "reputation_events"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(255))
    reference_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    points: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)


class KnowledgeAttribution(Identity, Updated, Base):
    __tablename__ = "knowledge_attributions"
    fix_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("fixes.id", ondelete="RESTRICT"))
    contributor_user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    ownership_share: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    attribution_type: Mapped[str] = mapped_column(String(255), default='creator')
    version: Mapped[int] = mapped_column(Integer, default=1)


class WalletLink(Identity, Updated, Base):
    __tablename__ = "wallet_links"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    wallet_address: Mapped[str] = mapped_column(String(255), unique=True)
    chain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(255), default='pending')
    verification_nonce_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nonce: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nonce_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nonce_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ClaimReservation(Identity, Updated, Base):
    __tablename__ = "claim_reservations"
    reward_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("reward_ledger.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    state: Mapped[str] = mapped_column(String(255), default='reserved')
    signed_payload_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    chain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tx_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    claim_id: Mapped[str | None] = mapped_column(String(66), nullable=True, unique=True)
    wallet_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deadline: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reserved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Web3Transaction(Identity, Updated, Base):
    __tablename__ = "web3_transactions"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    claim_id: Mapped[str | None] = mapped_column(String(66), nullable=True)
    tx_type: Mapped[str] = mapped_column(String(255))
    tx_hash: Mapped[str] = mapped_column(String(255), unique=True)
    chain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(255), default='submitted')
    from_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    to_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    block_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Notification(Identity, Base):
    __tablename__ = "notifications"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text)
    action_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", json_type, default=dict)


class UserSettings(Updated, Base):
    __tablename__ = "user_settings"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    theme: Mapped[str] = mapped_column(String(255), default='dark')
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    reward_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    case_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    contribution_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    profile_visibility: Mapped[str] = mapped_column(String(255), default='private')
    leaderboard_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    analytics_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Identity, Base):
    __tablename__ = "audit_events"
    user_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(255))
    entity_type: Mapped[str] = mapped_column(String(255))
    entity_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", json_type, default=dict)


class AccountDeletionRequest(Identity, Base):
    __tablename__ = "account_deletion_requests"
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(String(255), default='pending')


class KnowledgeDocument(Identity, Base):
    __tablename__ = "knowledge_documents"
    source_type: Mapped[str] = mapped_column(String(255), default="curated")
    source_name: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    trust_level: Mapped[str] = mapped_column(String(50), default="curated")
    version: Mapped[str] = mapped_column(String(50), default="1.0")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class KnowledgeChunk(Identity, Base):
    __tablename__ = "knowledge_chunks"
    document_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("knowledge_documents.id", ondelete="CASCADE"))
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list | None] = mapped_column(vector_type(1536), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", json_type, default=dict)


class CaseEmbedding(Identity, Updated, Base):
    __tablename__ = "case_embeddings"
    case_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"), unique=True)
    embedding: Mapped[list | None] = mapped_column(vector_type(1536), nullable=True)
    embedding_model: Mapped[str] = mapped_column(String(255), default=lambda: get_settings().ai_embedding_model)
    embedding_version: Mapped[str] = mapped_column(String(50), default="v1")


class FixEmbedding(Identity, Base):
    __tablename__ = "fix_embeddings"
    fix_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("fixes.id", ondelete="CASCADE"), unique=True)
    embedding: Mapped[list | None] = mapped_column(vector_type(1536), nullable=True)
    embedding_model: Mapped[str] = mapped_column(String(255), default=lambda: get_settings().ai_embedding_model)
    embedding_version: Mapped[str] = mapped_column(String(50), default="v1")


class OutcomeIntelligence(Identity, Base):
    __tablename__ = "outcome_intelligence"
    source_outcome_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("outcomes.id", ondelete="SET NULL"), nullable=True)
    fix_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("fixes.id", ondelete="CASCADE"))
    normalized_context: Mapped[dict] = mapped_column(json_type, default=dict)
    category: Mapped[str] = mapped_column(String(255))
    software: Mapped[str | None] = mapped_column(String(255), nullable=True)
    version_range: Mapped[str | None] = mapped_column(String(255), nullable=True)
    os: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_family: Mapped[str] = mapped_column(String(255))
    result: Mapped[str] = mapped_column(String(255))
    verification_strength: Mapped[str] = mapped_column(String(255), default="medium")
    confidence: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=Decimal("0.5"))
    embedding: Mapped[list | None] = mapped_column(vector_type(1536), nullable=True)


class DiagnosisSource(Identity, Base):
    __tablename__ = "diagnosis_sources"
    diagnosis_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("diagnosis_runs.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String(255))
    source_id: Mapped[str] = mapped_column(String(255))
    relevance_score: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    usage_type: Mapped[str] = mapped_column(String(255), default="context")


class AIRun(Identity, Base):
    __tablename__ = "ai_runs"
    user_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    case_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey("cases.id", ondelete="SET NULL"), nullable=True)
    task_type: Mapped[str] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(255))
    model: Mapped[str] = mapped_column(String(255))
    prompt_version: Mapped[str] = mapped_column(String(255), default="1.0")
    input_token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    status: Mapped[str] = mapped_column(String(255), default="completed")
    error_code: Mapped[str | None] = mapped_column(String(255), nullable=True)


Index("ix_cases_user_created", Case.user_id, Case.created_at)
Index("ix_evidence_case", CaseEvidence.case_id)
Index("ix_diagnoses_case", DiagnosisRun.case_id)
Index("ix_recommendation_case_rank", CaseFixRecommendation.case_id, CaseFixRecommendation.rank)
Index("ix_attempt_case", FixAttempt.case_id)
Index("ix_outcome_case", Outcome.case_id)
Index("ix_contribution_user_created", Contribution.user_id, Contribution.created_at)
Index("ix_reward_user_status", RewardLedger.user_id, RewardLedger.status)
Index("ix_reward_user_created", RewardLedger.user_id, RewardLedger.created_at)
Index("ix_reputation_user_created", ReputationEvent.user_id, ReputationEvent.created_at)
Index("ix_notification_user_read_created", Notification.user_id, Notification.read_at, Notification.created_at)
Index("ix_knowledge_chunks_doc", KnowledgeChunk.document_id)
Index("ix_case_embeddings_case", CaseEmbedding.case_id)
Index("ix_fix_embeddings_fix", FixEmbedding.fix_id)
Index("ix_outcome_intelligence_fix", OutcomeIntelligence.fix_id)
Index("ix_outcome_intelligence_cat_err", OutcomeIntelligence.category, OutcomeIntelligence.error_family)
Index("ix_diagnosis_sources_diag", DiagnosisSource.diagnosis_id)
Index("ix_ai_runs_user_task", AIRun.user_id, AIRun.task_type)
Index("ix_claim_user_state", ClaimReservation.user_id, ClaimReservation.state, ClaimReservation.created_at)
Index("ix_claim_reward", ClaimReservation.reward_id)
Index("ix_w3tx_user_created", Web3Transaction.user_id, Web3Transaction.created_at)
Index("ix_w3tx_tx_hash", Web3Transaction.tx_hash)
Index("ix_w3tx_claim", Web3Transaction.claim_id)
Case.__table__.append_constraint(UniqueConstraint("id", "user_id"))
CaseFixRecommendation.__table__.append_constraint(UniqueConstraint("case_id", "fix_id"))
RewardLedger.__table__.append_constraint(CheckConstraint("amount >= 0", name="nonnegative_amount"))
KnowledgeAttribution.__table__.append_constraint(CheckConstraint("ownership_share > 0 AND ownership_share <= 1", name="valid_share"))
KnowledgeAttribution.__table__.append_constraint(UniqueConstraint("fix_id", "contributor_user_id", "attribution_type", "version", name="unique_fix_contributor_attribution_version"))
ClaimReservation.__table__.append_constraint(UniqueConstraint("reward_id", name="unique_claim_per_reward"))
ClaimReservation.__table__.append_constraint(CheckConstraint("state IN ('claimable', 'reserved', 'signed', 'submitted', 'confirmed', 'released', 'failed')", name="valid_claim_state"))

