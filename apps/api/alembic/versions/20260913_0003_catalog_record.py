"""Add complete catalog JSON without replacing legacy metadata."""

import sqlalchemy as sa

from alembic import op

revision = "20260913_0003"
down_revision = "20260910_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("photo_metadata", sa.Column("record", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("photo_metadata", "record")
