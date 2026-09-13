import io
import shutil

import pytest
from PIL import Image, ImageCms

from app.photos.imaging import (
    ImageRejected,
    inspect_jpeg,
    normalize_exif,
    render_variants,
    srgb_profile,
)
from app.photos.schemas import ProcessingConfig


def make_jpeg(path, size=(300, 200), orientation=1, icc=True):
    image = Image.new("RGB", size, (128, 60, 210))
    exif = Image.Exif()
    exif[274] = orientation
    exif[271] = "Test Camera"
    exif[272] = "Test Model"
    exif[34665] = {
        40961: 1,
        33434: 0.004,
        33437: 2.8,
        34855: 100,
        37386: 50,
        42036: "Test Lens",
        42033: "PRIVATE-SERIAL",
    }
    exif[34853] = {1: "N", 2: (31, 12, 0), 3: "E", 4: (121, 30, 0)}
    options = (
        {"icc_profile": ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()}
        if icc
        else {}
    )
    image.save(path, "JPEG", exif=exif, quality=95, **options)


@pytest.mark.skipif(not shutil.which("exiftool"), reason="ExifTool is required")
def test_jpeg_inspection_and_private_exif(tmp_path):
    path = tmp_path / "photo.jpg"
    make_jpeg(path, orientation=6)
    inspection = inspect_jpeg(path)
    assert (inspection.width, inspection.height) == (200, 300)
    assert inspection.metadata["camera_make"] == "Test Camera"
    assert inspection.metadata["shutter_speed"] == "1/250"
    assert inspection.gps
    assert "PRIVATE-SERIAL" in str(inspection.raw_exif)
    assert "PRIVATE-SERIAL" not in str(inspection.metadata)


@pytest.mark.parametrize("preset", ["preserve", "web_standard"])
def test_outputs_do_not_upscale_or_keep_private_exif(tmp_path, preset):
    path = tmp_path / "photo.jpg"
    make_jpeg(path, orientation=6)
    variants = render_variants(path, ProcessingConfig(preset=preset))
    assert len(variants) == 5
    for asset in variants:
        if asset["kind"] == "micro":
            assert asset["height"] == 160
            assert abs(asset["width"] / asset["height"] - 2 / 3) < .01
        else:
            assert (asset["width"], asset["height"]) == (200, 300)
        with Image.open(io.BytesIO(asset["data"])) as output:
            output.load()
            assert not output.getexif()
            assert b"PRIVATE-SERIAL" not in asset["data"]
            assert output.info.get("icc_profile")
            assert srgb_profile(output.info["icc_profile"]) == "ICC verified sRGB"


def test_web_standard_resizes_and_preserve_retains_dimensions(tmp_path):
    path = tmp_path / "photo.jpg"
    make_jpeg(path, size=(3000, 2000))
    preserve = render_variants(path, ProcessingConfig())[-1]
    standard = render_variants(path, ProcessingConfig(preset="web_standard", long_edge=1500))[-1]
    assert (preserve["width"], preserve["height"]) == (3000, 2000)
    assert (standard["width"], standard["height"]) == (1500, 1000)


def test_noise_cannot_silently_exceed_size_or_quality_limit(tmp_path):
    path = tmp_path / "noise.jpg"
    image = Image.effect_noise((1500, 1000), 100).convert("RGB")
    image.save(path, "JPEG", quality=100)
    with pytest.raises(ImageRejected, match="仍超过"):
        render_variants(path, ProcessingConfig(quality=95, min_quality=95, max_output_kb=128))


@pytest.mark.parametrize("kind", ["fake", "truncated", "untagged", "cmyk", "bad_icc"])
def test_rejects_invalid_inputs(tmp_path, kind):
    path = tmp_path / "invalid.jpg"
    if kind == "fake":
        path.write_bytes(b"not an image")
    elif kind == "truncated":
        make_jpeg(path)
        path.write_bytes(path.read_bytes()[:1000])
    elif kind == "untagged":
        Image.new("RGB", (20, 20)).save(path, "JPEG")
    elif kind == "cmyk":
        Image.new("CMYK", (20, 20)).save(path, "JPEG")
    else:
        Image.new("RGB", (20, 20)).save(path, "JPEG", icc_profile=b"fake sRGB profile")
    with pytest.raises(ImageRejected):
        inspect_jpeg(path)


def test_shutter_fraction_is_not_rounded_to_wrong_reciprocal():
    metadata, _ = normalize_exif({"ExifIFD:ExposureTime": 0.6})
    assert metadata["shutter_speed"] == "3/5"


def test_srgb_display_name_does_not_override_wrong_primaries():
    import struct

    icc = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes())
    count = struct.unpack_from(">I", icc, 128)[0]
    for i in range(count):
        signature, offset, _ = struct.unpack_from(">4sII", icc, 132 + 12 * i)
        if signature == b"rXYZ":
            # Change a red primary, keeping the profile's sRGB description untouched.
            struct.pack_into(">i", icc, offset + 8, round(0.7 * 65536))
            break
    else:
        raise AssertionError("Test profile has no red primary")
    with pytest.raises(ImageRejected):
        srgb_profile(bytes(icc))


def test_pixel_limit_is_enforced_before_exif(tmp_path, monkeypatch):
    from app.photos.imaging import get_settings

    monkeypatch.setattr(get_settings(), "photo_max_megapixels", 1)
    path = tmp_path / "large.jpg"
    make_jpeg(path, size=(2000, 1500))
    with pytest.raises(ImageRejected, match="MP"):
        inspect_jpeg(path)


@pytest.mark.skipif(not shutil.which("exiftool"), reason="ExifTool is required")
def test_srgb_exif_declaration_without_icc_is_explicit(tmp_path):
    path = tmp_path / "declared.jpg"
    make_jpeg(path, icc=False)
    assert inspect_jpeg(path).color_profile == "EXIF declared sRGB (no ICC)"
