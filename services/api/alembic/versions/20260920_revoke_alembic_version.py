"""Revoke schema-migration write access from browser roles.

Supabase applies default privileges in the ``public`` schema that grant ALL on
newly created tables to ``anon`` and ``authenticated``. The alembic_version
table (a server-owned bookkeeping table) therefore received INSERT/UPDATE
column grants for browser roles. Revoke them so every server-owned table fails
closed for browser clients.
"""
from alembic import op

revision = "20260920_revoke_alembic_version"
down_revision = "20260920_phase55_staging_rls"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("REVOKE ALL ON TABLE alembic_version FROM anon, authenticated")


def downgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    # Re-granting is intentionally not performed; fail closed on downgrade too.
    pass