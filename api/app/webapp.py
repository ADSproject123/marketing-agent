"""Web dashboard — React UI; Telegram only approves/denies."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.auth.security import create_token, verify_token
from app.auth.store import UserStore
from app.config import DB_PATH, WEB_DIST
from app.integrations import facebook_oauth
from app.integrations.store import IntegrationStore
from app.jobs.store import JobSource, JobStore
from app.notebooklm.client import check_auth
from app.runtime import get_runtime

URL_RE = re.compile(r"https?://[^\s<>\"']+")
bearer = HTTPBearer(auto_error=False)


def _cors_origins() -> list[str]:
    origins = {
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8787",
        "http://localhost:8787",
    }
    front = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if front:
        origins.add(front)
    extra = (os.getenv("CORS_ORIGINS") or "").strip()
    for part in extra.split(","):
        origin = part.strip().rstrip("/")
        if origin:
            origins.add(origin)
    return sorted(origins)

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class IntegrationsUpdateRequest(BaseModel):
    telegram_bot_token: str | None = Field(default=None, max_length=200)
    telegram_user_id: int | None = None
    gemini_api_keys: str | None = Field(default=None, max_length=4000)
    gemini_model: str | None = Field(default=None, max_length=120)
    skip_notebooklm: bool | None = None
    clear_telegram_bot_token: bool = False
    clear_gemini_api_keys: bool = False


class FacebookSelectPageRequest(BaseModel):
    page_id: str = Field(min_length=1, max_length=64)


def _users() -> UserStore:
    return UserStore()


def _integrations() -> IntegrationStore:
    return IntegrationStore()


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


@app.get("/api/integrations")
def get_integrations(user: dict = Depends(_require_user)) -> dict:
    integ = _integrations().get(user["id"])
    status = (
        integ.public_status()
        if integ
        else {
            "telegram_bot_token_set": False,
            "telegram_user_id": None,
            "gemini_api_keys_set": False,
            "gemini_model": "",
            "facebook_app_id": "",
            "facebook_page_id": "",
            "facebook_page_name": "",
            "facebook_page_access_token_set": False,
            "facebook_connected": False,
            "skip_notebooklm": False,
            "updated_at": None,
            "ready": {
                "telegram": False,
                "gemini": False,
                "facebook": False,
                "notebooklm": "server",
            },
        }
    )
    return {
        "ok": True,
        "integrations": status,
        "facebook_oauth": {
            "configured": facebook_oauth.facebook_oauth_configured(),
            "pending_pages": facebook_oauth.get_pending_pages(user["id"]),
        },
        "notebooklm": {
            "server_authenticated": check_auth(),
            "note": (
                "NotebookLM uses Google browser login on the server host. "
                "Ask the operator to run: notebooklm login --browser-cookies chrome"
            ),
        },
    }


@app.put("/api/integrations")
async def update_integrations(
    body: IntegrationsUpdateRequest,
    user: dict = Depends(_require_user),
) -> dict:
    try:
        integ = _integrations().upsert(
            user["id"],
            telegram_bot_token=body.telegram_bot_token,
            telegram_user_id=body.telegram_user_id,
            gemini_api_keys=body.gemini_api_keys,
            gemini_model=body.gemini_model,
            skip_notebooklm=body.skip_notebooklm,
            clear_telegram_bot_token=body.clear_telegram_bot_token,
            clear_gemini_api_keys=body.clear_gemini_api_keys,
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Start polling the user's Telegram bot if they provided one.
    try:
        runtime = get_runtime()
        if runtime.bot_hub and integ.telegram_bot_token:
            await runtime.bot_hub.ensure_token(integ.telegram_bot_token)
    except RuntimeError:
        pass
    except Exception:
        # Settings still saved; bot polling can retry on next job/start.
        pass

    return {
        "ok": True,
        "integrations": integ.public_status(),
        "message": "Integrations saved.",
    }


@app.get("/api/integrations/facebook/connect")
def facebook_connect(user: dict = Depends(_require_user)) -> dict:
    if not facebook_oauth.facebook_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Facebook Login is not configured on the server. "
                "Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env, and add the OAuth "
                f"redirect URI: {facebook_oauth.oauth_redirect_uri()}"
            ),
        )
    try:
        url = facebook_oauth.build_oauth_url(user["id"])
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "ok": True,
        "url": url,
        "redirect_uri": facebook_oauth.oauth_redirect_uri(),
    }


@app.get("/api/integrations/facebook/callback")
async def facebook_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    from urllib.parse import quote

    front = facebook_oauth.frontend_base()

    def fail(msg: str) -> RedirectResponse:
        return RedirectResponse(
            f"{front}/dashboard/settings?facebook=error&message={quote(msg[:180])}"
        )

    if error:
        return fail(error_description or error)
    if not code or not state:
        return fail("missing_code")
    account_id = facebook_oauth.verify_state(state)
    if not account_id:
        return fail("invalid_state")
    try:
        user_token = await facebook_oauth.exchange_code_for_user_token(code)
        pages = await facebook_oauth.fetch_managed_pages(user_token)
    except Exception as exc:
        return fail(str(exc))
    if not pages:
        return fail("No Facebook Pages found for this account.")
    if len(pages) == 1:
        facebook_oauth.save_page_connection(account_id, pages[0])
        return RedirectResponse(f"{front}/dashboard/settings?facebook=connected")
    facebook_oauth.stash_pending_pages(account_id, pages)
    return RedirectResponse(f"{front}/dashboard/settings?facebook=pick")


@app.get("/api/integrations/facebook/pages")
def facebook_pending_pages(user: dict = Depends(_require_user)) -> dict:
    return {
        "ok": True,
        "pages": facebook_oauth.get_pending_pages(user["id"]),
        "oauth_configured": facebook_oauth.facebook_oauth_configured(),
    }


@app.post("/api/integrations/facebook/select")
def facebook_select_page(
    body: FacebookSelectPageRequest,
    user: dict = Depends(_require_user),
) -> dict:
    try:
        page = facebook_oauth.select_pending_page(user["id"], body.page_id)
        facebook_oauth.save_page_connection(user["id"], page)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    integ = _integrations().get(user["id"])
    return {
        "ok": True,
        "integrations": integ.public_status() if integ else {},
        "message": f"Connected to {page['name']}.",
    }


@app.delete("/api/integrations/facebook")
def facebook_disconnect(user: dict = Depends(_require_user)) -> dict:
    facebook_oauth.clear_page_connection(user["id"])
    integ = _integrations().get(user["id"])
    return {
        "ok": True,
        "integrations": integ.public_status()
        if integ
        else {
            "facebook_connected": False,
            "facebook_page_name": "",
            "facebook_page_id": "",
            "ready": {"facebook": False},
        },
        "message": "Facebook disconnected.",
    }


@app.get("/api/jobs")
def list_jobs(limit: int = 20, user: dict = Depends(_require_user)) -> dict:
    limit = max(1, min(limit, 50))
    jobs = _store().list_recent_for_account(user["id"], limit=limit)
    return {"jobs": [_job_payload(j) for j in jobs]}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(_require_user)) -> dict:
    job = _store().get(job_id)
    if not job or job.owner_account_id != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_payload(job)


@app.post("/api/jobs")
async def create_job(
    body: CreateJobRequest = CreateJobRequest(),
    user: dict = Depends(_require_user),
) -> dict:
    try:
        runtime = get_runtime()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Agent runtime not ready. Start with: python api/run.py",
        ) from exc

    integ = _integrations().get(user["id"])
    if not integ or not integ.telegram_user_id:
        raise HTTPException(
            status_code=400,
            detail="Add your Telegram user ID in Settings before starting a job.",
        )
    if not integ.gemini_api_keys:
        raise HTTPException(
            status_code=400,
            detail="Add at least one Gemini API key in Settings before starting a job.",
        )

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

    try:
        job = runtime.create_and_start(
            brief=brief,
            sources=sources,
            owner_account_id=user["id"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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
