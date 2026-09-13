from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app


def test_development_origin_default(monkeypatch):
    monkeypatch.delenv("WEB_ORIGINS", raising=False)
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:3000"]


def test_local_web_cors_preflight():
    # No lifespan/context manager: this read-only check does not start the worker.
    response = TestClient(app).options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"
