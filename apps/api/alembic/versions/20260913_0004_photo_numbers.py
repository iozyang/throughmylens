"""Persistent, concurrency-safe human-readable photo numbers."""

import sqlalchemy as sa
from alembic import op

revision = "20260913_0004"
down_revision = "20260913_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "photo_numbers",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column("photo_id", sa.Uuid(), sa.ForeignKey("photos.id"), nullable=False, unique=True),
    )


def downgrade():
    op.drop_table("photo_numbers")
