"""Phase 4.5 Web3 readiness & secure reward infrastructure.

Adds:
- claim_reservations state machine table (claimable -> reserved -> signed -> submitted -> confirmed,
  with failure/release paths) and per-reward one-time claim uniqueness.
- wallet challenge nonce columns (one-time, expiring challenges with replay protection).
- knowledge_attributions versioning + unique contributor attribution per fix/type/version.
"""
import sqlalchemy as sa

from alembic import op

revision = "20260918_phase45_web3_readiness"
down_revision = "20260918_phase4_intelligence"
branch_labels = None
depends_on = None

json_type = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def upgrade():
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. claim_reservations state machine
    op.create_table(
        "claim_reservations",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("reward_id", sa.Uuid(as_uuid=False), sa.ForeignKey("reward_ledger.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("user_id", sa.Uuid(as_uuid=False), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state", sa.String(255), nullable=False, server_default="reserved"),
        sa.Column("signed_payload_hash", sa.String(128), nullable=True),
        sa.Column("chain_id", sa.Integer(), nullable=True),
        sa.Column("tx_hash", sa.String(255), nullable=True),
        sa.Column("error_code", sa.String(255), nullable=True),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_claim_user_state", "claim_reservations", ["user_id", "state", "created_at"])
    op.create_index("ix_claim_reward", "claim_reservations", ["reward_id"])
    if is_pg:
        op.create_check_constraint(
            "valid_claim_state",
            "claim_reservations",
            "state IN ('claimable', 'reserved', 'signed', 'submitted', 'confirmed', 'released', 'failed')",
        )

    # 2. wallet challenge nonces (one-time use + expiry)
    op.add_column("wallet_links", sa.Column("nonce", sa.String(255), nullable=True))
    op.add_column("wallet_links", sa.Column("nonce_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("wallet_links", sa.Column("nonce_used_at", sa.DateTime(timezone=True), nullable=True))

    # 3. knowledge_attributions versioning + unique attribution per fix/type/version
    op.add_column("knowledge_attributions", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    if is_pg:
        op.create_unique_constraint(
            "unique_fix_contributor_attribution_version",
            "knowledge_attributions",
            ["fix_id", "contributor_user_id", "attribution_type", "version"],
        )

    # RLS on PostgreSQL (claim reservations are owned by a user; keep anon/authenticated locked down)
    if is_pg:
        op.execute('ALTER TABLE "claim_reservations" ENABLE ROW LEVEL SECURITY')
        op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        EXECUTE 'REVOKE ALL ON claim_reservations FROM anon, authenticated'; END IF; END $$;""")


def downgrade():
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    if is_pg:
        op.drop_constraint("unique_fix_contributor_attribution_version", "knowledge_attributions", type_="unique")
    op.drop_column("knowledge_attributions", "version")
    op.drop_column("wallet_links", "nonce_used_at")
    op.drop_column("wallet_links", "nonce_expires_at")
    op.drop_column("wallet_links", "nonce")
    op.drop_table("claim_reservations")