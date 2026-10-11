from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request

from app.campaign_ingest import ingest_campaign_url
from app.dependencies import require_user
from app.integrations.resolve import resolve_settings_for_account
from app.llm.caption import draft_weekly_plan
from app import runtime as runtime_mod
from app.schemas import IngestUrlRequest, WeeklyPlanRequest, WeeklyPlanResponse

router = APIRouter(tags=["campaign"])


def _runtime_or_503():
    try:
        return runtime_mod.get_runtime()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Agent runtime not ready. Start with: python api/run.py",
        ) from exc


@router.post("/api/campaign/ingest")
async def campaign_ingest(body: IngestUrlRequest, user: dict = Depends(require_user)) -> dict:
    runtime = _runtime_or_503()
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


@router.post("/api/campaign/weekly-plan", response_model=WeeklyPlanResponse)
async def campaign_weekly_plan(
    body: WeeklyPlanRequest, user: dict = Depends(require_user)
) -> dict:
    runtime = _runtime_or_503()
    resolved = resolve_settings_for_account(user["id"], base=runtime.settings)
    if not resolved.gemini_api_keys:
        raise HTTPException(
            status_code=400,
            detail="Connect a Gemini API key in Settings before planning your week.",
        )
    try:
        posts = await asyncio.to_thread(
            draft_weekly_plan,
            resolved,
            body.brief or "",
            body.notes or "",
            language=body.language,
            urls=body.urls,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"posts": posts}


@router.post("/api/campaign-drafts")
async def create_campaign_draft(request: Request, user: dict = Depends(require_user)) -> dict:
    from app.routers.jobs import _create_job_impl
    try:
        return await _create_job_impl(request, user, draft_only=True)
    finally:
        await request.close()
