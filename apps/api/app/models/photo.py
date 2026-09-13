from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    master_key: Mapped[str] = mapped_column(String(512))
    byte_size: Mapped[int] = mapped_column(Integer)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    color_profile: Mapped[str] = mapped_column(String(255))
    processing_status: Mapped[str] = mapped_column(String(32), default="pending")
    publication_status: Mapped[str] = mapped_column(String(32), default="draft")
    processing_config: Mapped[dict] = mapped_column(JSON)
    processing_error: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PhotoMetadata(Base):
    __tablename__ = "photo_metadata"

    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"), primary_key=True)
    values: Mapped[dict] = mapped_column(JSON)
    record: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sources: Mapped[dict] = mapped_column(JSON)
    # Reviewed is independent of processing and publication states.
    review_status: Mapped[str] = mapped_column(String(32), default="needs_review")


class PhotoPrivateMetadata(Base):
    __tablename__ = "photo_private_metadata"

    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"), primary_key=True)
    raw_exif: Mapped[dict] = mapped_column(JSON)
    gps: Mapped[dict] = mapped_column(JSON)


class PhotoTranslation(Base):
    __tablename__ = "photo_translations"

    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"), primary_key=True)
    locale: Mapped[str] = mapped_column(String(5), primary_key=True)
    title: Mapped[str] = mapped_column(String(300), default="")
    caption: Mapped[str] = mapped_column(Text, default="")
    alt_text: Mapped[str] = mapped_column(String(1000), default="")


class PhotoAsset(Base):
    __tablename__ = "photo_assets"
    __table_args__ = (UniqueConstraint("photo_id", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    key: Mapped[str] = mapped_column(String(512))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    byte_size: Mapped[int] = mapped_column(Integer)
    quality: Mapped[int] = mapped_column(Integer)
    content_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    config: Mapped[dict] = mapped_column(JSON)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
