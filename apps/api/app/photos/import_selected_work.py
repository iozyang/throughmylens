"""Import the local Selected Work catalog into the private album, resumably."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.photo import Photo, PhotoMetadata, PhotoPrivateMetadata
from app.models.user import User
from app.photos.imaging import ImageRejected, extract_exif, inspect_jpeg, normalize_exif
from app.photos.record import CatalogRecord, RecordEdit, from_legacy
from app.photos.schemas import ProcessingConfig
from app.routers.photos import ingest, serialize, update_record
from app.storage.s3 import get_s3_client

ALBUM = {"slug": "selected-work", "zh": "精选作品", "en": "Selected Work"}


def fill_missing(current, incoming):
    if isinstance(current, dict) and isinstance(incoming, dict):
        return {k: fill_missing(v, incoming.get(k, "")) for k, v in current.items()}
    return incoming if current in (None, "", []) else current


def catalog_metadata(entry):
    record = copy.deepcopy(entry)
    # Older public records have a composed display name but no structured place.
    for lang in ("zh", "en"):
        if not any(
            record["location"][k][lang] for k in ("place", "district", "city", "region", "country")
        ):
            record["location"]["place"][lang] = record["location"]["display"][lang]
    record["series"] = ALBUM.copy()
    record["time"] += ":00" if len(record["time"]) == 5 else ""
    return CatalogRecord.model_validate(record).model_dump()


def run(apply=False):
    root = Path(__file__).resolve().parents[4]
    folder = (root / "selected_work").resolve()
    catalog = json.loads(
        (root / "apps/web/components/photography/selected-work.json").read_text(encoding="utf-8")
    )
    records = {entry["file"]: entry for entry in catalog["photos"]}
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".jpg", ".jpeg"))
    if set(p.name for p in files) != set(records):
        raise ValueError("Folder and catalog differ. Update the Selected Work catalog first.")
    # Complete read-only preflight before changing any user data.
    inspected = []
    for path in files:
        if path.resolve().parent != folder:
            raise ValueError("Source file resolves outside selected_work")
        record = catalog_metadata(records[path.name])
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        import_path = path
        try:
            inspection = inspect_jpeg(path)
            raw = inspection.raw_exif
        except ImageRejected as error:
            # No color assumption or relaxation of the upload validator. Only
            # existing, validated public sRGB derivatives can bridge legacy files.
            if "缺少 sRGB" not in str(error):
                raise ValueError(f"{path.name}: {error}") from error
            public = (root / "apps/web/public").resolve()
            import_path = (public / records[path.name]["src"].lstrip("/")).resolve()
            if not import_path.is_relative_to(public / "photographs/selected-work"):
                raise ValueError("Derivative is outside Selected Work") from error
            inspection = inspect_jpeg(import_path)
            raw = extract_exif(path)
        values, gps = normalize_exif(raw)
        record = fill_missing(record, from_legacy(values, raw, {}))
        inspected.append((path, record, digest, import_path, inspection.sha256, raw, gps))
    config = ProcessingConfig(
        preset="web_standard", long_edge=2400, quality=92, min_quality=92, max_output_kb=16384
    )
    with SessionLocal() as db:
        admins = list(
            db.scalars(select(User).where(User.is_active.is_(True), User.role == UserRole.ADMIN))
        )
        if len(admins) != 1:
            raise ValueError(
                "Import requires exactly one active administrator; select an owner first."
            )
        admin = admins[0]
        existing = {p.sha256: p for p in db.scalars(select(Photo))}
        for path, _, digest, _, rendered_digest, _, _ in inspected:
            photo = existing.get(digest) or existing.get(rendered_digest)
            if photo:
                if photo.publication_status == "deleted":
                    raise ValueError(
                        f"{path.name}: already in trash; restore explicitly before import"
                    )
                series = (db.get(PhotoMetadata, photo.id).record or {}).get("series", {})
                if series.get("slug") not in (None, "", ALBUM["slug"]):
                    raise ValueError(f"{path.name}: already belongs to another project")
        reused = sum(d in existing or rd in existing for _, _, d, _, rd, _, _ in inspected)
        print(
            json.dumps(
                {
                    "files": len(files),
                    "existing": reused,
                    "new": len(files) - reused,
                    "validated_derivative_fallbacks": sum(
                        p != ip for p, _, _, ip, _, _, _ in inspected
                    ),
                    "apply": apply,
                }
            ),
            flush=True,
        )
        if not apply:
            return
        for path, incoming, digest, import_path, rendered_digest, raw, gps in inspected:
            old = existing.get(digest) or existing.get(rendered_digest)
            if old:
                result = serialize(old, db)
                if result["record"]["series"]["slug"] == ALBUM["slug"]:
                    print(f"UNCHANGED {path.name}", flush=True)
                    continue
                merged = fill_missing(result["record"], incoming)
            else:
                result = ingest(import_path, path.name, config, admin, db)
                # Curated catalog values take precedence for new records; fill
                # its unknowns from EXIF, including private coordinates.
                merged = fill_missing(incoming, result["record"])
            merged["series"] = ALBUM.copy()
            merged["order"] = incoming["order"]
            photo = db.scalar(select(Photo).where(Photo.id == UUID(result["id"])).with_for_update())
            if import_path != path and photo.sha256 != digest:
                # Archive the original byte-for-byte, but render only the validated
                # sRGB master. Record a private provenance pointer for future export.
                key = f"photos/{photo.id}/source-original.jpg"
                with path.open("rb") as source:
                    get_s3_client().put_object(
                        Bucket=get_settings().s3_private_bucket,
                        Key=key,
                        Body=source,
                        ContentType="image/jpeg",
                    )
                photo.sha256 = digest
                private = db.get(PhotoPrivateMetadata, photo.id)
                private.raw_exif, private.gps = raw, gps
                metadata = db.get(PhotoMetadata, photo.id)
                metadata.sources = {**metadata.sources, "selected_work_original_key": key}
            metadata = db.get(PhotoMetadata, photo.id)
            metadata.sources = {**metadata.sources, "selected_work_file": path.name}
            update_record(
                UUID(result["id"]),
                RecordEdit(
                    version=result["version"],
                    record=merged,
                    reviewed=result["review_status"] == "reviewed",
                ),
                db,
            )
            print(f"{'LINKED' if old else 'IMPORTED'} {path.name}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Import after validating every source")
    run(parser.parse_args().apply)
