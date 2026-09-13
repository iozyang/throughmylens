from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[2]
ENV_ROOT = API_ROOT.parent.parent if API_ROOT.parent.name == "apps" else API_ROOT


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    database_url: str
    web_origins: str = "http://localhost:3000"

    auth_secret_key: SecretStr
    auth_session_cookie_name: str = "tml_session"
    auth_csrf_cookie_name: str = "tml_csrf"
    auth_session_ttl_hours: int = 12
    auth_session_cookie_secure: bool = False

    s3_endpoint_url: str | None = None
    s3_browser_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_access_key: str
    s3_secret_key: SecretStr
    s3_private_bucket: str = "tml-private"
    s3_public_bucket: str = "tml-public"
    s3_public_base_url: str

    exiftool_path: str = "exiftool"
    photo_max_upload_mb: int = Field(default=30, ge=1, le=100)
    photo_max_megapixels: int = Field(default=60, ge=1, le=100)
    image_worker_enabled: bool = True
    translation_api_key: SecretStr = SecretStr("")
    translation_model: str = "deepseek-ai/deepseek-v4-flash-0731"
    translation_timeout_seconds: int = Field(default=40, ge=5, le=60)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.web_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_security(self) -> Settings:
        secret = self.auth_secret_key.get_secret_value()
        if self.environment == "production":
            if len(secret) < 48 or secret.startswith("local-development"):
                raise ValueError("AUTH_SECRET_KEY must be a production-grade secret")
            if not self.auth_session_cookie_secure:
                raise ValueError("AUTH_SESSION_COOKIE_SECURE must be true in production")
            if any(origin.startswith("http://") for origin in self.cors_origins):
                raise ValueError("WEB_ORIGINS must use HTTPS in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
