"""Web dashboard — React UI; Telegram only approves/denies."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import WEB_DIST
from app.constants import TEMPLATE_LABELS, URL_RE
from app.dependencies import (
    _integrations,
    _job_payload,
    _promotions,
    _require_user,
    _store,
    _users,
    bearer,
    integrations,
    job_payload,
    promotions,
    require_user,
    store,
    users,
)
from app.integrations.resolve import resolve_settings_for_account
from app.runtime import get_runtime
from app.schemas import (
    CreateJobRequest,
    CreatePromotionRequest,
    DraftRetryRequest,
    FacebookSelectPageRequest,
    IngestUrlRequest,
    IntegrationsUpdateRequest,
    LoginRequest,
    RedraftRequest,
    RegisterRequest,
    StoryboardEditRequest,
    StoryboardRevisionRequest,
)
from app.storyboards import draft_storyboard, revise_storyboard, validate_storyboard

# Re-export for routers/tests that historically imported from webapp.
__all__ = [
    "TEMPLATE_LABELS",
    "URL_RE",
    "CreateJobRequest",
    "CreatePromotionRequest",
    "DraftRetryRequest",
    "FacebookSelectPageRequest",
    "IngestUrlRequest",
    "IntegrationsUpdateRequest",
    "LoginRequest",
    "RedraftRequest",
    "RegisterRequest",
    "StoryboardEditRequest",
    "StoryboardRevisionRequest",
    "_integrations",
    "_job_payload",
    "_promotions",
    "_require_user",
    "_store",
    "_users",
    "bearer",
    "draft_storyboard",
    "get_runtime",
    "integrations",
    "job_payload",
    "promotions",
    "require_user",
    "resolve_settings_for_account",
    "revise_storyboard",
    "store",
    "users",
    "validate_storyboard",
    "app",
]


def _cors_origins() -> list[str]:
    origins: set[str] = set()
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development").strip().lower()
    if env != "production":
        origins.update({
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8787",
            "http://localhost:8787",
        })
    front = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if front:
        origins.add(front)
    extra = (os.getenv("CORS_ORIGINS") or "").strip()
    for part in extra.split(","):
        origin = part.strip().rstrip("/")
        if origin:
            origins.add(origin)
    return sorted(origins)


app = FastAPI(title="Rachana AI", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _spa_index() -> FileResponse:
    index_path = WEB_DIST / "index.html"
    if not index_path.exists():
        raise HTTPException(
            status_code=503,
            detail="React dashboard not built. Run: cd web && npm install && npm run build",
        )
    return FileResponse(index_path)


# Import jobs before campaign: campaign reuses jobs._create_job_impl.
from app.routers import auth, campaign, health, jobs
from app.routers import integrations as integrations_routes
from app.routers import promotions as promotions_routes

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(promotions_routes.router)
app.include_router(campaign.router)
app.include_router(integrations_routes.router)
app.include_router(jobs.router)


@app.get("/")
def index() -> FileResponse:
    return _spa_index()


_assets = WEB_DIST / "assets"
if _assets.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str, request: Request) -> FileResponse:
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="Not found")
    candidate = WEB_DIST / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    return _spa_index()


def main() -> None:
    print(
        "Use `python run.py` from the api/ folder (or `python api/run.py` from the project root)."
    )
    raise SystemExit(1)


if __name__ == "__main__":
    main()
