"""add photo library and durable processing jobs

Revision ID: 20260910_0002
Revises: 20260910_0001
"""

import sqlalchemy as sa

from alembic import op

revision = "20260910_0002"
down_revision = "20260910_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "photos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False, unique=True),
        sa.Column("master_key", sa.String(512), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("color_profile", sa.String(255), nullable=False),
        sa.Column("processing_status", sa.String(32), nullable=False),
        sa.Column("publication_status", sa.String(32), nullable=False),
        sa.Column("processing_config", sa.JSON(), nullable=False),
        sa.Column("processing_error", sa.Text()),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "photo_metadata",
        sa.Column("photo_id", sa.Uuid(), sa.ForeignKey("photos.id"), primary_key=True),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("review_status", sa.String(32), nullable=False),
    )
    op.create_table(
        "photo_private_metadata",
        sa.Column("photo_id", sa.Uuid(), sa.ForeignKey("photos.id"), primary_key=True),
        sa.Column("raw_exif", sa.JSON(), nullable=False),
        sa.Column("gps", sa.JSON(), nullable=False),
    )
    op.create_table(
        "photo_translations",
        sa.Column("photo_id", sa.Uuid(), sa.ForeignKey("photos.id"), primary_key=True),
        sa.Column("locale", sa.String(5), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("caption", sa.Text(), nullable=False),
        sa.Column("alt_text", sa.String(1000), nullable=False),
    )
    op.create_table(
        "photo_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("photo_id", sa.Uuid(), sa.ForeignKey("photos.id"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("key", sa.String(512), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(64), nullable=False),
        sa.UniqueConstraint("photo_id", "kind"),
    )
    op.create_index("ix_photo_assets_photo_id", "photo_assets", ["photo_id"])
    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("photo_id", sa.Uuid(), sa.ForeignKey("photos.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_processing_jobs_photo_id", "processing_jobs", ["photo_id"])
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("processing_jobs")
    op.drop_table("photo_assets")
    op.drop_table("photo_translations")
    op.drop_table("photo_private_metadata")
    op.drop_table("photo_metadata")
    op.drop_table("photos")
