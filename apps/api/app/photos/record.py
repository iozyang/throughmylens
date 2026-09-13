"""Complete, private photo catalog records. No public publication side effects."""

from __future__ import annotations

import re
from datetime import date as Date
from datetime import time as Time
from fractions import Fraction
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Empty = Literal[""]
PositiveInt = Annotated[int, Field(strict=True, ge=1)]


class RecordModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Text(RecordModel):
    zh: str = Field(default="", max_length=10000)
    en: str = Field(default="", max_length=10000)


class Location(RecordModel):
    place: Text = Field(default_factory=Text)
    district: Text = Field(default_factory=Text)
    city: Text = Field(default_factory=Text)
    region: Text = Field(default_factory=Text)
    country: Text = Field(default_factory=Text)
    countryCode: str = Field(default="", pattern=r"^(?:[A-Z]{2})?$")
    display: Text = Field(default_factory=Text)
    geocodeQuery: Text = Field(default_factory=Text)

    @model_validator(mode="after")
    def derive_display(self):
        for lang in ("zh", "en"):
            if lang == "en" and any(
                getattr(self, k).zh and not getattr(self, k).en
                for k in ("place", "district", "city", "region", "country")
            ):
                self.display.en = ""
                continue
            parts = list(
                dict.fromkeys(
                    getattr(getattr(self, k), lang)
                    for k in ("place", "district", "city", "region", "country")
                )
            )
            setattr(
                self.display, lang, ("，" if lang == "zh" else ", ").join(p for p in parts if p)
            )
        return self


class Geo(RecordModel):
    latitude: Annotated[float, Field(ge=-90, le=90)] | Empty = ""
    longitude: Annotated[float, Field(ge=-180, le=180)] | Empty = ""
    coordinateSystem: Literal["WGS84"] = "WGS84"
    source: Literal["exif", "geocoded", "manual", ""] = ""
    precision: Literal["exact", "approximate", "city", ""] = ""

    @model_validator(mode="after")
    def pair(self):
        if (self.latitude == "") != (self.longitude == ""):
            raise ValueError("经纬度须同时填写，或同时留空")
        if self.latitude != "" and (not self.source or not self.precision):
            raise ValueError("填写坐标后请选择坐标来源和精度")
        if self.latitude == "":
            self.source = self.precision = ""
        return self


class Equipment(RecordModel):
    brand: str = Field(default="", max_length=200)
    model: str = Field(default="", max_length=300)


class Series(RecordModel):
    slug: str = Field(default="", max_length=100, pattern=r"^[a-zA-Z0-9_-]*$")
    zh: str = Field(default="", max_length=200)
    en: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def identity(self):
        if (self.zh or self.en) and not self.slug:
            raise ValueError("填写项目名称时请同时填写稳定的项目标识")
        return self


class CatalogRecord(RecordModel):
    slug: str = ""
    file: str = ""
    src: str = ""
    width: PositiveInt | Empty = ""
    height: PositiveInt | Empty = ""
    order: Annotated[int, Field(strict=True, ge=0)] | Empty = ""
    title: Text = Field(default_factory=Text)
    alt: Text = Field(default_factory=Text)
    description: Text = Field(default_factory=Text)
    location: Location = Field(default_factory=Location)
    geo: Geo = Field(default_factory=Geo)
    date: str = ""
    time: str = ""
    timezone: str = ""
    camera: Equipment = Field(default_factory=Equipment)
    lens: Equipment = Field(default_factory=Equipment)
    focalLength: str = ""
    focalLength35mm: str = ""
    aperture: str = ""
    shutterSpeed: str = ""
    iso: Annotated[int, Field(strict=True, ge=1, le=10000000)] | Empty = ""
    series: Series = Field(default_factory=Series)
    tags: list[Annotated[str, Field(min_length=1, max_length=100)]] | Empty = ""

    @model_validator(mode="after")
    def text_limits(self):
        for key, limit in (("title", 300), ("alt", 1000)):
            if any(len(getattr(getattr(self, key), lang)) > limit for lang in ("zh", "en")):
                raise ValueError(f"{key} 不能超过 {limit} 字符")
        for key in ("place", "district", "city", "region", "country"):
            if any(len(getattr(getattr(self.location, key), lang)) > 300 for lang in ("zh", "en")):
                raise ValueError(f"location.{key} 不能超过 300 字符")
        if len(self.tags) > 100:
            raise ValueError("每张照片最多 100 个标签")
        return self

    @field_validator("date", "time", "timezone")
    @classmethod
    def valid_temporal(cls, value, info):
        if not value:
            return value
        try:
            if info.field_name == "date":
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    raise ValueError
                Date.fromisoformat(value)
            elif info.field_name == "time":
                if not re.fullmatch(r"\d{2}:\d{2}:\d{2}", value):
                    raise ValueError
                Time.fromisoformat(value)
            else:
                ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError) as error:
            raise ValueError(f"{info.field_name} 格式无效") from error
        return value

    @field_validator("focalLength", "focalLength35mm", "aperture", "shutterSpeed")
    @classmethod
    def exposure(cls, value, info):
        if not value:
            return value
        name = info.field_name
        pattern = (
            r"(?:\d+(?:\.\d+)?|\d+/\d+)s"
            if name == "shutterSpeed"
            else (r"f/\d+(?:\.\d+)?" if name == "aperture" else r"\d+(?:\.\d+)?mm")
        )
        if not re.fullmatch(pattern, value):
            raise ValueError("参数格式如 50mm、f/2.8、1/250s")
        number = value.removeprefix("f/").removesuffix("mm").removesuffix("s")
        try:
            maximum = 86400 if name == "shutterSpeed" else 256 if name == "aperture" else 10000
            if not 0 < Fraction(number) <= maximum:
                raise ValueError
        except (ValueError, ZeroDivisionError) as error:
            raise ValueError("参数须为合理范围内的正数") from error
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, tags):
        return list(dict.fromkeys(tags)) if tags else ""


class RecordEdit(RecordModel):
    version: int
    record: dict
    reviewed: bool = False


class VersionEdit(RecordModel):
    version: int


def require_complete(value: dict, template=None, path="record"):
    """Reject incomplete replacements instead of silently wiping omitted fields."""
    template = CatalogRecord().model_dump() if template is None else template
    if not isinstance(value, dict):
        raise ValueError(f"{path} 必须是对象")
    for key, default in template.items():
        if key not in value:
            raise ValueError(f"缺少 {path}.{key}")
        if isinstance(default, dict):
            require_complete(value[key], default, f"{path}.{key}")


def timezone_for(location: dict) -> str:
    # Only unambiguous country/region mappings; do not guess multi-zone countries.
    code = location["countryCode"]
    if code == "CN":
        region = location["region"]["zh"]
        return {"香港": "Asia/Hong_Kong", "澳门": "Asia/Macau"}.get(region, "Asia/Shanghai")
    return {
        "HK": "Asia/Hong_Kong",
        "MO": "Asia/Macau",
        "TW": "Asia/Taipei",
        "JP": "Asia/Tokyo",
        "KR": "Asia/Seoul",
        "SG": "Asia/Singapore",
        "IS": "Atlantic/Reykjavik",
        "NZ": "",
    }.get(code, "")


def legacy_values(record: dict) -> dict:
    return {
        "camera_make": record["camera"]["brand"],
        "camera_model": record["camera"]["model"],
        "lens": record["lens"]["model"],
        "focal_length": float(record["focalLength"][:-2]) if record["focalLength"] else None,
        "aperture": float(record["aperture"][2:]) if record["aperture"] else None,
        "shutter_speed": record["shutterSpeed"].removesuffix("s"),
        "iso": record["iso"] or None,
        "captured_at": " ".join(v for v in (record["date"], record["time"]) if v),
        "location": record["location"]["display"]["zh"] or record["location"]["display"]["en"],
    }


def from_legacy(values: dict, raw: dict, translations: dict, *, exif_location=False) -> dict:
    record = CatalogRecord().model_dump()
    record["camera"] = {
        "brand": values.get("camera_make") or "",
        "model": values.get("camera_model") or "",
    }
    record["lens"] = {
        "brand": str(raw.get("ExifIFD:LensMake") or ""),
        "model": values.get("lens") or "",
    }
    for old, new, prefix, suffix in (
        ("focal_length", "focalLength", "", "mm"),
        ("aperture", "aperture", "f/", ""),
        ("shutter_speed", "shutterSpeed", "", "s"),
    ):
        if values.get(old):
            n = values[old]
            record[new] = (
                f"{prefix}{n:g}{suffix}" if isinstance(n, (float, int)) else f"{prefix}{n}{suffix}"
            )
    record["iso"] = values.get("iso") or ""
    equivalent = raw.get("ExifIFD:FocalLengthIn35mmFormat")
    if isinstance(equivalent, (int, float)) and 0 < equivalent <= 10000:
        record["focalLength35mm"] = f"{equivalent:g}mm"
    captured = values.get("captured_at") or ""
    match = re.match(r"(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?", captured)
    if match:
        for key, val in (("date", "-".join(match.group(1, 2, 3))), ("time", match.group(4) or "")):
            try:
                CatalogRecord(**{key: val})
                record[key] = val
            except ValueError:
                pass
    # Preserve legacy user-entered location verbatim as place, never discard it.
    record["location"]["place"]["zh"] = values.get("location") or ""
    if exif_location:

        def first(*keys):
            return next((str(raw[k]) for k in keys if raw.get(k) not in (None, "")), "")

        for target, keys in (
            ("place", ("XMP-iptcCore:Location", "IPTC:Sub-location")),
            ("city", ("XMP-photoshop:City", "IPTC:City")),
            ("region", ("XMP-photoshop:State", "IPTC:Province-State")),
            ("country", ("XMP-photoshop:Country", "IPTC:Country-PrimaryLocationName")),
        ):
            record["location"][target]["zh"] = first(*keys)[:300]
        code = first("XMP-iptcCore:CountryCode", "IPTC:Country-PrimaryLocationCode").upper()
        if len(code) == 2 and code.isascii() and code.isalpha():
            record["location"]["countryCode"] = code
        elif code == "CHN" or record["location"]["country"]["zh"] in ("中国", "China"):
            record["location"]["countryCode"] = "CN"
    for lang in ("zh", "en"):
        t = translations.get(lang, {})
        for target, source in (("title", "title"), ("description", "caption"), ("alt", "alt_text")):
            record[target][lang] = t.get(source) or ""
    if exif_location:
        for target, keys, limit in (
            ("title", ("XMP-dc:Title", "IPTC:ObjectName"), 300),
            ("description", ("XMP-dc:Description", "IPTC:Caption-Abstract"), 10000),
        ):
            record[target]["zh"] = first(*keys)[:limit]
    latitude, longitude = raw.get("Composite:GPSLatitude"), raw.get("Composite:GPSLongitude")
    if latitude is not None and longitude is not None:
        try:
            record["geo"] = Geo(
                latitude=latitude, longitude=longitude, source="exif", precision="exact"
            ).model_dump()
        except ValueError:
            pass
    return CatalogRecord.model_validate(record).model_dump()


def system_fields(record: dict, photo, display=None) -> dict:
    record = CatalogRecord.model_validate(record).model_dump()
    record.update(
        slug=photo.id.hex,
        file=photo.filename,
        src=f"/api/v1/photos/{photo.id}/image",
        width=display.width if display else "",
        height=display.height if display else "",
    )
    if record["order"] == "":
        record["order"] = int(photo.created_at.timestamp() * 1000)
    inferred = timezone_for(record["location"])
    if inferred:
        record["timezone"] = inferred
    return record
