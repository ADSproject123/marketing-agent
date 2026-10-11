from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from fastapi.responses import FileResponse
from pathlib import Path
import logging
import shutil
import json
import asyncio
from starlette.datastructures import UploadFile

from app.constants import TEMPLATE_LABELS, URL_RE
from app.dependencies import job_payload, require_user, store
from app.integrations.resolve import resolve_settings_for_account
from app.jobs.store import JobSource, JobStatus
from app import runtime as runtime_mod
from app.schemas import (
    CreateJobRequest, DraftRetryRequest, RedraftRequest,
    StoryboardEditRequest, StoryboardRevisionRequest,
)
from app import storyboards as storyboards_mod
from app.uploads import save_job_assets

router = APIRouter(tags=['jobs'])

@router.get("/api/jobs")
def list_jobs(
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(require_user),
) -> dict:
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    job_store = store()
    jobs = job_store.list_recent_for_account(user["id"], limit=limit, offset=offset)
    total = job_store.count_for_account(user["id"])
    return {
        "jobs": [job_payload(j) for j in jobs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _owned_job(job_id: str, user: dict):
    job = store().get(job_id)
    if not job or job.owner_account_id != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/api/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(require_user)) -> dict:
    job = _owned_job(job_id, user)
    return job_payload(job)


@router.post("/api/jobs/{job_id}/approve")
async def approve_job(job_id: str, user: dict = Depends(require_user)) -> dict:
    job = _owned_job(job_id, user)
    if job.status != JobStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} is not awaiting approval (status: {job.status.value}).",
        )
    try:
        runtime = runtime_mod.get_runtime()
        await runtime.pipeline.approve(job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Approval failed: {exc}") from exc

    updated = store().get(job_id)
    return {
        "ok": True,
        "job": job_payload(updated),
        "message": "Campaign approved and published.",
    }


@router.post("/api/jobs/{job_id}/deny")
async def deny_job(job_id: str, user: dict = Depends(require_user)) -> dict:
    job = _owned_job(job_id, user)
    allowed_deny = {JobStatus.AWAITING_APPROVAL, JobStatus.COLLECTING, JobStatus.QUEUED}
    if job.status not in allowed_deny:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} cannot be denied (status: {job.status.value}).",
        )
    try:
        runtime = runtime_mod.get_runtime()
        await runtime.pipeline.deny(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Denial failed: {exc}") from exc

    updated = store().get(job_id)
    return {
        "ok": True,
        "job": job_payload(updated),
        "message": "Campaign denied. Nothing was posted.",
    }


@router.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user: dict = Depends(require_user)) -> dict:
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
        runtime = runtime_mod.get_runtime()
        runtime.cancel_job(job_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {exc}") from exc

    updated = store().get(job_id)
    return {
        "ok": True,
        "job": job_payload(updated),
        "message": "Campaign cancelled.",
    }


@router.get("/api/jobs/{job_id}/events")
async def job_events(
    job_id: str,
    request: Request,
    user: dict = Depends(require_user),
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
            current = store().get(job_id)
            if not current:
                break
            if current.status.value != last_status or current.updated_at != last_updated:
                last_status = current.status.value
                last_updated = current.updated_at
                payload = json.dumps(job_payload(current), ensure_ascii=False)
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
        runtime = runtime_mod.get_runtime()
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
                storyboards_mod.draft_storyboard, resolved, job.brief, job.sources, language=job.language,
            )
            job = runtime.store.update(
                job.id, storyboard=storyboard, title=storyboard["title"],
                caption=storyboard["caption"], status=JobStatus.SCRIPT_REVIEW, error=None,
            )
        except Exception as exc:
            logging.getLogger(__name__).exception("Campaign draft failed for job %s", job.id)
            runtime.store.update(job.id, status=JobStatus.FAILED, error="Script generation failed. Retry using your saved campaign details.")
            raise HTTPException(status_code=502, detail="Could not generate the script. Please try again; your business details are saved.") from exc
    return {
        "ok": True,
        "job": job_payload(job),
        "message": "Script ready for review." if draft_only else "Job started. Watch Telegram for Approve / Deny.",
    }


@router.post("/api/jobs")
async def create_job(request: Request, user: dict = Depends(require_user)) -> dict:
    try:
        return await _create_job_impl(request, user)
    finally:
        await request.close()


@router.post("/api/jobs/{job_id}/draft")
async def retry_campaign_draft(job_id: str, body: DraftRetryRequest, user: dict = Depends(require_user)) -> dict:
    _owned_job(job_id, user)
    try:
        runtime = runtime_mod.get_runtime()
        settings = resolve_settings_for_account(user["id"], base=runtime.settings)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    try:
        job = runtime.store.claim_draft_retry(job_id, expected_updated_at=body.expected_updated_at)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    try:
        plan = await asyncio.to_thread(storyboards_mod.draft_storyboard, settings, job.brief, job.sources, language=job.language)
        saved = runtime.store.update(job.id, storyboard=plan, title=plan["title"], caption=plan["caption"], status=JobStatus.SCRIPT_REVIEW)
    except Exception as exc:
        runtime.store.update(job.id, status=JobStatus.FAILED, error="Script generation failed. Retry using your saved campaign details.")
        raise HTTPException(status_code=502, detail="Could not generate the script. Please try again; your business details are saved.") from exc
    return {"ok": True, "job": job_payload(saved), "message": "Script ready for review."}


def _editable_storyboard(job, expected_updated_at: str) -> None:
    allowed = {JobStatus.SCRIPT_REVIEW, JobStatus.FAILED}
    if job.status not in allowed or not job.storyboard or job.updated_at != expected_updated_at:
        raise HTTPException(status_code=409, detail="This campaign changed. Reload the latest script before continuing.")
    try:
        if job.id in getattr(runtime_mod.get_runtime(), "_running", set()):
            raise HTTPException(status_code=409, detail="Wait for the current generation to finish before revising.")
    except RuntimeError:
        pass


def _validated_edit(job, body: StoryboardEditRequest) -> dict:
    _editable_storyboard(job, body.expected_updated_at)
    try:
        return storyboards_mod.validate_storyboard(
            body.storyboard, language=job.language, sources=job.sources, original=job.storyboard,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _save_plan(job, plan: dict, body: StoryboardEditRequest, *, render: bool = False):
    try:
        return store().save_storyboard(
            job.id, plan, expected_updated_at=body.expected_updated_at,
            allowed_statuses=(JobStatus.SCRIPT_REVIEW, JobStatus.FAILED),
            status=JobStatus.QUEUED if render else JobStatus.SCRIPT_REVIEW,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.put("/api/jobs/{job_id}/storyboard")
def update_storyboard(job_id: str, body: StoryboardEditRequest, user: dict = Depends(require_user)) -> dict:
    job = _owned_job(job_id, user)
    plan = _validated_edit(job, body)
    saved = _save_plan(job, plan, body)
    return {"ok": True, "job": job_payload(saved), "message": "Script saved."}


@router.post("/api/jobs/{job_id}/revise")
async def revise_campaign(job_id: str, body: StoryboardRevisionRequest, user: dict = Depends(require_user)) -> dict:
    job = _owned_job(job_id, user)
    plan = _validated_edit(job, body)
    try:
        runtime = runtime_mod.get_runtime()
        settings = resolve_settings_for_account(user["id"], base=runtime.settings)
        revised = await asyncio.to_thread(
            storyboards_mod.revise_storyboard, settings, plan, body.action, brief=job.brief, sources=job.sources,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc) if isinstance(exc, ValueError) else "Could not revise the script. Please try again.") from exc
    saved = _save_plan(job, revised, body)
    return {"ok": True, "job": job_payload(saved), "message": "Script revised."}


@router.post("/api/jobs/{job_id}/render")
async def render_campaign(job_id: str, body: StoryboardEditRequest, user: dict = Depends(require_user)) -> dict:
    job = _owned_job(job_id, user)
    plan = _validated_edit(job, body)
    try:
        runtime = runtime_mod.get_runtime()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    saved = _save_plan(job, plan, body, render=True)
    runtime.start_job(saved.id)
    return {"ok": True, "job": job_payload(saved), "message": "Video generation started. Watch Telegram for the final approval."}


@router.get("/api/jobs/{job_id}/assets/{asset_id}")
def get_job_asset(job_id: str, asset_id: str, user: dict = Depends(require_user)) -> FileResponse:
    job = _owned_job(job_id, user)
    assets = [source for source in job.sources if source.kind == "file"]
    if not asset_id.isdigit() or str(int(asset_id)) != asset_id or int(asset_id) >= len(assets):
        raise HTTPException(status_code=404, detail="Image not found")
    path = Path(assets[int(asset_id)].value).resolve()
    try:
        settings = resolve_settings_for_account(user["id"], base=runtime_mod.get_runtime().settings)
        path.relative_to(settings.uploads_dir.resolve() / job.id)
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=404, detail="Image not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.get("/api/jobs/{job_id}/video")
def get_job_video(job_id: str, user: dict = Depends(require_user)) -> FileResponse:
    job = _owned_job(job_id, user)
    if not job.video_path:
        raise HTTPException(status_code=404, detail="Video not ready")
    path = Path(job.video_path).resolve()
    try:
        settings = resolve_settings_for_account(user["id"], base=runtime_mod.get_runtime().settings)
        path.relative_to(settings.videos_dir.resolve())
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=404, detail="Video not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(path, media_type="video/mp4")


@router.post("/api/jobs/{job_id}/redraft")
async def redraft_campaign(job_id: str, body: RedraftRequest, user: dict = Depends(require_user)) -> dict:
    original = _owned_job(job_id, user)
    if not original.storyboard:
        raise HTTPException(status_code=409, detail="This campaign has no saved scene plan.")
    if original.status in {JobStatus.QUEUED, JobStatus.GENERATING, JobStatus.POSTING, JobStatus.COLLECTING}:
        raise HTTPException(status_code=409, detail="Wait for this campaign to finish before creating a revision.")
    try:
        runtime = runtime_mod.get_runtime()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Agent runtime not ready.") from exc
    settings = resolve_settings_for_account(user["id"], base=runtime.settings)
    plan = storyboards_mod.validate_storyboard(original.storyboard, language=original.language, sources=original.sources)
    if body.action:
        try:
            plan = await asyncio.to_thread(
                storyboards_mod.revise_storyboard, settings, plan, body.action, brief=original.brief, sources=original.sources,
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
    return {"ok": True, "job": job_payload(saved), "message": "A new script draft is ready. Your previous video is unchanged."}

