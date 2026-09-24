"""Campus Ambassador program applications.

Guests may submit through the API, so ``user_id`` is nullable. Browser roles get
no INSERT/UPDATE/DELETE grants; signed-in users can only read their own rows via
the ``owner_read`` policy (``user_id = auth.uid()``). All writes go through the
authenticated FastAPI backend, and ``status`` is server-controlled.
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260924_campus_ambassador_applications"
down_revision = "20260920_revoke_alembic_version"
branch_labels = None
depends_on = None

TABLE = "campus_ambassador_applications"


def upgrade():
    op.create_table(
        TABLE,
        sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("status", sa.String(length=255), nullable=False),
        sa.Column("application_id", sa.String(length=32), nullable=False),
        sa.Column("lookup_token", sa.String(length=64), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("institution", sa.String(length=255), nullable=False),
        sa.Column("program", sa.String(length=255), nullable=False),
        sa.Column("graduation_year", sa.Integer(), nullable=False),
        sa.Column("current_student", sa.Boolean(), nullable=False),
        sa.Column("club_involvement", sa.Text(), nullable=True),
        sa.Column("leadership_experience", sa.Boolean(), nullable=False),
        sa.Column("leadership_description", sa.Text(), nullable=True),
        sa.Column("motivation", sa.Text(), nullable=False),
        sa.Column("community_goals", sa.Text(), nullable=False),
        sa.Column("github_url", sa.String(length=500), nullable=True),
        sa.Column("linkedin_url", sa.String(length=500), nullable=True),
        sa.Column("other_social_url", sa.String(length=500), nullable=True),
        sa.Column("audience_count", sa.Integer(), nullable=True),
        sa.Column("technical_level", sa.String(length=50), nullable=False),
        sa.Column("skill_tags", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False),
        sa.Column("weekly_hours", sa.Integer(), nullable=False),
        sa.Column("availability_months", sa.Integer(), nullable=False),
        sa.Column("timezone", sa.String(length=120), nullable=False),
        sa.Column("resources_needed", sa.Text(), nullable=False),
        sa.Column("previous_ambassador", sa.Boolean(), nullable=False),
        sa.Column("previous_ambassador_details", sa.Text(), nullable=True),
        sa.Column("consent", sa.Boolean(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], name=op.f("fk_campus_ambassador_applications_user_id_profiles"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_campus_ambassador_applications")),
        sa.UniqueConstraint("application_id", name=op.f("uq_campus_ambassador_applications_application_id")),
        sa.UniqueConstraint("email", name=op.f("uq_campus_ambassador_applications_email")),
        sa.UniqueConstraint("lookup_token", name=op.f("uq_campus_ambassador_applications_lookup_token")),
    )
    op.create_index("ix_campus_ambassador_applications_email", TABLE, ["email"], unique=False)
    op.create_index("ix_campus_amb_user_created", TABLE, ["user_id", "submitted_at"], unique=False)

    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(f'ALTER TABLE "{TABLE}" ENABLE ROW LEVEL SECURITY')
    op.execute(f"""DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND to_regprocedure('auth.uid()') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON {TABLE} FROM anon, authenticated';
      EXECUTE 'GRANT SELECT ON {TABLE} TO authenticated';
      EXECUTE 'CREATE POLICY owner_read ON {TABLE} FOR SELECT TO authenticated USING (user_id = auth.uid())';
    END IF; END $$;""")


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f'DROP POLICY IF EXISTS owner_read ON "{TABLE}"')
    op.drop_index("ix_campus_amb_user_created", table_name=TABLE)
    op.drop_index("ix_campus_ambassador_applications_email", table_name=TABLE)
    op.drop_table(TABLE)