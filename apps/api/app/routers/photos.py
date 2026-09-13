from __future__ import annotations

import logging
import uuid
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Literal

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.responses import RedirectResponse

from app.core.config import get_settings
from app.db.session import get_db
from app.models.photo import (
    Photo,
    PhotoAsset,
    PhotoMetadata,
    PhotoPrivateMetadata,
    PhotoTranslation,
    ProcessingJob,
)
from app.models.user import User
from app.photos.imaging import ImageRejected, ImagingUnavailable, inspect_jpeg
from app.photos.record import (
    CatalogRecord,
    RecordEdit,
    VersionEdit,
    from_legacy,
    legacy_values,
    require_complete,
    system_fields,
)
from app.photos.schemas import PhotoEdit, ProcessingConfig, missing_fields
from app.routers.auth import get_current_admin, require_csrf
from app.storage.s3 import get_s3_client, get_s3_signing_client

router = APIRouter(
    prefix="/photos", tags=["photo library"], dependencies=[Depends(get_current_admin)]
)
logger = logging.getLogger(__name__)


def upload_recipe(
    preset: Literal["preserve", "web_standard"] = Query("preserve"),
    long_edge: int = Query(3000, ge=1280, le=6000),
    quality: int = Query(90, ge=60, le=100),
    min_quality: int = Query(80, ge=60, le=100),
    max_output_kb: int = Query(4096, ge=128, le=16384),
) -> ProcessingConfig:
    try:
        return ProcessingConfig(
            preset=preset,
            long_edge=long_edge,
            quality=quality,
            min_quality=min_quality,
            max_output_kb=max_output_kb,
        )
    except ValidationError as error:
        raise HTTPException(422, "最低 JPEG 质量不能高于目标质量。") from error


def get_photo(db: Session, photo_id: uuid.UUID, lock=False) -> Photo:
    statement = select(Photo).where(Photo.id == photo_id)
    if lock:
        statement = statement.with_for_update()
    photo = db.scalar(statement)
    if not photo:
        raise HTTPException(404, "照片不存在。")
    return photo


def serialize(photo: Photo, db: Session) -> dict:
    metadata = db.get(PhotoMetadata, photo.id)
    assets = db.scalars(select(PhotoAsset).where(PhotoAsset.photo_id == photo.id)).all()
    translations = list(
        db.scalars(select(PhotoTranslation).where(PhotoTranslation.photo_id == photo.id))
    )
    translated = {
        t.locale: {"title": t.title, "caption": t.caption, "alt_text": t.alt_text}
        for t in translations
    }
    record = metadata.record
    if not record:
        private = db.get(PhotoPrivateMetadata, photo.id)
        record = from_legacy(metadata.values, private.raw_exif if private else {}, translated)
    record = system_fields(record, photo, next((a for a in assets if a.kind == "display"), None))
    settings = get_settings()
    return {
        "id": str(photo.id),
        "filename": photo.filename,
        "width": photo.width,
        "height": photo.height,
        "byte_size": photo.byte_size,
        "color_profile": photo.color_profile,
        "processing_status": photo.processing_status,
        "publication_status": photo.publication_status,
        "processing_config": photo.processing_config,
        "processing_error": photo.processing_error,
        "metadata": metadata.values,
        "record": record,
        "sources": metadata.sources,
        "review_status": metadata.review_status,
        "missing_fields": missing_fields(metadata.values),
        "translations": {
            t.locale: {"title": t.title, "caption": t.caption, "alt_text": t.alt_text}
            for t in translations
        },
        "version": photo.version,
        "created_at": photo.created_at.isoformat(),
        "assets": [
            {
                "kind": a.kind,
                "width": a.width,
                "height": a.height,
                "byte_size": a.byte_size,
                "quality": a.quality,
                "url": get_s3_signing_client().generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": settings.s3_private_bucket,
                        "Key": a.key,
                    },
                    ExpiresIn=900,
                ),
            }
            for a in assets
        ],
    }


@router.get("")
def list_photos(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(40, ge=1, le=200),
    deleted: bool = False,
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, no-store"
    photos = db.scalars(
        select(Photo)
        .where(
            Photo.publication_status == "deleted"
            if deleted
            else Photo.publication_status != "deleted"
        )
        .order_by(Photo.created_at.desc(), Photo.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return {
        "items": [serialize(photo, db) for photo in photos],
        "total": db.scalar(
            select(func.count())
            .select_from(Photo)
            .where(
                Photo.publication_status == "deleted"
                if deleted
                else Photo.publication_status != "deleted"
            )
        ),
        "page": page,
    }


@router.get("/config")
def upload_config():
    settings = get_settings()
    return {
        "max_upload_mb": settings.photo_max_upload_mb,
        "max_megapixels": settings.photo_max_megapixels,
        "defaults": ProcessingConfig().model_dump(),
    }


@router.get("/{photo_id}")
def photo_detail(photo_id: uuid.UUID, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "private, no-store"
    return serialize(get_photo(db, photo_id), db)


def ingest(path: Path, filename: str, config: ProcessingConfig, admin: User, db: Session):
    try:
        inspection = inspect_jpeg(path)
    except ImageRejected as error:
        raise HTTPException(422, str(error)) from error
    except ImagingUnavailable as error:
        raise HTTPException(503, str(error)) from error
    existing = db.scalar(select(Photo).where(Photo.sha256 == inspection.sha256))
    if existing:
        raise HTTPException(409, {"message": "这张照片已经入库。", "photo_id": str(existing.id)})
    photo_id = uuid.uuid4()
    key = f"photos/{photo_id}/master.jpg"
    client = get_s3_client()
    bucket = get_settings().s3_private_bucket
    try:
        with path.open("rb") as source:
            client.put_object(Bucket=bucket, Key=key, Body=source, ContentType="image/jpeg")
    except ClientError as error:
        logger.exception("Master upload failed")
        code = error.response["Error"]["Code"]
        if code == "NoSuchBucket":
            detail = "私有存储尚未初始化，请重新运行 API 启动脚本以创建存储桶。"
        elif code in ("AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch"):
            detail = "私有存储鉴权失败，请核对后端 S3 凭据。"
        else:
            detail = "私有存储暂不可用，请检查 MinIO 后重试。"
        raise HTTPException(503, detail) from error
    except Exception as error:
        logger.exception("Master upload failed")
        raise HTTPException(503, "私有存储暂不可用，请检查 MinIO 后重试。") from error
    photo = Photo(
        id=photo_id,
        filename=f"{photo_id.hex}.jpg",
        sha256=inspection.sha256,
        master_key=key,
        byte_size=inspection.byte_size,
        width=inspection.width,
        height=inspection.height,
        color_profile=inspection.color_profile,
        processing_config=config.model_dump(),
        created_by=admin.id,
    )
    try:
        db.add(photo)
        db.flush()
        record = system_fields(
            from_legacy(inspection.metadata, inspection.raw_exif, {}, exif_location=True), photo
        )
        db.add(
            PhotoMetadata(
                photo_id=photo_id,
                values=inspection.metadata,
                record=record,
                sources={k: "exif" for k, v in inspection.metadata.items() if v not in (None, "")},
            )
        )
        db.add(
            PhotoPrivateMetadata(
                photo_id=photo_id, raw_exif=inspection.raw_exif, gps=inspection.gps
            )
        )
        for locale in ("zh", "en"):
            db.add(PhotoTranslation(photo_id=photo_id, locale=locale))
        db.add(ProcessingJob(photo_id=photo_id, config=config.model_dump()))
        db.commit()
    except Exception as error:
        db.rollback()
        try:
            client.delete_object(Bucket=bucket, Key=key)
        except Exception:
            logger.warning("Unable to remove uncommitted master %s", key)
        if isinstance(error, IntegrityError):
            raise HTTPException(409, "照片已入库，请刷新图库确认。") from error
        raise
    db.refresh(photo)
    return serialize(photo, db)


@router.post("/upload", status_code=201, dependencies=[Depends(require_csrf)])
async def upload(
    request: Request,
    filename: str = Query(min_length=1, max_length=255),
    config: ProcessingConfig = Depends(upload_recipe),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Raw streamed file avoids parsing/spooling an unbounded multipart body first.
    limit = get_settings().photo_max_upload_mb * 1024 * 1024
    try:
        content_length = int(request.headers.get("content-length", "0"))
    except ValueError as error:
        raise HTTPException(400, "无效的文件长度。") from error
    if content_length > limit:
        raise HTTPException(413, "照片超过上传体积上限。")
    if Path(filename).suffix.lower() not in (".jpg", ".jpeg"):
        raise HTTPException(422, "请上传 .jpg 或 .jpeg 文件。")
    with TemporaryDirectory(prefix="tml-upload-") as directory:
        path = Path(directory) / "upload.jpg"
        total = 0
        with path.open("wb") as target:
            async for chunk in request.stream():
                total += len(chunk)
                if total > limit:
                    raise HTTPException(413, "照片超过上传体积上限。")
                await run_in_threadpool(target.write, chunk)
        return await run_in_threadpool(ingest, path, filename, config, admin, db)


@router.patch("/{photo_id}", dependencies=[Depends(require_csrf)])
def update_photo(photo_id: uuid.UUID, payload: PhotoEdit, db: Session = Depends(get_db)):
    photo = get_photo(db, photo_id, lock=True)
    if photo.publication_status == "deleted":
        raise HTTPException(409, "请先恢复照片。")
    if photo.version != payload.version:
        raise HTTPException(409, "照片已在其他窗口修改，请重新打开后再保存。")
    values = payload.metadata.model_dump()
    if payload.reviewed and missing_fields(values):
        raise HTTPException(422, "请补全缺失拍摄信息后再确认审核。")
    metadata = db.get(PhotoMetadata, photo_id)
    sources = dict(metadata.sources)
    for key, value in values.items():
        if value != metadata.values.get(key):
            sources[key] = "manual" if value not in (None, "") else "missing"
    # Keep the older endpoint compatible without discarding extended catalog fields.
    record = serialize(photo, db)["record"]
    updated = from_legacy(values, {}, {k: v.model_dump() for k, v in payload.translations.items()})
    for key in ("camera", "focalLength", "aperture", "shutterSpeed", "iso", "date", "time"):
        record[key] = updated[key]
    record["lens"]["model"] = updated["lens"]["model"]
    if values["location"] != metadata.values.get("location"):
        record["location"] = updated["location"]
    for locale in payload.translations:
        for key in ("title", "description", "alt"):
            record[key][locale] = updated[key][locale]
    metadata.record = CatalogRecord.model_validate(record).model_dump()
    metadata.values, metadata.sources = values, sources
    metadata.review_status = "reviewed" if payload.reviewed else "needs_review"
    for locale, translation in payload.translations.items():
        row = db.get(PhotoTranslation, (photo_id, locale))
        row.title, row.caption, row.alt_text = (
            translation.title,
            translation.caption,
            translation.alt_text,
        )
    photo.version += 1
    db.commit()
    db.refresh(photo)
    return serialize(photo, db)


@router.patch("/{photo_id}/metadata", dependencies=[Depends(require_csrf)])
def update_record(photo_id: uuid.UUID, payload: RecordEdit, db: Session = Depends(get_db)):
    photo = get_photo(db, photo_id, lock=True)
    if photo.publication_status == "deleted":
        raise HTTPException(409, "请先恢复照片。")
    if photo.version != payload.version:
        raise HTTPException(409, "照片已在其他窗口修改。请先复制未保存的 JSON，再关闭重开此照片。")
    try:
        require_complete(payload.record)
        display = db.scalar(
            select(PhotoAsset).where(PhotoAsset.photo_id == photo_id, PhotoAsset.kind == "display")
        )
        record = system_fields(payload.record, photo, display)
        values = legacy_values(record)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    if payload.reviewed and missing_fields(values):
        raise HTTPException(422, "请补全相机、镜头、曝光参数和地点后确认核对。")
    metadata = db.get(PhotoMetadata, photo_id)
    metadata.sources = {
        **metadata.sources,
        **{
            k: "manual" if v not in (None, "") else "missing"
            for k, v in values.items()
            if metadata.values.get(k) != v
        },
    }
    metadata.values = values
    metadata.record = record
    metadata.review_status = "reviewed" if payload.reviewed else "needs_review"
    for locale in ("zh", "en"):
        row = db.get(PhotoTranslation, (photo_id, locale))
        row.title = record["title"][locale]
        row.caption = record["description"][locale]
        row.alt_text = record["alt"][locale]
    photo.version += 1
    db.commit()
    return serialize(photo, db)


@router.get("/{photo_id}/image")
def photo_image(photo_id: uuid.UUID, db: Session = Depends(get_db)):
    photo = get_photo(db, photo_id)
    if photo.publication_status == "deleted":
        raise HTTPException(404, "照片已移入最近删除。")
    asset = db.scalar(
        select(PhotoAsset).where(PhotoAsset.photo_id == photo_id, PhotoAsset.kind == "display")
    )
    if not asset:
        raise HTTPException(409, "展示图尚未生成。")
    url = get_s3_signing_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": get_settings().s3_private_bucket, "Key": asset.key},
        ExpiresIn=300,
    )
    return RedirectResponse(url, headers={"Cache-Control": "private, no-store"})


@router.delete("/{photo_id}", dependencies=[Depends(require_csrf)])
def delete_photo(photo_id: uuid.UUID, payload: VersionEdit, db: Session = Depends(get_db)):
    photo = get_photo(db, photo_id, lock=True)
    if photo.version != payload.version:
        raise HTTPException(409, "照片已变化，请刷新后重试。")
    if photo.processing_status in ("pending", "processing"):
        raise HTTPException(409, "请等待图片处理结束后再删除。")
    if photo.publication_status != "draft":
        raise HTTPException(409, "仅可删除草稿照片；已公开作品请先撤下。")
    photo.publication_status = "deleted"
    photo.version += 1
    db.commit()
    return {"status": "deleted", "recoverable": True}


@router.post("/{photo_id}/restore", dependencies=[Depends(require_csrf)])
def restore_photo(photo_id: uuid.UUID, payload: VersionEdit, db: Session = Depends(get_db)):
    photo = get_photo(db, photo_id, lock=True)
    if photo.version != payload.version or photo.publication_status != "deleted":
        raise HTTPException(409, "照片已变化，请刷新后重试。")
    photo.publication_status = "draft"
    photo.version += 1
    db.commit()
    return serialize(photo, db)


@router.post("/{photo_id}/reprocess", status_code=202, dependencies=[Depends(require_csrf)])
def reprocess(photo_id: uuid.UUID, config: ProcessingConfig, db: Session = Depends(get_db)):
    photo = get_photo(db, photo_id, lock=True)
    if photo.processing_status in ("pending", "processing"):
        raise HTTPException(409, "照片正在处理，请稍后再试。")
    if photo.publication_status != "draft":
        raise HTTPException(409, "请先将照片转为草稿，再重新处理。")
    photo.processing_config = config.model_dump()
    photo.processing_status = "pending"
    photo.processing_error = None
    db.add(ProcessingJob(photo_id=photo_id, config=config.model_dump()))
    db.commit()
    return {"status": "pending"}
