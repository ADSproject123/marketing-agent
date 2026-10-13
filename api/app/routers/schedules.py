"""REST API endpoints for managing campaign schedules."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import require_user
from app.schedules.service import compute_next_run, get_schedule_service
from app.schedules.store import Schedule
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


class ScheduleCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    brief: str = Field(min_length=5)
    language: str = "en"
    video_style: str = "Warm and friendly"
    target_duration: int = 30
    schedule_type: str = "recurring"  # recurring | once
    time_of_day: str = "09:00"  # HH:MM
    days_of_week: list[str] = ["mon", "wed", "fri"]
    run_at: str | None = None  # ISO timestamp
    timezone: str = "Asia/Phnom_Penh"
    auto_post_facebook: bool = True
    is_active: bool = True


class ScheduleUpdateRequest(BaseModel):
    title: str | None = None
    brief: str | None = None
    language: str | None = None
    video_style: str | None = None
    target_duration: int | None = None
    schedule_type: str | None = None
    time_of_day: str | None = None
    days_of_week: list[str] | None = None
    run_at: str | None = None
    timezone: str | None = None
    auto_post_facebook: bool | None = None
    is_active: bool | None = None


def _owned_schedule(schedule_id: str, user_id: str) -> Schedule:
    service = get_schedule_service()
    schedule = service.store.get(schedule_id)
    if not schedule or schedule.owner_account_id != user_id:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return schedule


@router.get("")
async def list_schedules(user: dict = Depends(require_user)) -> dict[str, Any]:
    service = get_schedule_service()
    schedules = service.store.list_for_account(user["id"])
    return {
        "schedules": [s.to_dict() for s in schedules],
        "total": len(schedules),
        "active_count": sum(1 for s in schedules if s.is_active),
        "facebook_auto_count": sum(1 for s in schedules if s.is_active and s.auto_post_facebook),
    }


@router.post("")
async def create_schedule(
    body: ScheduleCreateRequest, user: dict = Depends(require_user)
) -> dict[str, Any]:
    service = get_schedule_service()

    schedule = Schedule(
        id=str(uuid.uuid4()),
        owner_account_id=user["id"],
        title=body.title.strip(),
        brief=body.brief.strip(),
        language="km" if body.language == "km" else "en",
        video_style=body.video_style or "Warm and friendly",
        target_duration=body.target_duration or 30,
        schedule_type=body.schedule_type or "recurring",
        time_of_day=body.time_of_day or "09:00",
        days_of_week=body.days_of_week or ["mon", "wed", "fri"],
        run_at=body.run_at,
        timezone=body.timezone or "Asia/Phnom_Penh",
        auto_post_facebook=body.auto_post_facebook,
        is_active=body.is_active,
    )
    schedule.next_run_at = compute_next_run(schedule)

    saved = service.store.create(schedule)
    if saved.is_active:
        service.register(saved)

    return {"ok": True, "schedule": saved.to_dict()}


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: str, user: dict = Depends(require_user)
) -> dict[str, Any]:
    schedule = _owned_schedule(schedule_id, user["id"])
    return {"schedule": schedule.to_dict()}


@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdateRequest,
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    _owned_schedule(schedule_id, user["id"])
    service = get_schedule_service()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = service.store.update(schedule_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    if updated.is_active:
        service.register(updated)
    else:
        service.unregister(schedule_id)

    return {"ok": True, "schedule": updated.to_dict()}


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: str, user: dict = Depends(require_user)
) -> dict[str, Any]:
    _owned_schedule(schedule_id, user["id"])
    service = get_schedule_service()
    updated = service.store.toggle_active(schedule_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    if updated.is_active:
        service.register(updated)
    else:
        service.unregister(schedule_id)

    return {"ok": True, "schedule": updated.to_dict()}


@router.post("/{schedule_id}/run-now")
async def run_schedule_now(
    schedule_id: str, user: dict = Depends(require_user)
) -> dict[str, Any]:
    schedule = _owned_schedule(schedule_id, user["id"])
    service = get_schedule_service()

    # Trigger execution in background task
    result = await service.execute_schedule(schedule.id, manual=True)
    return result


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str, user: dict = Depends(require_user)
) -> dict[str, Any]:
    _owned_schedule(schedule_id, user["id"])
    service = get_schedule_service()
    service.unregister(schedule_id)
    deleted = service.store.delete(schedule_id)
    return {"ok": deleted}
