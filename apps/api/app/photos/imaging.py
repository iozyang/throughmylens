from __future__ import annotations

import hashlib
import io
import itertools
import json
import subprocess
import warnings
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from PIL import Image, ImageCms, UnidentifiedImageError

from app.core.config import get_settings
from app.photos.schemas import MetadataValues, ProcessingConfig


class ImageRejected(ValueError):
    pass


class ImagingUnavailable(RuntimeError):
    pass


@dataclass
class Inspection:
    width: int
    height: int
    sha256: str
    byte_size: int
    color_profile: str
    metadata: dict
    raw_exif: dict
    gps: dict


def srgb_profile(icc: bytes) -> str:
    """Validate the actual color transform, not the editable ICC display name."""
    try:
        profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        if profile.profile.xcolor_space.strip() != "RGB":
            raise ValueError("not RGB")
        samples = list(itertools.product(range(0, 256, 32), repeat=3))
        samples += [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 255)]
        grid = Image.new("RGB", (len(samples), 1))
        grid.putdata(samples)
        transformed = ImageCms.profileToProfile(
            grid, profile, ImageCms.createProfile("sRGB"), outputMode="RGB", renderingIntent=1
        )
        deviation = max(
            abs(a - b)
            for before, after in zip(samples, list(transformed.get_flattened_data()), strict=True)
            for a, b in zip(before, after, strict=True)
        )
        if deviation > 3:
            raise ValueError("not sRGB")
        return "ICC verified sRGB"
    except Exception as error:
        raise ImageRejected("ICC 配置不是可识别的 sRGB，请重新导出为 sRGB JPEG。") from error


def extract_exif(path: Path) -> dict:
    try:
        result = subprocess.run(
            [get_settings().exiftool_path, "-config", "", "-j", "-G1", "-n", "--", str(path)],
            capture_output=True,
            timeout=30,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired) as error:
        raise ImagingUnavailable("ExifTool 不可用，请检查安装或 EXIFTOOL_PATH 配置。") from error
    if result.returncode:
        raise ImageRejected("无法读取这张照片的 EXIF，请检查文件是否完整。")
    try:
        raw = json.loads(result.stdout)[0]
    except (ValueError, IndexError) as error:
        raise ImageRejected("EXIF 数据无法解析。") from error
    # Runtime paths and filesystem metadata are not part of the photograph.
    return {
        key: value
        for key, value in raw.items()
        if key != "SourceFile" and not key.startswith(("System:", "ExifTool:"))
    }


def normalize_exif(raw: dict) -> tuple[dict, dict]:
    def first(*names):
        for name in names:
            if raw.get(name) not in (None, ""):
                return raw[name]
        return None

    values = {
        "camera_make": first("IFD0:Make", "XMP-tiff:Make") or "",
        "camera_model": first("IFD0:Model", "XMP-tiff:Model") or "",
        "lens": first("ExifIFD:LensModel", "Composite:LensID", "XMP-aux:Lens") or "",
        "focal_length": first("ExifIFD:FocalLength", "XMP-exif:FocalLength"),
        "aperture": first("ExifIFD:FNumber", "XMP-exif:FNumber"),
        "iso": first("ExifIFD:ISO", "XMP-exif:ISO"),
        "captured_at": first("ExifIFD:DateTimeOriginal", "XMP-exif:DateTimeOriginal") or "",
        "location": ", ".join(
            str(v)
            for v in (
                first("XMP-iptcCore:Location", "IPTC:Sub-location"),
                first("XMP-photoshop:City", "IPTC:City"),
                first("XMP-photoshop:Country", "IPTC:Country-PrimaryLocationName"),
            )
            if v
        ),
    }
    exposure = first("ExifIFD:ExposureTime", "XMP-exif:ExposureTime")
    try:
        seconds = float(exposure)
        values["shutter_speed"] = str(Fraction(seconds).limit_denominator(1000000))
    except (ValueError, TypeError, ZeroDivisionError):
        values["shutter_speed"] = ""
    # A malformed field must not prevent correcting the rest in the library.
    clean = MetadataValues().model_dump()
    for name, value in values.items():
        try:
            clean[name] = getattr(MetadataValues(**{name: value}), name)
        except ValueError:
            pass
    gps = {key: value for key, value in raw.items() if "GPS" in key}
    return clean, gps


def inspect_jpeg(path: Path) -> Inspection:
    settings = get_settings()
    byte_size = path.stat().st_size
    if byte_size > settings.photo_max_upload_mb * 1024 * 1024:
        raise ImageRejected(f"单张照片不能超过 {settings.photo_max_upload_mb} MB。")
    with path.open("rb") as source:
        if source.read(3) != b"\xff\xd8\xff":
            raise ImageRejected("V1 只支持 JPEG 文件，请勿仅修改扩展名。")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as photo:
                if photo.format != "JPEG" or photo.mode != "RGB":
                    raise ImageRejected("请上传 RGB 模式的 sRGB JPEG，不支持 CMYK 或灰度文件。")
                width, height = photo.size
                if width * height > settings.photo_max_megapixels * 1000000:
                    raise ImageRejected(f"像素总数不能超过 {settings.photo_max_megapixels} MP。")
                icc = photo.info.get("icc_profile")
                exif = photo.getexif()
                color_space = exif.get_ifd(34665).get(40961)
                orientation = exif.get(274, 1)
                # Full decoding rejects truncated files before any durable upload.
                photo.load()
                if icc:
                    profile = srgb_profile(icc)
                    if color_space not in (None, 1, 65535):
                        raise ImageRejected("ICC 与 EXIF 色彩标记冲突，请重新导出。")
                elif color_space == 1:
                    profile = "EXIF declared sRGB (no ICC)"
                else:
                    raise ImageRejected("缺少 sRGB ICC 或 EXIF 色彩声明，请导出时嵌入 sRGB 配置。")
    except ImageRejected:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise ImageRejected("JPEG 无法完整解码，或图片尺寸超出限制。") from error
    if orientation in (5, 6, 7, 8):
        width, height = height, width
    raw = extract_exif(path)
    metadata, gps = normalize_exif(raw)
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    return Inspection(width, height, digest, byte_size, profile, metadata, raw, gps)


def render_variants(path: Path, config: ProcessingConfig) -> list[dict]:
    import pyvips

    pyvips.cache_set_max_mem(64 * 1024 * 1024)
    pyvips.cache_set_max(0)
    source = pyvips.Image.new_from_file(str(path), access="random", fail_on="warning").autorot()
    if source.get_typeof("icc-profile-data"):
        source = source.icc_transform("srgb", embedded=True, intent="relative")
    longest = max(source.width, source.height)
    display_edge = longest if config.preset == "preserve" else min(longest, config.long_edge)
    results = []
    for kind, edge in (("thumbnail", 480), ("gallery", 1440), ("display", display_edge)):
        target = min(edge, display_edge, longest)
        scaled = source.resize(target / longest) if target < longest else source.copy()
        # Only a controlled ICC survives; GPS, MakerNotes, XMP and serials are omitted.
        qualities = list(range(config.quality, config.min_quality - 1, -2))
        if qualities[-1] != config.min_quality:
            qualities.append(config.min_quality)
        for quality in qualities:
            data = scaled.jpegsave_buffer(
                Q=quality,
                subsample_mode="off",
                optimize_coding=True,
                interlace=True,
                keep="none",
                profile="srgb",
            )
            if len(data) <= config.max_output_kb * 1024:
                break
        else:
            raise ImageRejected(
                f"{kind} 在质量 {config.min_quality} 时仍超过 {config.max_output_kb} KB。"
                "请提高体积上限，或选择 Web Standard 降低长边后重新处理。"
            )
        # Inspect encoded bytes, not just the intermediate resize calculation.
        with Image.open(io.BytesIO(data)) as encoded:
            output_width, output_height = encoded.size
        results.append(
            {
                "kind": kind,
                "data": data,
                "width": output_width,
                "height": output_height,
                "byte_size": len(data),
                "quality": quality,
            }
        )
    return results
