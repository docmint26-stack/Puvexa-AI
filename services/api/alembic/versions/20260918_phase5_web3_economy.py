"""Phase 5: on-chain web3 economy persistence.

Adds:
- claim_reservations on-chain extensions (claim_id bytes32, wallet_address,
  contract_address, deadline) so an EIP-712 claim can be prepared once and
  verified against the chain.
- web3_transactions table recording every claim/stake transaction the backend
  observes, with a unique tx hash (single observation per on-chain tx).
"""
import sqlalchemy as sa

from alembic import op

revision = "20260918_phase5_web3_economy"
down_revision = "20260918_phase45_web3_readiness"
branch_labels = None
depends_on = None

json_type = sa.JSON().with_variant(sa.dialects.postgresql.JSONB(), "postgresql")


def upgrade():
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.add_column("claim_reservations", sa.Column("claim_id", sa.String(66), nullable=True))
    op.add_column("claim_reservations", sa.Column("wallet_address", sa.String(255), nullable=True))
    op.add_column("claim_reservations", sa.Column("contract_address", sa.String(255), nullable=True))
    op.add_column("claim_reservations", sa.Column("deadline", sa.Integer(), nullable=True))
    if is_pg:
        op.create_unique_constraint("uq_claim_reservations_claim_id", "claim_reservations", ["claim_id"])

    op.create_table(
        "web3_transactions",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=False), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("claim_id", sa.String(66), nullable=True),
        sa.Column("tx_type", sa.String(255), nullable=False),
        sa.Column("tx_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("chain_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(255), nullable=False, server_default="submitted"),
        sa.Column("from_address", sa.String(255), nullable=True),
        sa.Column("to_address", sa.String(255), nullable=True),
        sa.Column("block_number", sa.Integer(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_w3tx_user_created", "web3_transactions", ["user_id", "created_at"])
    op.create_index("ix_w3tx_tx_hash", "web3_transactions", ["tx_hash"])
    op.create_index("ix_w3tx_claim", "web3_transactions", ["claim_id"])

    if is_pg:
        op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        EXECUTE 'REVOKE ALL ON web3_transactions FROM anon, authenticated'; END IF; END $$;""")


def downgrade():
    op.drop_index("ix_w3tx_claim", table_name="web3_transactions")
    op.drop_index("ix_w3tx_tx_hash", table_name="web3_transactions")
    op.drop_index("ix_w3tx_user_created", table_name="web3_transactions")
    op.drop_table("web3_transactions")
    op.drop_column("claim_reservations", "deadline")
    op.drop_column("claim_reservations", "contract_address")
    op.drop_column("claim_reservations", "wallet_address")
    op.drop_column("claim_reservations", "claim_id")