from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

REQUIRED_METADATA = (
    "camera_make",
    "camera_model",
    "lens",
    "focal_length",
    "aperture",
    "shutter_speed",
    "iso",
    "location",
)


class ProcessingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preset: Literal["preserve", "web_standard"] = "preserve"
    long_edge: int = Field(default=3000, ge=1280, le=6000)
    quality: int = Field(default=90, ge=60, le=100)
    min_quality: int = Field(default=80, ge=60, le=100)
    max_output_kb: int = Field(default=4096, ge=128, le=16384)

    @model_validator(mode="after")
    def validate_quality_range(self):
        if self.min_quality > self.quality:
            raise ValueError("最低质量不能高于目标质量")
        return self


class MetadataValues(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    camera_make: str = Field(default="", max_length=200)
    camera_model: str = Field(default="", max_length=200)
    lens: str = Field(default="", max_length=300)
    focal_length: float | None = Field(default=None, gt=0, le=10000)
    aperture: float | None = Field(default=None, gt=0, le=256)
    shutter_speed: str = Field(default="", max_length=40)
    iso: int | None = Field(default=None, ge=1, le=10000000)
    captured_at: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=300)

    @field_validator("shutter_speed")
    @classmethod
    def shutter_is_positive(cls, value):
        if value:
            from fractions import Fraction

            try:
                if not 0 < Fraction(value) <= 86400:
                    raise ValueError
            except (ValueError, ZeroDivisionError) as error:
                raise ValueError("快门请填秒数或分数，例如 1/250、0.5、30") from error
        return value


class Translation(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(default="", max_length=300)
    caption: str = Field(default="", max_length=10000)
    alt_text: str = Field(default="", max_length=1000)


class PhotoEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int
    metadata: MetadataValues
    translations: dict[Literal["zh", "en"], Translation]
    reviewed: bool = False


def missing_fields(values: dict) -> list[str]:
    return [field for field in REQUIRED_METADATA if values.get(field) in (None, "")]
