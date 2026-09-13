import copy
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.models.photo import Photo, PhotoAsset, PhotoMetadata, PhotoPrivateMetadata
from app.models.user import User
from app.photos.imaging import Inspection
from app.photos.record import CatalogRecord, from_legacy, require_complete, system_fields
from app.photos.schemas import ProcessingConfig
from app.routers import photos
from app.routers.auth import get_current_admin, require_csrf


def test_complete_empty_contract_and_system_identity():
    record = CatalogRecord().model_dump()
    require_complete(record)
    assert "null" not in str(record).lower()
    assert record["iso"] == record["tags"] == record["geo"]["latitude"] == ""
    photo = SimpleNamespace(id=uuid.uuid4(), filename="stable.jpg", created_at=datetime.now(UTC))
    record.update(slug="forged", file="renamed.jpg", src="https://evil.invalid")
    pending = system_fields(record, photo)
    assert pending["slug"] == "stable"
    assert pending["file"] == "stable.jpg"
    assert pending["width"] == pending["height"] == ""
    rendered = system_fields(pending, photo, SimpleNamespace(width=1500, height=1000))
    assert (rendered["width"], rendered["height"]) == (1500, 1000)
    assert rendered["order"] == pending["order"]


@pytest.mark.parametrize("iso", [59, 60, 100, ""])
def test_iso_accepts_positive_integers_and_empty(iso):
    assert CatalogRecord(iso=iso).iso == iso


@pytest.mark.parametrize(
    "changes",
    [
        {"iso": 100.01},
        {"iso": "100"},
        {"iso": 0},
        {"iso": None},
        {"date": "2025-02-30"},
        {"time": "25:00:00"},
        {"timezone": "Asia/Unknown"},
        {"aperture": "f/0"},
        {"shutterSpeed": "1/0s"},
        {"focalLength": "50"},
        {"geo": {"latitude": 20}},
        {"tags": [""]},
    ],
)
def test_invalid_fields_are_rejected(changes):
    with pytest.raises(ValueError):
        CatalogRecord(**changes)


def test_location_generation_timezone_and_private_exif():
    original = from_legacy({"camera_make": "DJI", "lens": "Lens", "location": "旧手填地点"}, {}, {})
    assert original["location"]["display"]["zh"] == "旧手填地点"
    original["location"].update(
        place={"zh": "外滩", "en": ""},
        city={"zh": "上海", "en": ""},
        region={"zh": "上海", "en": ""},
        countryCode="CN",
    )
    original["location"]["display"]["zh"] = "不能直接改"
    photo = SimpleNamespace(id=uuid.uuid4(), filename="stable.jpg", created_at=datetime.now(UTC))
    generated = system_fields(original, photo)
    assert generated["location"]["display"]["zh"] == "外滩，上海"
    assert generated["timezone"] == "Asia/Shanghai"
    zero = CatalogRecord(
        geo={"latitude": 0, "longitude": 0, "source": "manual", "precision": "exact"}
    )
    assert zero.geo.latitude == 0
    assert CatalogRecord(tags=["风光", "landscape", "风光"]).tags == ["风光", "landscape"]


@pytest.fixture
def library(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    with sessions() as db:
        admin = User(email="test@example.com", password_hash="unused")
        db.add(admin)
        db.commit()
    storage = SimpleNamespace(
        put_object=lambda **kwargs: None,
        delete_object=lambda **kwargs: None,
        generate_presigned_url=lambda *args, **kwargs: "http://storage.invalid/private-test.jpg",
    )
    monkeypatch.setattr(photos, "get_s3_client", lambda: storage)
    monkeypatch.setattr(photos, "get_s3_signing_client", lambda: storage)
    inspection = Inspection(
        3000,
        2000,
        "a" * 64,
        10,
        "sRGB",
        {
            "camera_make": "DJI",
            "camera_model": "Camera",
            "lens": "Lens",
            "focal_length": 50,
            "aperture": 2.8,
            "shutter_speed": "1/250",
            "iso": 100,
            "captured_at": "2026:09:13 12:30:00",
            "location": "上海",
        },
        {
            "IPTC:City": "上海",
            "IPTC:Country-PrimaryLocationName": "中国",
            "Composite:GPSLatitude": 31.2,
            "Composite:GPSLongitude": 121.5,
        },
        {},
    )
    monkeypatch.setattr(photos, "inspect_jpeg", lambda path: inspection)
    path = tmp_path / "source.jpg"
    path.write_bytes(b"test input")
    with sessions() as db:
        result = photos.ingest(path, "中文原件.jpg", ProcessingConfig(), admin, db)
    app = FastAPI()
    app.include_router(photos.router)

    def database():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_admin] = lambda: admin
    app.dependency_overrides[require_csrf] = lambda: None
    with TestClient(app) as client:
        yield client, result, sessions, app
    engine.dispose()


def test_ingest_edit_atomicity_dimensions_delete_restore(library):
    client, initial, sessions, _ = library
    photo_id = initial["id"]
    assert initial["filename"] == "20260913-123000-000001.jpg"
    assert initial["record"]["width"] == ""
    assert initial["record"]["location"]["city"]["zh"] == "上海"
    with sessions() as db:
        photo = db.get(Photo, uuid.UUID(photo_id))
        photo.processing_status = "ready"
        db.add(
            PhotoAsset(
                photo_id=photo.id,
                kind="display",
                key="private/render.jpg",
                width=1500,
                height=1000,
                byte_size=100,
                quality=90,
            )
        )
        db.commit()
    payload = {"version": initial["version"], "record": initial["record"], "reviewed": True}
    payload["record"]["file"] = "attempted-rename.jpg"
    payload["record"]["title"]["zh"] = "测试标题"
    payload["record"]["tags"] = ["风光"]
    result = client.patch(f"/photos/{photo_id}/metadata", json=payload)
    assert result.status_code == 200, result.text
    saved = result.json()
    assert saved["record"]["file"] == initial["filename"]
    assert saved["record"]["width"] == 1500
    assert saved["translations"]["zh"]["title"] == "测试标题"
    assert saved["record"]["iso"] == 100
    assert client.patch(f"/photos/{photo_id}/metadata", json=payload).status_code == 409
    payload["version"] = saved["version"]
    incomplete = copy.deepcopy(payload)
    del incomplete["record"]["camera"]["brand"]
    assert client.patch(f"/photos/{photo_id}/metadata", json=incomplete).status_code == 422
    invalid = copy.deepcopy(payload)
    invalid["record"]["iso"] = 100.01
    assert client.patch(f"/photos/{photo_id}/metadata", json=invalid).status_code == 422
    assert client.get(f"/photos/{photo_id}").json()["record"] == saved["record"]
    result = client.request("DELETE", f"/photos/{photo_id}", json={"version": saved["version"]})
    assert result.status_code == 200
    assert client.get("/photos").json()["total"] == 0
    trash = client.get("/photos?deleted=true").json()["items"][0]
    assert client.get(f"/photos/{photo_id}/image").status_code == 404
    restored = client.post(f"/photos/{photo_id}/restore", json={"version": trash["version"]})
    assert restored.status_code == 200
    assert client.get("/photos").json()["total"] == 1
    with sessions() as db:
        assert db.get(PhotoPrivateMetadata, uuid.UUID(photo_id)) is not None
        assert db.get(PhotoMetadata, uuid.UUID(photo_id)).record == saved["record"]


def test_mutations_require_csrf_and_gallery_requires_login(library):
    client, initial, _, app = library
    del app.dependency_overrides[require_csrf]
    assert client.post(f"/photos/{initial['id']}/translate", json={"fields": {}}).status_code == 403
    assert (
        client.patch(
            f"/photos/{initial['id']}/metadata", json={"version": 1, "record": initial["record"]}
        ).status_code
        == 403
    )
    del app.dependency_overrides[get_current_admin]
    for endpoint in ("/photos", f"/photos/{initial['id']}", f"/photos/{initial['id']}/image", f"/photos/{initial['id']}/assets/{uuid.uuid4()}"):
        assert client.get(endpoint).status_code == 401


def test_old_names_migrate_once_and_uuid_links_survive(library):
    from app.models.photo import PhotoNumber
    from app.photos.naming import migrate_names
    client, initial, sessions, _ = library
    with sessions() as db:
        photo = db.get(Photo, uuid.UUID(initial["id"]))
        db.delete(db.scalar(select(PhotoNumber).where(PhotoNumber.photo_id == photo.id)))
        photo.filename = "old-original.jpg"
        db.commit()
        before = copy.deepcopy(db.get(PhotoMetadata, photo.id).record)
        master_key = photo.master_key
        assert len(migrate_names(db, apply=True)) == 1
        assert migrate_names(db, apply=True) == []
        assert photo.master_key == master_key
        metadata = db.get(PhotoMetadata, photo.id)
        assert metadata.sources["previous_filename"] == "old-original.jpg"
        assert metadata.record["src"] == before["src"]
        assert metadata.record["title"] == before["title"]
    assert client.get(f"/photos/{initial['id']}").status_code == 200


def test_private_asset_url_is_stable_and_cache_remains_private(library, monkeypatch):
    import io
    from botocore.response import StreamingBody
    client, initial, sessions, _ = library
    with sessions() as db:
        asset = PhotoAsset(photo_id=uuid.UUID(initial["id"]), kind="thumbnail", key="test.jpg", width=3, height=2, byte_size=4, quality=90)
        db.add(asset); db.commit()
        path = f"/photos/{initial['id']}/assets/{asset.id}"
    monkeypatch.setattr(photos, "get_s3_client", lambda: SimpleNamespace(get_object=lambda **kwargs: {"Body": StreamingBody(io.BytesIO(b"jpeg"), 4)}))
    a = client.get(f"/photos/{initial['id']}").json()
    b = client.get(f"/photos/{initial['id']}").json()
    assert a["assets"][0]["url"] == b["assets"][0]["url"] == "/api/v1" + path
    response = client.get(path)
    assert response.content == b"jpeg"
    assert response.headers["cache-control"] == "private, max-age=300"
    assert response.headers["vary"] == "Cookie"


def test_worker_persists_final_dimensions_without_overwriting_edits(library, monkeypatch):
    from app.photos import worker

    _, initial, sessions, _ = library
    monkeypatch.setattr(worker, "SessionLocal", sessions)
    storage = SimpleNamespace(
        download_file=lambda *args: None,
        put_object=lambda **kwargs: None,
        delete_object=lambda **kwargs: None,
    )
    monkeypatch.setattr(worker, "get_s3_client", lambda: storage)

    def render(path, config):
        # An editor saves while the expensive image processing is in progress.
        with sessions() as db:
            metadata = db.get(PhotoMetadata, uuid.UUID(initial["id"]))
            record = copy.deepcopy(metadata.record)
            record["title"]["zh"] = "处理期间保存的标题"
            metadata.record = record
            db.commit()
        return [
            {
                "kind": kind,
                "width": width,
                "height": height,
                "byte_size": 4,
                "quality": 90,
                "data": b"test",
            }
            for kind, width, height in (
                ("thumbnail", 480, 320),
                ("gallery", 1440, 960),
                ("display", 1500, 1000),
            )
        ]

    monkeypatch.setattr(worker, "render_variants", render)
    assert worker.process_next_job()
    with sessions() as db:
        photo = db.get(Photo, uuid.UUID(initial["id"]))
        metadata = db.get(PhotoMetadata, photo.id)
        assert photo.processing_status == "ready"
        assert (metadata.record["width"], metadata.record["height"]) == (1500, 1000)
        assert metadata.record["title"]["zh"] == "处理期间保存的标题"
        assert len(list(db.scalars(select(PhotoAsset)))) == 3
