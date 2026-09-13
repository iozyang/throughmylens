"""Idempotent catalog backfill. Original EXIF and legacy fields are untouched."""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.photo import Photo, PhotoMetadata
from app.routers.photos import serialize


def main():
    with SessionLocal() as db:
        count = 0
        for photo in db.scalars(select(Photo).with_for_update()):
            metadata = db.get(PhotoMetadata, photo.id)
            if metadata and not metadata.record:
                metadata.record = serialize(photo, db)["record"]
                count += 1
        db.commit()
        print(f"Catalog records added: {count}. Existing records preserved.")


if __name__ == "__main__":
    main()
