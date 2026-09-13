"""Friendly names are assigned once; physical objects and UUID URLs stay put."""

from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.models.photo import Photo, PhotoAsset, PhotoMetadata, PhotoNumber
from app.photos.record import system_fields


def filename_for(record: dict, created_at: datetime, number: int, extension=".jpg") -> str:
    if number < 1:
        raise ValueError("Photo number must be positive")
    fallback = created_at.replace(tzinfo=UTC) if created_at.tzinfo is None else created_at
    fallback = fallback.astimezone(ZoneInfo("Asia/Shanghai"))
    try:
        # Date-only EXIF uses midnight; never combine a capture date with an
        # unrelated upload clock time. Neither value is written into metadata.
        stamp = datetime.fromisoformat(f"{record['date']}T{record.get('time') or '00:00:00'}")
    except (KeyError, ValueError):
        stamp = fallback
    return f"{stamp:%Y%m%d-%H%M%S}-{number:06d}{extension.lower()}"


def assign_name(photo, record, db):
    number = db.scalar(select(PhotoNumber).where(PhotoNumber.photo_id == photo.id))
    if number is None:
        number = PhotoNumber(photo_id=photo.id)
        db.add(number)
        db.flush()
        photo.filename = filename_for(record, photo.created_at, number.id)
    return photo.filename


def migrate_names(db, apply=False):
    """One transaction, row locks, idempotent; no image data is moved/deleted."""
    changes = []
    for photo in db.scalars(select(Photo).order_by(Photo.created_at, Photo.id).with_for_update()):
        if db.scalar(select(PhotoNumber).where(PhotoNumber.photo_id == photo.id)):
            continue
        metadata = db.get(PhotoMetadata, photo.id)
        if not metadata or not metadata.record:
            raise ValueError(f"Missing canonical metadata: {photo.id}")
        old_file, old_slug = photo.filename, metadata.record.get("slug", Path(photo.filename).stem)
        assign_name(photo, metadata.record, db)
        display = db.scalar(
            select(PhotoAsset).where(PhotoAsset.photo_id == photo.id, PhotoAsset.kind == "display")
        )
        metadata.record = system_fields(metadata.record, photo, display)
        metadata.sources = {
            **metadata.sources,
            "previous_filename": old_file,
            "previous_slug": old_slug,
        }
        photo.version += 1
        changes.append({"id": str(photo.id), "before": old_file, "after": photo.filename})
    if apply:
        db.commit()
    else:
        db.rollback()
    return changes
