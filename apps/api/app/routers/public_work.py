"""Live display metadata for the explicitly curated, already-public catalog.

Album membership and draft upload status do NOT grant public access. Only the
importer's immutable provenance link to an existing static catalog file does.
Image URLs, private metadata and administrative identifiers are never returned.
"""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.photo import Photo, PhotoMetadata
from app.photos.record import CatalogRecord

router = APIRouter(prefix="/public", tags=["Public photographs"])
CATALOG = Path(__file__).resolve().parents[4] / "apps/web/components/photography/selected-work.json"


def public_catalog():
    try:
        entries = json.loads(CATALOG.read_text(encoding="utf-8"))["photos"]
        return {entry["file"]: entry["slug"] for entry in entries}
    except (OSError, ValueError, KeyError, TypeError) as error:
        # Fail closed; never replace a missing allowlist with the private library.
        raise HTTPException(503, "Public catalog unavailable") from error


@router.get("/selected-work/metadata")
def selected_work_metadata(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    catalog = public_catalog()
    rows = db.scalars(
        select(PhotoMetadata)
        .join(Photo, Photo.id == PhotoMetadata.photo_id)
        .where(
            Photo.publication_status != "deleted",
            PhotoMetadata.sources["selected_work_file"].as_string().in_(list(catalog)),
        )
    ).all()
    # Ambiguous provenance must not select an arbitrary private record.
    linked = {}
    for metadata in rows:
        name = metadata.sources["selected_work_file"]
        linked.setdefault(name, []).append(metadata)
    result = []
    for name, records in linked.items():
        if len(records) != 1 or not records[0].record:
            continue
        record = CatalogRecord.model_validate(records[0].record).model_dump()
        result.append({
            "id": catalog[name],
            "title": record["title"],
            "alt": record["alt"],
            "location": record["location"]["display"],
            "date": record["date"],
            "time": record["time"],
            "focalLength35mm": record["focalLength35mm"],
            "aperture": record["aperture"],
            "shutterSpeed": record["shutterSpeed"],
            "iso": record["iso"],
        })
    return {"photos": sorted(result, key=lambda item: item["id"])}
