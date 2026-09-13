"""Add reusable preview sizes without replacing display files or metadata."""

import uuid
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import select

from app.core.config import get_settings
from app.models.photo import Photo, PhotoAsset
from app.photos.imaging import render_variants
from app.photos.schemas import ProcessingConfig
from app.storage.s3 import get_s3_client


def backfill(db):
    client, bucket = get_s3_client(), get_settings().s3_private_bucket
    added = 0
    ids = list(db.scalars(select(Photo.id).where(Photo.processing_status == "ready")))
    for photo_id in ids:
        photo = db.scalar(select(Photo).where(Photo.id == photo_id).with_for_update())
        if photo.processing_status != "ready":
            db.rollback()
            continue
        assets = list(db.scalars(select(PhotoAsset).where(PhotoAsset.photo_id == photo_id)))
        missing = tuple(k for k in ("micro", "preview") if not any(a.kind == k for a in assets))
        source = next((a for a in assets if a.kind == "gallery"), None)
        if not source or not missing:
            db.rollback()
            continue
        uploaded = []
        try:
            with TemporaryDirectory(prefix="tml-preview-") as directory:
                path = Path(directory) / "source.jpg"
                client.download_file(bucket, source.key, str(path))
                config = ProcessingConfig(**{**photo.processing_config, "preset": "preserve"})
                for result in render_variants(path, config, kinds=missing):
                    key = f"photos/{photo_id}/previews/{uuid.uuid4()}/{result['kind']}.jpg"
                    client.put_object(
                        Bucket=bucket,
                        Key=key,
                        Body=result["data"],
                        ContentType="image/jpeg",
                        CacheControl="private, max-age=300",
                    )
                    uploaded.append(key)
                    db.add(
                        PhotoAsset(
                            photo_id=photo_id,
                            key=key,
                            **{k: v for k, v in result.items() if k != "data"},
                        )
                    )
                db.commit()
                added += len(uploaded)
        except Exception:
            db.rollback()
            for key in uploaded:
                client.delete_object(Bucket=bucket, Key=key)
            raise
    return added
