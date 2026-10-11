"""Shared FastAPI dependencies and store accessors (no router imports)."""

from __future__ import annotations

from pathlib import Path

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.security import verify_token
from app.auth.store import UserStore
from app.config import DB_PATH
from app.integrations.store import IntegrationStore
from app import runtime as runtime_mod
from app.jobs.store import JobStatus, JobStore
from app.promotions.store import PromotionStore

bearer = HTTPBearer(auto_error=False)


def users() -> UserStore:
    return UserStore()


def integrations() -> IntegrationStore:
    return IntegrationStore()


def promotions() -> PromotionStore:
    return PromotionStore(DB_PATH)


def store() -> JobStore:
    try:
        return runtime_mod.get_runtime().store
    except RuntimeError:
        return JobStore(DB_PATH)


def job_stage(job) -> str:
    """Map store status → live flow node id for the dashboard."""
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


def public_quality_report(value):
    if isinstance(value, dict):
        return {key: public_quality_report(item) for key, item in value.items()
                if not key.endswith("_path")}
    if isinstance(value, list):
        return [public_quality_report(item) for item in value]
    return value


def job_payload(job) -> dict:
    return {
        "id": job.id,
        "brief": job.brief,
        "language": job.language,
        "status": job.status.value,
        "stage": job_stage(job),
        "title": job.title,
        "caption": job.caption,
        "video_format": job.video_format,
        "source_count": len(job.sources),
        "video_path": job.video_path,
        "video_url": f"/api/jobs/{job.id}/video" if job.video_path else None,
        "storyboard": job.storyboard,
        "quality_report": public_quality_report(job.quality_report),
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


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    user = users().get_by_id(str(payload.get("uid", "")))
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    return user.public()


# Back-compat aliases used by older call sites / tests.
_users = users
_integrations = integrations
_promotions = promotions
_store = store
_job_payload = job_payload
_require_user = require_user
