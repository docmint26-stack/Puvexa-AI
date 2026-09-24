from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["Coding Error", "Windows / OS", "Network & Wi-Fi", "Hardware & Devices", "Apps & Productivity", "Performance", "Security"]
EvidenceType = Literal["screenshot", "log", "code", "output", "document", "diagnostic", "before_image", "after_image", "test_result"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CaseCreate(StrictModel):
    title: str = Field(min_length=10, max_length=200)
    description: str = Field(min_length=20, max_length=20000)
    category: Category
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    environment: dict[str, str] = Field(default_factory=dict, max_length=30)
    software_name: str | None = Field(default=None, max_length=200)
    software_version: str | None = Field(default=None, max_length=100)
    operating_system: str | None = Field(default=None, max_length=200)
    device_name: str | None = Field(default=None, max_length=200)
    recent_changes: str | None = Field(default=None, max_length=2000)


class CasePatch(StrictModel):
    title: str | None = Field(default=None, min_length=10, max_length=200)
    description: str | None = Field(default=None, min_length=20, max_length=20000)
    category: Category | None = None
    environment: dict[str, str] | None = Field(default=None, max_length=30)
    status: Literal["submitted"] | None = None


class ProfilePatch(StrictModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    username: str | None = Field(default=None, pattern=r"^[a-z0-9_]{3,30}$")
    bio: str | None = Field(default=None, max_length=2000)
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    timezone: str | None = Field(default=None, max_length=100)


class SettingsPatch(StrictModel):
    theme: Literal["dark", "light", "system"] | None = None
    email_notifications: bool | None = None
    reward_notifications: bool | None = None
    case_notifications: bool | None = None
    contribution_notifications: bool | None = None
    profile_visibility: Literal["private", "public"] | None = None
    leaderboard_opt_in: bool | None = None
    analytics_opt_in: bool | None = None


class AttemptCreate(StrictModel):
    fix_id: UUID


class AttemptPatch(StrictModel):
    notes: str | None = Field(default=None, max_length=5000)
    steps_done: int | None = Field(default=None, ge=0, le=100)


class OutcomeCreate(StrictModel):
    reported_result: Literal["resolved", "partially_resolved", "not_resolved"]
    before_data: dict[str, str | bool | int | float] = Field(default_factory=dict, max_length=10)
    after_data: dict[str, str | bool | int | float] = Field(default_factory=dict, max_length=10)


class ContributionCreate(StrictModel):
    contribution_type: Literal["new_fix", "fix_improvement", "correction", "verified_outcome", "verification_review"] = "new_fix"
    title: str = Field(min_length=10, max_length=200)
    description: str = Field(min_length=20, max_length=20000)
    case_id: UUID | None = None
    fix_id: UUID | None = None
    evidence_summary: dict[str, str | list[str]] = Field(default_factory=dict, max_length=20)


class ContributionPatch(StrictModel):
    title: str | None = Field(default=None, min_length=10, max_length=200)
    description: str | None = Field(default=None, min_length=20, max_length=20000)


class DeleteAccountRequest(StrictModel):
    confirmation: Literal["DELETE MY ACCOUNT"]


class WalletChallengeCreate(StrictModel):
    address: str = Field(min_length=20, max_length=200)
    chain_id: int | None = Field(default=None, ge=1)


class WalletVerifyCreate(StrictModel):
    address: str = Field(min_length=20, max_length=200)
    chain_id: int | None = Field(default=None, ge=1)
    signature: str = Field(min_length=10, max_length=2000)
    nonce: str | None = Field(default=None, min_length=16, max_length=200)


class AttrCreate(StrictModel):
    fix_id: UUID
    share: float = Field(gt=0, le=1)
    attribution_type: Literal["creator", "improver", "correction"] = "improver"
    version: int = Field(default=1, ge=1)


class ClaimSignCreate(StrictModel):
    signed_payload_hash: str = Field(min_length=64, max_length=128, pattern=r"^[0-9a-fA-F]{64}$")


class ClaimConfirmCreate(StrictModel):
    chain_id: int = Field(ge=1)
    tx_hash: str = Field(min_length=10, max_length=255)


class Web3ClaimPrepareCreate(StrictModel):
    reward_id: UUID
    wallet_address: str = Field(min_length=20, max_length=200)
    chain_id: int | None = Field(default=None, ge=1)


class Web3ClaimConfirmCreate(StrictModel):
    claim_id: str = Field(min_length=66, max_length=66)
    tx_hash: str = Field(min_length=10, max_length=255)
    chain_id: int | None = Field(default=None, ge=1)


class Web3StakeCreate(StrictModel):
    contribution_id: str = Field(min_length=10, max_length=255)
    wallet_address: str = Field(min_length=20, max_length=200)
    tx_hash: str = Field(min_length=10, max_length=255)
    chain_id: int | None = Field(default=None, ge=1)


class Web3StakeSettleCreate(StrictModel):
    tx_hash: str = Field(min_length=10, max_length=255)
    chain_id: int | None = Field(default=None, ge=1)


AmbassadorTechnicalLevel = Literal["beginner", "intermediate", "advanced", "professional"]
_EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
_HTTP_URL = r"^https?://\S+$"


class CampusAmbassadorApplicationCreate(StrictModel):
    full_name: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=3, max_length=254, pattern=_EMAIL)
    phone: str | None = Field(default=None, max_length=40)
    country: str = Field(min_length=2, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    institution: str = Field(min_length=2, max_length=255)
    program: str = Field(min_length=2, max_length=255)
    graduation_year: int = Field(ge=2000, le=2100)
    current_student: bool = True
    club_involvement: str | None = Field(default=None, max_length=2000)
    leadership_experience: bool = False
    leadership_description: str | None = Field(default=None, max_length=5000)
    motivation: str = Field(min_length=20, max_length=12000)
    community_goals: str = Field(min_length=20, max_length=12000)
    github_url: str | None = Field(default=None, max_length=500, pattern=_HTTP_URL)
    linkedin_url: str | None = Field(default=None, max_length=500, pattern=_HTTP_URL)
    other_social_url: str | None = Field(default=None, max_length=500, pattern=_HTTP_URL)
    audience_count: int | None = Field(default=None, ge=0, le=10_000_000)
    technical_level: AmbassadorTechnicalLevel
    skill_tags: list[str] = Field(min_length=1, max_length=20)
    weekly_hours: int = Field(ge=1, le=40)
    availability_months: int = Field(ge=1, le=24)
    timezone: str = Field(min_length=1, max_length=120)
    resources_needed: str = Field(min_length=10, max_length=5000)
    previous_ambassador: bool = False
    previous_ambassador_details: str | None = Field(default=None, max_length=2000)
    consent: bool


class CampusAmbassadorApplicationPatch(StrictModel):
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=120)
    graduation_year: int | None = Field(default=None, ge=2000, le=2100)
    current_student: bool | None = None
    club_involvement: str | None = Field(default=None, max_length=2000)
    audience_count: int | None = Field(default=None, ge=0, le=10_000_000)
    weekly_hours: int | None = Field(default=None, ge=1, le=40)
    availability_months: int | None = Field(default=None, ge=1, le=24)
    timezone: str | None = Field(default=None, min_length=1, max_length=120)
    resources_needed: str | None = Field(default=None, min_length=10, max_length=5000)
