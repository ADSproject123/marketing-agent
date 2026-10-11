"""Web dashboard — React UI; Telegram only approves/denies."""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import shutil
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from starlette.datastructures import UploadFile

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.auth.security import create_token, verify_token
from app.auth.store import UserStore
from app.config import DB_PATH, WEB_DIST
from app.integrations import facebook_oauth
from app.integrations.resolve import resolve_settings_for_account
from app.integrations.store import IntegrationStore
from app.jobs.store import JobSource, JobStatus, JobStore
from app.notebooklm.client import check_auth
from app.promotions.store import PromotionStore
from app.runtime import get_runtime
from app.campaign_ingest import ingest_campaign_url
from app.storyboards import Storyboard, draft_storyboard, revise_storyboard, validate_storyboard
from app.uploads import save_job_assets

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

app = FastAPI(title="Rachana AI", docs_url=None, redoc_url=None)
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
    language: Literal["en", "km"] = "en"


class StoryboardEditRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    storyboard: Storyboard
    expected_updated_at: str = Field(min_length=1, max_length=100)


class StoryboardRevisionRequest(StoryboardEditRequest):
    action: Literal["stronger_hook", "shorter", "change_ending"]


class RedraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["stronger_hook", "shorter", "change_ending"] | None = None


class DraftRetryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_updated_at: str = Field(min_length=1, max_length=100)


class CreatePromotionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["shop", "product", "service", "other"]
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1500)
    benefit: str = Field(default="", max_length=1000)
    location: str = Field(default="", max_length=300)
    website: str = Field(default="", max_length=500)

    @field_validator("name", "description", "benefit", "location", "website", mode="before")
    @classmethod
    def trim_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str) -> str:
        if not value:
            return value
        try:
            parsed = urlsplit(value)
            valid = parsed.scheme in {"http", "https"} and bool(parsed.hostname)
            _ = parsed.port  # Reject malformed ports rather than saving an unusable link.
        except ValueError:
            valid = False
        if not valid or any(char.isspace() for char in value):
            raise ValueError("Use a full website URL beginning with https:// or http://.")
        return value


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


class IngestUrlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=4, max_length=1000)


def _users() -> UserStore:
    return UserStore()


def _integrations() -> IntegrationStore:
    return IntegrationStore()


def _promotions() -> PromotionStore:
    return PromotionStore(DB_PATH)


def _job_stage(job) -> str:
    """Map store status → live flow node id for the dashboard."""
    from app.jobs.store import JobStatus

    status = job.status
    if status == JobStatus.SCRIPT_REVIEW:
        return "gemini"
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
        "language": job.language,
        "status": job.status.value,
        "stage": _job_stage(job),
        "title": job.title,
        "caption": job.caption,
        "video_format": job.video_format,
        "source_count": len(job.sources),
        "video_path": job.video_path,
        "video_url": f"/api/jobs/{job.id}/video" if job.video_path else None,
        "storyboard": job.storyboard,
        "quality_report": _public_quality_report(job.quality_report),
        "assets": [
            {"id": str(index), "name": source.title or Path(source.value).name,
             "title": source.title or Path(source.value).name,
             "url": f"/api/jobs/{job.id}/assets/{index}"}
            for index, source in enumerate(source for source in job.sources if source.kind == "file")
        ],
        "facebook_post_url": job.facebook_post_url,
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def _public_quality_report(value):
    if isinstance(value, dict):
        return {key: _public_quality_report(item) for key, item in value.items()
                if not key.endswith("_path")}
    if isinstance(value, list):
        return [_public_quality_report(item) for item in value]
    return value


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


@app.get("/api/promotions")
def get_promotions(user: dict = Depends(_require_user)) -> dict:
    return {
        "ok": True,
        "promotions": [promotion.public() for promotion in _promotions().list_for_account(user["id"])],
    }


@app.post("/api/campaign/ingest")
async def campaign_ingest(body: IngestUrlRequest, user: dict = Depends(_require_user)) -> dict:
    try:
        runtime = get_runtime()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Agent runtime not ready. Start with: python api/run.py",
        ) from exc
    resolved = resolve_settings_for_account(user["id"], base=runtime.settings)
    if not resolved.gemini_api_keys:
        raise HTTPException(
            status_code=400,
            detail="Connect a Gemini API key in Settings before importing from a link.",
        )
    try:
        return await ingest_campaign_url(resolved, body.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/promotions", status_code=201)
def create_promotion(body: CreatePromotionRequest, user: dict = Depends(_require_user)) -> dict:
    promotion = _promotions().create(account_id=user["id"], **body.model_dump())
    return {"ok": True, "promotion": promotion.public()}


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
def list_jobs(
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(_require_user),
) -> dict:
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    store = _store()
    jobs = store.list_recent_for_account(user["id"], limit=limit, offset=offset)
    total = store.count_for_account(user["id"])
    return {
        "jobs": [_job_payload(j) for j in jobs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _owned_job(job_id: str, user: dict):
    job = _store().get(job_id)
    if not job or job.owner_account_id != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    return _job_payload(job)


@app.post("/api/jobs/{job_id}/approve")
async def approve_job(job_id: str, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    if job.status != JobStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} is not awaiting approval (status: {job.status.value}).",
        )
    try:
        runtime = get_runtime()
        await runtime.pipeline.approve(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Approval failed: {exc}") from exc

    updated = _store().get(job_id)
    return {
        "ok": True,
        "job": _job_payload(updated),
        "message": "Campaign approved and published.",
    }


@app.post("/api/jobs/{job_id}/deny")
async def deny_job(job_id: str, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    allowed_deny = {JobStatus.AWAITING_APPROVAL, JobStatus.COLLECTING, JobStatus.QUEUED}
    if job.status not in allowed_deny:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} cannot be denied (status: {job.status.value}).",
        )
    try:
        runtime = get_runtime()
        await runtime.pipeline.deny(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Denial failed: {exc}") from exc

    updated = _store().get(job_id)
    return {
        "ok": True,
        "job": _job_payload(updated),
        "message": "Campaign denied. Nothing was posted.",
    }


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    terminal_statuses = {
        JobStatus.POSTED,
        JobStatus.DENIED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
    }
    if job.status in terminal_statuses:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel a job in {job.status.value} status.",
        )
    try:
        runtime = get_runtime()
        runtime.cancel_job(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {exc}") from exc

    updated = _store().get(job_id)
    return {
        "ok": True,
        "job": _job_payload(updated),
        "message": "Campaign cancelled.",
    }


@app.get("/api/jobs/{job_id}/events")
async def job_events(
    job_id: str,
    request: Request,
    user: dict = Depends(_require_user),
) -> StreamingResponse:
    _owned_job(job_id, user)

    async def event_generator():
        last_status = None
        last_updated = None
        terminal_statuses = {
            JobStatus.POSTED.value,
            JobStatus.DENIED.value,
            JobStatus.FAILED.value,
            JobStatus.CANCELLED.value,
        }
        for _ in range(120):  # Stream for up to ~2 minutes
            if await request.is_disconnected():
                break
            current = _store().get(job_id)
            if not current:
                break
            if current.status.value != last_status or current.updated_at != last_updated:
                last_status = current.status.value
                last_updated = current.updated_at
                payload = json.dumps(_job_payload(current), ensure_ascii=False)
                yield f"event: job_update\ndata: {payload}\n\n"
                if current.status.value in terminal_statuses:
                    break
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _parse_create_job_request(
    request: Request,
) -> tuple[CreateJobRequest, list[UploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        urls_raw = form.get("urls")
        if isinstance(urls_raw, UploadFile):
            urls_raw = ""
        urls_text = str(urls_raw or "").strip()
        try:
            urls = json.loads(urls_text) if urls_text else []
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400, detail="urls must be a JSON array of links."
            ) from exc
        if not isinstance(urls, list):
            raise HTTPException(
                status_code=400, detail="urls must be a JSON array of links."
            )
        payload = {
            "brief": str(form.get("brief") or ""),
            "notes": str(form.get("notes") or "") or None,
            "template": str(form.get("template") or "") or None,
            "language": str(form.get("language") or "en"),
            "urls": [str(item) for item in urls],
        }
        try:
            body = CreateJobRequest.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc
        assets = [
            item
            for item in form.getlist("assets")
            if isinstance(item, UploadFile) and (item.filename or "").strip()
        ]
        return body, assets

    raw = await request.body()
    if not raw:
        return CreateJobRequest(), []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc
    try:
        return CreateJobRequest.model_validate(payload), []
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


async def _create_job_impl(
    request: Request,
    user: dict,
    *, draft_only: bool = False,
) -> dict:
    try:
        runtime = get_runtime()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Agent runtime not ready. Start with: python api/run.py",
        ) from exc

    body, assets = await _parse_create_job_request(request)

    # Prefer per-account overrides; otherwise use platform .env
    resolved = resolve_settings_for_account(user["id"], base=runtime.settings)
    if not resolved.allowed_telegram_user_id:
        raise HTTPException(
            status_code=400,
            detail="Set ALLOWED_TELEGRAM_USER_ID in the server .env before starting a job.",
        )
    if not resolved.gemini_api_keys:
        raise HTTPException(
            status_code=400,
            detail="Set GEMINI_API_KEY (or GEMINI_API_KEYS) in the server .env before starting a job.",
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
            language=body.language,
            sources=sources,
            owner_account_id=user["id"],
            start=not draft_only and not bool(assets),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if assets:
        try:
            file_sources = await save_job_assets(
                resolved.uploads_dir, job.id, assets
            )
            for source in file_sources:
                runtime.store.add_source(job.id, source)
            job = runtime.store.get(job.id) or job
            if not draft_only:
                runtime.start_job(job.id)
        except HTTPException:
            runtime.store.update(
                job.id, status=JobStatus.FAILED, error="Brand image upload failed."
            )
            raise
        except Exception as exc:
            runtime.store.update(
                job.id,
                status=JobStatus.FAILED,
                error=f"Brand image upload failed: {exc}",
            )
            raise HTTPException(
                status_code=400, detail="Could not save brand images."
            ) from exc

    if draft_only:
        runtime.store.update(job.id, status=JobStatus.COLLECTING)
        try:
            storyboard = await asyncio.to_thread(
                draft_storyboard, resolved, job.brief, job.sources, language=job.language,
            )
            job = runtime.store.update(
                job.id, storyboard=storyboard, title=storyboard["title"],
                caption=storyboard["caption"], status=JobStatus.SCRIPT_REVIEW, error=None,
            )
        except Exception as exc:
            runtime.store.update(job.id, status=JobStatus.FAILED, error="Script generation failed. Retry using your saved campaign details.")
            raise HTTPException(status_code=502, detail="Could not generate the script. Please try again; your business details are saved.") from exc
    return {
        "ok": True,
        "job": _job_payload(job),
        "message": "Script ready for review." if draft_only else "Job started. Watch Telegram for Approve / Deny.",
    }


@app.post("/api/jobs")
async def create_job(request: Request, user: dict = Depends(_require_user)) -> dict:
    try:
        return await _create_job_impl(request, user)
    finally:
        await request.close()


@app.post("/api/campaign-drafts")
async def create_campaign_draft(request: Request, user: dict = Depends(_require_user)) -> dict:
    try:
        return await _create_job_impl(request, user, draft_only=True)
    finally:
        await request.close()





@app.post("/api/jobs/{job_id}/draft")
async def retry_campaign_draft(job_id: str, body: DraftRetryRequest, user: dict = Depends(_require_user)) -> dict:
    _owned_job(job_id, user)
    try:
        runtime = get_runtime()
        settings = resolve_settings_for_account(user["id"], base=runtime.settings)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    try:
        job = runtime.store.claim_draft_retry(job_id, expected_updated_at=body.expected_updated_at)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    try:
        plan = await asyncio.to_thread(draft_storyboard, settings, job.brief, job.sources, language=job.language)
        saved = runtime.store.update(job.id, storyboard=plan, title=plan["title"], caption=plan["caption"], status=JobStatus.SCRIPT_REVIEW)
    except Exception as exc:
        runtime.store.update(job.id, status=JobStatus.FAILED, error="Script generation failed. Retry using your saved campaign details.")
        raise HTTPException(status_code=502, detail="Could not generate the script. Please try again; your business details are saved.") from exc
    return {"ok": True, "job": _job_payload(saved), "message": "Script ready for review."}


def _editable_storyboard(job, expected_updated_at: str) -> None:
    allowed = {JobStatus.SCRIPT_REVIEW, JobStatus.FAILED}
    if job.status not in allowed or not job.storyboard or job.updated_at != expected_updated_at:
        raise HTTPException(status_code=409, detail="This campaign changed. Reload the latest script before continuing.")
    try:
        if job.id in getattr(get_runtime(), "_running", set()):
            raise HTTPException(status_code=409, detail="Wait for the current generation to finish before revising.")
    except RuntimeError:
        pass


def _validated_edit(job, body: StoryboardEditRequest) -> dict:
    _editable_storyboard(job, body.expected_updated_at)
    try:
        return validate_storyboard(
            body.storyboard, language=job.language, sources=job.sources, original=job.storyboard,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _save_plan(job, plan: dict, body: StoryboardEditRequest, *, render: bool = False):
    try:
        return _store().save_storyboard(
            job.id, plan, expected_updated_at=body.expected_updated_at,
            allowed_statuses=(JobStatus.SCRIPT_REVIEW, JobStatus.FAILED),
            status=JobStatus.QUEUED if render else JobStatus.SCRIPT_REVIEW,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.put("/api/jobs/{job_id}/storyboard")
def update_storyboard(job_id: str, body: StoryboardEditRequest, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    plan = _validated_edit(job, body)
    saved = _save_plan(job, plan, body)
    return {"ok": True, "job": _job_payload(saved), "message": "Script saved."}


@app.post("/api/jobs/{job_id}/revise")
async def revise_campaign(job_id: str, body: StoryboardRevisionRequest, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    plan = _validated_edit(job, body)
    try:
        runtime = get_runtime()
        settings = resolve_settings_for_account(user["id"], base=runtime.settings)
        revised = await asyncio.to_thread(
            revise_storyboard, settings, plan, body.action, brief=job.brief, sources=job.sources,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc) if isinstance(exc, ValueError) else "Could not revise the script. Please try again.") from exc
    saved = _save_plan(job, revised, body)
    return {"ok": True, "job": _job_payload(saved), "message": "Script revised."}


@app.post("/api/jobs/{job_id}/render")
async def render_campaign(job_id: str, body: StoryboardEditRequest, user: dict = Depends(_require_user)) -> dict:
    job = _owned_job(job_id, user)
    plan = _validated_edit(job, body)
    try:
        runtime = get_runtime()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    saved = _save_plan(job, plan, body, render=True)
    runtime.start_job(saved.id)
    return {"ok": True, "job": _job_payload(saved), "message": "Video generation started. Watch Telegram for the final approval."}


@app.get("/api/jobs/{job_id}/assets/{asset_id}")
def get_job_asset(job_id: str, asset_id: str, user: dict = Depends(_require_user)) -> FileResponse:
    job = _owned_job(job_id, user)
    assets = [source for source in job.sources if source.kind == "file"]
    if not asset_id.isdigit() or str(int(asset_id)) != asset_id or int(asset_id) >= len(assets):
        raise HTTPException(status_code=404, detail="Image not found")
    path = Path(assets[int(asset_id)].value).resolve()
    try:
        settings = resolve_settings_for_account(user["id"], base=get_runtime().settings)
        path.relative_to(settings.uploads_dir.resolve() / job.id)
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=404, detail="Image not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@app.get("/api/jobs/{job_id}/video")
def get_job_video(job_id: str, user: dict = Depends(_require_user)) -> FileResponse:
    job = _owned_job(job_id, user)
    if not job.video_path:
        raise HTTPException(status_code=404, detail="Video not ready")
    path = Path(job.video_path).resolve()
    try:
        settings = resolve_settings_for_account(user["id"], base=get_runtime().settings)
        path.relative_to(settings.videos_dir.resolve())
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=404, detail="Video not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path, media_type="video/mp4")


@app.post("/api/jobs/{job_id}/redraft")
async def redraft_campaign(job_id: str, body: RedraftRequest, user: dict = Depends(_require_user)) -> dict:
    original = _owned_job(job_id, user)
    if not original.storyboard:
        raise HTTPException(status_code=409, detail="This campaign has no saved scene plan.")
    if original.status in {JobStatus.QUEUED, JobStatus.GENERATING, JobStatus.POSTING, JobStatus.COLLECTING}:
        raise HTTPException(status_code=409, detail="Wait for this campaign to finish before creating a revision.")
    try:
        runtime = get_runtime()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    settings = resolve_settings_for_account(user["id"], base=runtime.settings)
    plan = validate_storyboard(original.storyboard, language=original.language, sources=original.sources)
    if body.action:
        try:
            plan = await asyncio.to_thread(
                revise_storyboard, settings, plan, body.action, brief=original.brief, sources=original.sources,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not revise the script. Please try again.") from exc
    copied = []
    job = runtime.store.create_job(
        chat_id=original.chat_id, user_id=original.user_id, brief=original.brief,
        language=original.language, owner_account_id=user["id"], status=JobStatus.SCRIPT_REVIEW,
    )
    try:
        for source in original.sources:
            if source.kind != "file":
                copied.append(source)
                continue
            source_path = Path(source.value).resolve()
            source_path.relative_to(settings.uploads_dir.resolve() / original.id)
            destination = settings.uploads_dir / job.id / source_path.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(shutil.copy2, source_path, destination)
            copied.append(JobSource(kind="file", value=str(destination.resolve()), title=source.title))
        saved = runtime.store.update(job.id, sources=copied, storyboard=plan, title=plan["title"], caption=plan["caption"])
    except Exception as exc:
        runtime.store.update(job.id, status=JobStatus.FAILED, error="Could not copy saved images for this revision.")
        raise HTTPException(status_code=400, detail="Could not copy saved images for this revision.") from exc
    return {"ok": True, "job": _job_payload(saved), "message": "A new script draft is ready. Your previous video is unchanged."}


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
