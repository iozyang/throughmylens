from __future__ import annotations

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.routers import auth, health, photos, public_work

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(application: FastAPI):
    stop = threading.Event()
    worker = None
    if settings.image_worker_enabled:
        from app.photos.worker import run_worker

        worker = threading.Thread(target=run_worker, args=(stop,), daemon=True, name="image-worker")
        worker.start()
    yield
    stop.set()
    if worker:
        worker.join(timeout=2)


app = FastAPI(
    title="throughmylens API",
    version="0.1.0",
    description="Administrative API for throughmylens.icu",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(photos.router, prefix="/api/v1")
app.include_router(public_work.router, prefix="/api/v1")


@app.get("/health", include_in_schema=False)
def root_health() -> dict[str, str]:
    return {"status": "ok"}
