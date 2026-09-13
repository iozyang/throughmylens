"""Run against local PostgreSQL/MinIO using a disposable schema and private bucket.

From apps/api: .venv/Scripts/python scripts/smoke_photos.py
No existing accounts, photographs or storage objects are modified.
"""

from __future__ import annotations

import io
import logging
import re
import secrets
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageCms  # noqa: E402
from sqlalchemy import create_engine, select, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db import session as database  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.models import (  # noqa: E402
    Photo,
    PhotoAsset,
    PhotoPrivateMetadata,
    ProcessingJob,
    User,
)
from app.storage.s3 import get_s3_client, verify_storage_buckets  # noqa: E402


def main():
    settings = get_settings()
    if settings.environment != "development":
        raise SystemExit("Smoke test is limited to the development environment.")
    # Check real application prerequisites before testing with temporary resources.
    verify_storage_buckets()
    print("PASS: actual application storage buckets exist and are accessible")
    suffix = uuid.uuid4().hex
    schema = f"tml_test_{suffix}"
    bucket = f"tml-test-{suffix}"
    assert re.fullmatch(r"tml_test_[a-f0-9]{32}", schema)
    storage = get_s3_client()
    original_engine = database.engine
    with original_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    test_engine = create_engine(
        settings.database_url, connect_args={"options": f"-csearch_path={schema}"}
    )
    try:
        storage.create_bucket(Bucket=bucket)
        settings.s3_private_bucket = bucket
        settings.image_worker_enabled = False
        database.engine = test_engine
        database.SessionLocal = sessionmaker(bind=test_engine, autoflush=False)
        Base.metadata.create_all(test_engine)

        # Import after redirecting this process's session factory to its isolated schema.
        from app.main import app
        from app.photos.worker import process_next_job
        from app.routers.auth import password_hasher

        logging.getLogger("pyvips").setLevel(logging.WARNING)
        logging.getLogger("httpx").setLevel(logging.WARNING)

        password = secrets.token_urlsafe(24)
        with database.SessionLocal() as db:
            db.add(User(email="smoke@example.com", password_hash=password_hasher.hash(password)))
            db.commit()

        with TestClient(app) as client, TemporaryDirectory(prefix="tml-smoke-") as directory:
            assert client.get("/api/v1/photos").status_code == 401
            login = client.post(
                "/api/v1/auth/login", json={"email": "smoke@example.com", "password": password}
            )
            assert login.status_code == 200, login.text
            csrf = {"X-CSRF-Token": client.cookies[settings.auth_csrf_cookie_name]}
            path = Path(directory) / "test.jpg"
            exif = Image.Exif()
            exif[271] = "Test Camera"
            exif[272] = "Test Body"
            exif[34665] = {
                40961: 1,
                33434: 0.004,
                33437: 2.8,
                34855: 100,
                37386: 50,
                42036: "Test 50mm",
                42033: "PRIVATE-SERIAL",
            }
            exif[34853] = {1: "N", 2: (31, 12, 0), 3: "E", 4: (121, 30, 0)}
            Image.new("RGB", (3000, 2000), (125, 65, 24)).save(
                path,
                "JPEG",
                exif=exif,
                icc_profile=ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes(),
            )
            data = path.read_bytes()
            assert (
                client.post("/api/v1/photos/upload?filename=test.jpg", content=data).status_code
                == 403
            )
            assert (
                client.post(
                    "/api/v1/photos/upload?filename=test.jpg&quality=60&min_quality=80",
                    content=data,
                    headers=csrf,
                ).status_code
                == 422
            )
            upload = client.post(
                "/api/v1/photos/upload?filename=test.jpg", content=data, headers=csrf
            )
            assert upload.status_code == 201, upload.text
            photo = upload.json()
            photo_id = photo["id"]
            assert photo["missing_fields"] == ["location"], photo["missing_fields"]
            assert photo["processing_status"] == "pending"
            assert "raw_exif" not in photo and "PRIVATE-SERIAL" not in upload.text
            assert (
                client.post(
                    "/api/v1/photos/upload?filename=duplicate.jpg", content=data, headers=csrf
                ).status_code
                == 409
            )
            print("PASS: auth, CSRF, validation, real private upload, SHA-256 deduplication")

            assert process_next_job()
            photo = client.get(f"/api/v1/photos/{photo_id}").json()
            assert photo["processing_status"] == "ready", photo["processing_error"]
            assert len(photo["assets"]) == 3
            preview_url = photo["assets"][0]["url"]
            with httpx.Client(trust_env=False, timeout=5) as http:
                assert http.get(preview_url).status_code == 200
                assert http.get(preview_url.split("?", 1)[0]).status_code == 403
            for asset in photo["assets"]:
                with database.SessionLocal() as db:
                    row = db.scalar(
                        select(PhotoAsset).where(
                            PhotoAsset.photo_id == uuid.UUID(photo_id),
                            PhotoAsset.kind == asset["kind"],
                        )
                    )
                    obj = storage.get_object(Bucket=bucket, Key=row.key)
                    body = obj["Body"].read()
                    with Image.open(io.BytesIO(body)) as derivative:
                        assert not derivative.getexif()
                        assert derivative.info.get("icc_profile")
            print("PASS: three derivatives, controlled sRGB, stripped GPS and serial metadata")

            payload = {
                "version": photo["version"],
                "metadata": photo["metadata"],
                "translations": photo["translations"],
                "reviewed": True,
            }
            assert (
                client.patch(f"/api/v1/photos/{photo_id}", json=payload, headers=csrf).status_code
                == 422
            )
            payload["metadata"]["location"] = "中国 · 上海"
            payload["metadata"]["camera_model"] = "Manually corrected body"
            payload["translations"]["zh"]["title"] = "测试照片"
            result = client.patch(f"/api/v1/photos/{photo_id}", json=payload, headers=csrf)
            assert result.status_code == 200, result.text
            assert result.json()["review_status"] == "reviewed"
            assert result.json()["sources"]["camera_model"] == "manual"
            assert (
                client.patch(f"/api/v1/photos/{photo_id}", json=payload, headers=csrf).status_code
                == 409
            )
            assert result.json()["translations"]["en"]["title"] == ""
            print("PASS: metadata completion, manual provenance, bilingual records, edit conflict")

            recipe = {
                "preset": "web_standard",
                "long_edge": 1500,
                "quality": 88,
                "min_quality": 80,
                "max_output_kb": 2048,
            }
            retry = client.post(f"/api/v1/photos/{photo_id}/reprocess", json=recipe, headers=csrf)
            assert retry.status_code == 202, retry.text
            assert (
                client.post(
                    f"/api/v1/photos/{photo_id}/reprocess", json=recipe, headers=csrf
                ).status_code
                == 409
            )
            assert process_next_job()
            photo = client.get(f"/api/v1/photos/{photo_id}").json()
            display = next(a for a in photo["assets"] if a["kind"] == "display")
            assert (display["width"], display["height"]) == (1500, 1000)
            assert photo["metadata"]["camera_model"] == "Manually corrected body"
            assert photo["translations"]["zh"]["title"] == "测试照片"
            with database.SessionLocal() as db:
                private = db.get(PhotoPrivateMetadata, uuid.UUID(photo_id))
                assert "PRIVATE-SERIAL" in str(private.raw_exif)
                assert private.gps
                assert db.get(Photo, uuid.UUID(photo_id)).publication_status == "draft"
                assert all(j.status == "succeeded" for j in db.scalars(select(ProcessingJob)))
            print("PASS: reprocessing resizes correctly and preserves original EXIF/manual text")

            # Failure keeps the previous assets, and stale jobs survive a process restart.
            from app.photos import worker
            from app.photos.imaging import ImageRejected

            saved_renderer = worker.render_variants
            with database.SessionLocal() as db:
                before_keys = list(db.scalars(select(PhotoAsset.key)))

            def fail_render(path, config):
                raise ImageRejected("Simulated bounded processing failure")

            assert (
                client.post(
                    f"/api/v1/photos/{photo_id}/reprocess", json=recipe, headers=csrf
                ).status_code
                == 202
            )
            worker.render_variants = fail_render
            worker.logger.disabled = True
            try:
                assert process_next_job()
            finally:
                worker.render_variants = saved_renderer
                worker.logger.disabled = False
            failed = client.get(f"/api/v1/photos/{photo_id}").json()
            assert failed["processing_status"] == "failed"
            with database.SessionLocal() as db:
                assert list(db.scalars(select(PhotoAsset.key))) == before_keys
            assert (
                client.post(
                    f"/api/v1/photos/{photo_id}/reprocess", json=recipe, headers=csrf
                ).status_code
                == 202
            )
            with database.SessionLocal() as db:
                interrupted = db.scalar(
                    select(ProcessingJob).where(ProcessingJob.status == "pending")
                )
                interrupted.status = "running"
                interrupted.attempts = 1
                interrupted.started_at = datetime.now(UTC) - timedelta(minutes=16)
                db.commit()
            assert process_next_job()
            restored = client.get(f"/api/v1/photos/{photo_id}").json()
            assert restored["processing_status"] == "ready"
            assert restored["metadata"]["camera_model"] == "Manually corrected body"
            print("PASS: private preview access, failure preserves assets, stale job recovery")
            assert client.post("/api/v1/auth/logout", headers=csrf).status_code == 204
            assert client.get("/api/v1/photos").status_code == 401
    finally:
        # Only resources created by this exact run are eligible for cleanup.
        try:
            paginator = storage.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket):
                for obj in page.get("Contents", []):
                    storage.delete_object(Bucket=bucket, Key=obj["Key"])
            storage.delete_bucket(Bucket=bucket)
        finally:
            test_engine.dispose()
            with original_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    print("PASS: temporary schema, account, photos and bucket cleaned up")


if __name__ == "__main__":
    main()
