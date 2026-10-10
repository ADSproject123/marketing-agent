"""Web dashboard — React UI; Telegram only approves/denies."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.auth.security import create_token, verify_token
from app.auth.store import UserStore
from app.config import DB_PATH, WEB_DIST
from app.jobs.store import JobSource, JobStore
from app.runtime import get_runtime

URL_RE = re.compile(r"https?://[^\s<>\"']+")
bearer = HTTPBearer(auto_error=False)

# Keep in sync with web/src/templates.js labels
TEMPLATE_LABELS = {
    "weekend_sale": "Weekend sale",
    "product_launch": "Product launch",
    "local_cafe": "Local cafe / F&B",
    "app_feature": "App / feature highlight",
    "seasonal": "Seasonal / holiday",
    "auto_gemini": "Let Gemini invent everything",
}

app = FastAPI(title="Marketing Agent", docs_url=None, redoc_url=None)


class CreateJobRequest(BaseModel):
    brief: str | None = Field(default=None, max_length=4000)
    urls: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)
    template: str | None = Field(default=None, max_length=64)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


def _users() -> UserStore:
    return UserStore()


def _job_stage(job) -> str:
    """Map store status → live flow node id for the dashboard."""
    from app.jobs.store import JobStatus

    status = job.status
    if status in {JobStatus.QUEUED, JobStatus.COLLECTING}:
        return "system"
    if status == JobStatus.GENERATING:
        return "notebooklm" if job.title else "gemini"
    if status == JobStatus.AWAITING_APPROVAL:
        return "telegram"
    if status == JobStatus.POSTING:
        return "facebook"
    if status == JobStatus.POSTED:
        return "done"
    if status == JobStatus.DENIED:
        return "deny"
    if status == JobStatus.FAILED:
        if job.video_path:
            return "facebook"
        if job.title:
            return "notebooklm"
        return "gemini"
    if status == JobStatus.CANCELLED:
        return "system"
    return "system"


def _job_payload(job) -> dict:
    return {
        "id": job.id,
        "brief": job.brief,
        "status": job.status.value,
        "stage": _job_stage(job),
        "title": job.title,
        "caption": job.caption,
        "video_format": job.video_format,
        "source_count": len(job.sources),
        "video_path": job.video_path,
        "facebook_post_url": job.facebook_post_url,
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def _store() -> JobStore:
    try:
        return get_runtime().store
    except RuntimeError:
        return JobStore(DB_PATH)


def _require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    user = _users().get_by_id(str(payload.get("uid", "")))
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    return user.public()


@app.get("/api/health")
def health() -> dict:
    runtime_ready = True
    try:
        get_runtime()
    except RuntimeError:
        runtime_ready = False
    return {
        "ok": True,
        "service": "marketing-agent",
        "runtime_ready": runtime_ready,
        "frontend": "react",
    }


@app.post("/api/auth/register")
def register(body: RegisterRequest) -> dict:
    try:
        user = _users().create(
            email=body.email,
            name=body.name,
            password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_token(user.id, user.email, user.name)
    return {"ok": True, "token": token, "user": user.public()}


@app.post("/api/auth/login")
def login(body: LoginRequest) -> dict:
    user = _users().authenticate(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_token(user.id, user.email, user.name)
    return {"ok": True, "token": token, "user": user.public()}


@app.get("/api/auth/me")
def me(user: dict = Depends(_require_user)) -> dict:
    return {"ok": True, "user": user}


@app.get("/api/jobs")
def list_jobs(limit: int = 20, _user: dict = Depends(_require_user)) -> dict:
    limit = max(1, min(limit, 50))
    jobs = _store().list_recent_all(limit=limit)
    return {"jobs": [_job_payload(j) for j in jobs]}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, _user: dict = Depends(_require_user)) -> dict:
    job = _store().get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_payload(job)


@app.post("/api/jobs")
async def create_job(
    body: CreateJobRequest = CreateJobRequest(),
    _user: dict = Depends(_require_user),
) -> dict:
    try:
        runtime = get_runtime()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Agent runtime not ready. Start with: python api/run.py",
        ) from exc

    brief = (body.brief or "").strip()
    template = (body.template or "").strip()
    sources: list[JobSource] = []

    if template and template in TEMPLATE_LABELS:
        sources.append(
            JobSource(
                kind="text",
                value=f"Predefined template: {TEMPLATE_LABELS[template]} ({template})",
                title="Template",
            )
        )

    for url in body.urls or []:
        url = url.strip()
        if URL_RE.fullmatch(url) or URL_RE.match(url):
            sources.append(JobSource(kind="url", value=url))

    if brief:
        for url in URL_RE.findall(brief):
            if not any(s.value == url for s in sources):
                sources.append(JobSource(kind="url", value=url))

    if body.notes and body.notes.strip():
        sources.append(
            JobSource(kind="text", value=body.notes.strip(), title="Extra notes")
        )

    if not brief:
        if template == "auto_gemini" or not template:
            brief = "Auto — Gemini invents the campaign"
        elif template in TEMPLATE_LABELS:
            brief = f"Template: {TEMPLATE_LABELS[template]}"

    job = runtime.create_and_start(brief=brief, sources=sources)
    return {
        "ok": True,
        "job": _job_payload(job),
        "message": "Job started. Watch Telegram for Approve / Deny.",
    }


def _spa_index() -> FileResponse:
    index_path = WEB_DIST / "index.html"
    if not index_path.exists():
        raise HTTPException(
            status_code=503,
            detail="React dashboard not built. Run: cd web && npm install && npm run build",
        )
    return FileResponse(index_path)


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
