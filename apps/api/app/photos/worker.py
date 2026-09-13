from __future__ import annotations

import logging
import threading
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import delete, or_, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.photo import Photo, PhotoAsset, PhotoMetadata, ProcessingJob
from app.photos.imaging import ImageRejected, render_variants
from app.photos.record import system_fields
from app.photos.schemas import ProcessingConfig
from app.storage.s3 import get_s3_client

logger = logging.getLogger(__name__)


class LeaseLost(RuntimeError):
    """A resumed worker already owns a newer attempt of this job."""


def process_next_job() -> bool:
    with SessionLocal() as db:
        stale = datetime.now(UTC) - timedelta(minutes=15)
        job = db.scalar(
            select(ProcessingJob)
            .where(
                or_(
                    ProcessingJob.status == "pending",
                    (ProcessingJob.status == "running") & (ProcessingJob.started_at < stale),
                )
            )
            .order_by(ProcessingJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job is None:
            return False
        photo = db.get(Photo, job.photo_id)
        if job.attempts >= 3:
            job.status = "failed"
            job.error = "处理任务多次中断，请检查图片服务后手动重试。"
            photo.processing_status = "failed"
            photo.processing_error = job.error
            db.commit()
            return True
        job.status = "running"
        job.attempts += 1
        job.started_at = datetime.now(UTC)
        photo.processing_status = "processing"
        job_id, photo_id, master_key = job.id, photo.id, photo.master_key
        attempt = job.attempts
        config = ProcessingConfig.model_validate(job.config)
        db.commit()

    settings = get_settings()
    client = get_s3_client()
    uploaded = []
    old_keys = []
    try:
        with TemporaryDirectory(prefix="tml-render-") as directory:
            path = Path(directory) / "master.jpg"
            client.download_file(settings.s3_private_bucket, master_key, str(path))
            variants = render_variants(path, config)
        for asset in variants:
            asset["key"] = f"photos/{photo_id}/renders/{job_id}/{attempt}/{asset['kind']}.jpg"
            client.put_object(
                Bucket=settings.s3_private_bucket,
                Key=asset["key"],
                Body=asset.pop("data"),
                ContentType="image/jpeg",
                CacheControl="private, max-age=300",
            )
            uploaded.append(asset["key"])
        with SessionLocal() as db:
            photo = db.get(Photo, photo_id)
            job = db.scalar(
                select(ProcessingJob).where(ProcessingJob.id == job_id).with_for_update()
            )
            if job.status != "running" or job.attempts != attempt:
                raise LeaseLost()
            photo = db.scalar(select(Photo).where(Photo.id == photo_id).with_for_update())
            old_keys = list(
                db.scalars(select(PhotoAsset.key).where(PhotoAsset.photo_id == photo_id))
            )
            db.execute(delete(PhotoAsset).where(PhotoAsset.photo_id == photo_id))
            for asset in variants:
                db.add(PhotoAsset(id=uuid.uuid4(), photo_id=photo_id, **asset))
            display = next(a for a in variants if a["kind"] == "display")
            photo.width, photo.height = display["width"], display["height"]
            metadata = db.get(PhotoMetadata, photo_id)
            if metadata.record:
                metadata.record = system_fields(metadata.record, photo, PhotoAsset(**display))
            photo.processing_status = "ready"
            photo.processing_error = None
            job.status = "succeeded"
            job.error = None
            job.finished_at = datetime.now(UTC)
            db.commit()
    except Exception as error:
        if not isinstance(error, LeaseLost):
            logger.exception("Photo processing failed for %s", photo_id)
        for key in uploaded:
            try:
                client.delete_object(Bucket=settings.s3_private_bucket, Key=key)
            except Exception:
                logger.warning("Unable to remove incomplete derivative %s", key)
        if isinstance(error, LeaseLost):
            return True
        message = (
            str(error)
            if isinstance(error, ImageRejected)
            else "图片处理失败，请检查图片服务后重试。"
        )
        with SessionLocal() as db:
            photo = db.get(Photo, photo_id)
            job = db.scalar(
                select(ProcessingJob).where(ProcessingJob.id == job_id).with_for_update()
            )
            if job.status != "running" or job.attempts != attempt:
                return True
            photo.processing_status = "failed"
            photo.processing_error = message
            job.status = "failed"
            job.error = message
            job.finished_at = datetime.now(UTC)
            db.commit()
        return True
    for key in old_keys:
        try:
            client.delete_object(Bucket=settings.s3_private_bucket, Key=key)
        except Exception:
            logger.warning("Unable to remove superseded derivative %s", key)
    return True


def run_worker(stop: threading.Event) -> None:
    while not stop.is_set():
        try:
            if process_next_job():
                continue
        except Exception:
            logger.exception("Image worker waiting for database/storage availability")
        stop.wait(3)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        run_worker(threading.Event())
    except KeyboardInterrupt:
        pass
