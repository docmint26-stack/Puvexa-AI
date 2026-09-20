"""Phase 5.5 staging RLS hardening.

Closes the remaining RLS gaps so the staging (Supabase) database fails closed for
browser clients on every user-owned table:

- ``web3_transactions`` previously had only REVOKE (no RLS). Enable row level
  security and add an owner-scoped SELECT policy.
- ``claim_reservations`` was deny-all for browser clients; add the same
  owner-scoped SELECT policy so a user can read their own claim state while all
  writes remain server-controlled.

No anon/authenticated INSERT/UPDATE/DELETE grants are ever created; the backend
role (BYPASSRLS / table owner) remains the only writer.
"""
from alembic import op

revision = "20260920_phase55_staging_rls"
down_revision = "20260918_phase5_web3_economy"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute('ALTER TABLE "web3_transactions" ENABLE ROW LEVEL SECURITY')
    for table in ["web3_transactions", "claim_reservations"]:
        op.execute(f"""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND to_regprocedure('auth.uid()') IS NOT NULL THEN
          EXECUTE 'REVOKE ALL ON {table} FROM anon, authenticated';
          EXECUTE 'GRANT SELECT ON {table} TO authenticated';
          EXECUTE 'CREATE POLICY owner_read ON {table} FOR SELECT TO authenticated USING (user_id = auth.uid())';
        END IF; END $$;""")


def downgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    # Drop the owner-read policies but keep RLS enabled and REVOKE'd; fail closed.
    for table in ["web3_transactions", "claim_reservations"]:
        op.execute(f'DROP POLICY IF EXISTS owner_read ON "{table}"')