"""Automated schedule engine for generating and publishing marketing campaigns."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import zoneinfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from app.config import Settings
from app.integrations.resolve import resolve_settings_for_account
from app.jobs.store import Job, JobSource, JobStatus
from app import runtime as runtime_mod
from app.schedules.store import Schedule, ScheduleStore
from app import storyboards

logger = logging.getLogger("marketing_agent.schedules")


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def compute_next_run(schedule: Schedule) -> str | None:
    """Calculate the next ISO timestamp when this schedule should fire."""
    if not schedule.is_active:
        return None

    try:
        tz = zoneinfo.ZoneInfo(schedule.timezone or "Asia/Phnom_Penh")
    except Exception:
        tz = zoneinfo.ZoneInfo("Asia/Phnom_Penh")

    now = datetime.now(tz)

    if schedule.schedule_type == "once":
        if not schedule.run_at:
            return None
        try:
            target = datetime.fromisoformat(schedule.run_at)
            if target.tzinfo is None:
                target = target.replace(tzinfo=tz)
            if target > now:
                return target.isoformat()
            return None
        except Exception:
            return None

    # Recurring schedule
    time_str = (schedule.time_of_day or "09:00").strip()
    try:
        hour_s, minute_s = time_str.split(":", 1)
        hour = int(hour_s)
        minute = int(minute_s)
    except Exception:
        hour, minute = 9, 0

    days = schedule.days_of_week or ["mon", "wed", "fri"]
    # Normalize day names to 3-letter lowercase for CronTrigger
    day_map = {
        "monday": "mon", "tuesday": "tue", "wednesday": "wed",
        "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun",
    }
    short_days = [day_map.get(d.lower(), d.lower()[:3]) for d in days]
    dow_str = ",".join(short_days) if short_days else "mon,wed,fri"

    try:
        trigger = CronTrigger(
            day_of_week=dow_str,
            hour=hour,
            minute=minute,
            timezone=tz,
        )
        next_dt = trigger.get_next_fire_time(None, now)
        return next_dt.isoformat() if next_dt else None
    except Exception as exc:
        logger.warning("Could not compute next run for schedule %s: %s", schedule.id, exc)
        return None


class ScheduleService:
    def __init__(self, store: ScheduleStore | None = None) -> None:
        self.store = store or ScheduleStore()
        self.scheduler = AsyncIOScheduler()
        self._running_schedules: set[str] = set()

    def start(self) -> None:
        """Start the background scheduler and register all active schedules."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Schedule service started.")
        self.sync_all()

    def shutdown(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Schedule service stopped.")

    def sync_all(self) -> None:
        """Sync all active schedules from the store into APScheduler."""
        active_list = self.store.list_all_active()
        for schedule in active_list:
            self.register(schedule)

    def register(self, schedule: Schedule) -> None:
        """Add or update an APScheduler job for this schedule."""
        job_id = f"schedule_{schedule.id}"
        # Remove existing if any
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

        if not schedule.is_active:
            self.store.update(schedule.id, next_run_at=None)
            return

        next_iso = compute_next_run(schedule)
        self.store.update(schedule.id, next_run_at=next_iso)
        if not next_iso:
            return

        try:
            tz = zoneinfo.ZoneInfo(schedule.timezone or "Asia/Phnom_Penh")
        except Exception:
            tz = zoneinfo.ZoneInfo("Asia/Phnom_Penh")

        if schedule.schedule_type == "once":
            try:
                target = datetime.fromisoformat(schedule.run_at)
                if target.tzinfo is None:
                    target = target.replace(tzinfo=tz)
                self.scheduler.add_job(
                    self._job_callback,
                    trigger=DateTrigger(run_date=target),
                    args=[schedule.id],
                    id=job_id,
                    replace_existing=True,
                )
            except Exception as exc:
                logger.error("Failed to add DateTrigger for schedule %s: %s", schedule.id, exc)
        else:
            time_str = (schedule.time_of_day or "09:00").strip()
            hour, minute = 9, 0
            try:
                h, m = time_str.split(":", 1)
                hour, minute = int(h), int(m)
            except Exception:
                pass

            day_map = {
                "monday": "mon", "tuesday": "tue", "wednesday": "wed",
                "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun",
            }
            short_days = [day_map.get(d.lower(), d.lower()[:3]) for d in (schedule.days_of_week or [])]
            dow_str = ",".join(short_days) if short_days else "mon,wed,fri"

            self.scheduler.add_job(
                self._job_callback,
                trigger=CronTrigger(day_of_week=dow_str, hour=hour, minute=minute, timezone=tz),
                args=[schedule.id],
                id=job_id,
                replace_existing=True,
            )

    def unregister(self, schedule_id: str) -> None:
        """Remove schedule from APScheduler."""
        job_id = f"schedule_{schedule_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

    async def _job_callback(self, schedule_id: str) -> None:
        """Internal callback invoked by APScheduler."""
        await self.execute_schedule(schedule_id, manual=False)

    async def execute_schedule(self, schedule_id: str, *, manual: bool = False) -> dict[str, Any]:
        """Execute automated generation and optional Facebook auto-publish."""
        if schedule_id in self._running_schedules:
            logger.warning("Schedule %s is already running.", schedule_id)
            return {"ok": False, "message": "Schedule is already running."}

        schedule = self.store.get(schedule_id)
        if not schedule:
            return {"ok": False, "message": "Schedule not found."}

        self._running_schedules.add(schedule_id)
        self.store.update(schedule_id, last_status="running", last_error=None)

        try:
            runtime = runtime_mod.get_runtime()
            settings = resolve_settings_for_account(schedule.owner_account_id, base=runtime.settings)
        except Exception as exc:
            logger.exception("Failed to resolve settings for schedule %s", schedule_id)
            self._running_schedules.discard(schedule_id)
            self.store.update(schedule_id, last_status="failed", last_error=str(exc))
            return {"ok": False, "message": f"Settings resolution failed: {exc}"}

        try:
            # 1. Prepare campaign brief and sources
            style = schedule.video_style or "Warm and friendly"
            duration = schedule.target_duration or 30
            notes_text = (
                f"Video style: {style}\n"
                f"Target video length: {duration} seconds\n"
                f"Auto-scheduled campaign run on {_utcnow()}.\n"
            )
            if schedule.auto_post_facebook:
                notes_text += "Action: Auto-publish to connected Facebook Page upon video render.\n"

            sources = [JobSource(kind="text", value=notes_text, title="Schedule instructions")]

            # 2. Automatically generate the script and storyboard
            logger.info("Drafting storyboard for schedule '%s' (ID: %s)...", schedule.title, schedule.id)
            plan = await asyncio.to_thread(
                storyboards.draft_storyboard,
                settings,
                schedule.brief,
                sources,
                language=schedule.language,
            )

            # 3. Create campaign Job in the pipeline store
            chat_id = (
                settings.allowed_telegram_user_id
                or getattr(runtime.settings, "allowed_telegram_user_id", 0)
                or 0
            )

            job = runtime.store.create(
                brief=schedule.brief,
                chat_id=chat_id,
                user_id=chat_id,
                language=schedule.language,
                sources=sources,
                title=plan.get("title") or schedule.title,
                caption=plan.get("caption") or "",
                storyboard=plan,
                status=JobStatus.QUEUED,
                owner_account_id=schedule.owner_account_id,
            )
            logger.info("Created job %s for schedule %s. Starting pipeline...", job.id, schedule.id)

            # 4. Trigger video generation pipeline
            asyncio.create_task(self._monitor_and_auto_publish(job.id, schedule))

            # 5. Update schedule state
            next_iso = compute_next_run(schedule) if schedule.schedule_type != "once" else None
            self.store.update(
                schedule.id,
                last_run_at=_utcnow(),
                last_job_id=job.id,
                last_status="success",
                last_error=None,
                run_count=schedule.run_count + 1,
                next_run_at=next_iso,
                is_active=False if schedule.schedule_type == "once" else schedule.is_active,
            )

            return {
                "ok": True,
                "job_id": job.id,
                "title": job.title,
                "auto_post_facebook": schedule.auto_post_facebook,
                "message": (
                    "Scheduled campaign generated! Video is rendering in pipeline and will "
                    + ("auto-post to Facebook." if schedule.auto_post_facebook else "await your review.")
                ),
            }
        except Exception as exc:
            logger.exception("Schedule execution failed for %s", schedule_id)
            self.store.update(
                schedule_id,
                last_status="failed",
                last_error=str(exc),
                last_run_at=_utcnow(),
            )
            return {"ok": False, "message": f"Generation failed: {exc}"}
        finally:
            self._running_schedules.discard(schedule_id)

    async def _monitor_and_auto_publish(self, job_id: str, schedule: Schedule) -> None:
        """Run the video generation pipeline and auto-publish to Facebook if configured."""
        try:
            runtime = runtime_mod.get_runtime()
            # Launch pipeline execution
            await runtime.pipeline.run_job(job_id)

            # Check resulting status
            job = runtime.store.get(job_id)
            if not job:
                return

            if job.status == JobStatus.FAILED:
                self.store.update(schedule.id, last_status="failed", last_error=job.error)
                return

            # If auto-post to Facebook is enabled and video is rendered:
            if schedule.auto_post_facebook and job.status == JobStatus.AWAITING_APPROVAL:
                logger.info(
                    "Schedule %s auto_post_facebook is enabled. Auto-approving and posting job %s...",
                    schedule.id,
                    job_id,
                )
                await runtime.pipeline.approve(job_id)
                logger.info("Schedule %s: Job %s successfully posted to Facebook!", schedule.id, job_id)
        except Exception as exc:
            logger.exception("Error in pipeline monitoring/auto-publish for schedule %s: %s", schedule.id, exc)
            self.store.update(schedule.id, last_error=str(exc))


# Singleton instance
_service: ScheduleService | None = None


def get_schedule_service() -> ScheduleService:
    global _service
    if _service is None:
        _service = ScheduleService()
    return _service
