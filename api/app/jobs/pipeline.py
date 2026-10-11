"""Orchestrates generate → Telegram review → Facebook post."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from telegram import Bot
from telegram.constants import ParseMode
from telegram.error import NetworkError, TimedOut

from app.config import Settings
from app.facebook.poster import post_page_video
from app.integrations.resolve import resolve_settings_for_account
from app.jobs.store import Job, JobSource, JobStatus, JobStore
from app.llm.caption import draft_caption_package
from app.llm.storyboard_render import narration_from_storyboard, package_from_storyboard
from app.notebooklm.client import NotebookLMAuthError, generate_video_overview
from app.telegram_bot.http import (
    CONNECT_TIMEOUT,
    MEDIA_WRITE_TIMEOUT,
    POOL_TIMEOUT,
    READ_TIMEOUT,
)
from app.telegram_bot.messages import approval_keyboard, format_preview_caption

logger = logging.getLogger(__name__)

# Telegram Bot API hard limit for video uploads is 50MB for bots.
TELEGRAM_VIDEO_LIMIT_BYTES = 49 * 1024 * 1024


class Pipeline:
    def __init__(self, settings: Settings, store: JobStore, bot: Bot) -> None:
        self.settings = settings
        self.store = store
        self.bot = bot

    def _settings_for(self, job: Job) -> Settings:
        return resolve_settings_for_account(job.owner_account_id, base=self.settings)

    def _bot_for(self, job: Job, settings: Settings | None = None) -> Bot:
        from app.telegram_bot.http import build_bot

        settings = settings or self._settings_for(job)
        if settings.telegram_bot_token != self.settings.telegram_bot_token:
            return build_bot(settings.telegram_bot_token)
        return self.bot

    async def run_generation(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job:
            logger.error("Job %s not found", job_id)
            return

        settings = self._settings_for(job)
        bot = self._bot_for(job, settings)
        self.store.update(job_id, status=JobStatus.GENERATING, error=None)

        async def notify(text: str) -> None:
            try:
                await bot.send_message(chat_id=job.chat_id, text=text)
            except Exception:
                logger.exception("Failed to send progress to Telegram")

        try:
            storyboard = getattr(job, "storyboard", None)
            if storyboard:
                from app.storyboards import effective_storyboard

                storyboard = effective_storyboard(storyboard)
                await notify("Rendering your reviewed script and selected opening hook…")
                package = package_from_storyboard(job.brief, storyboard, job.sources)
            else:
                await notify("Gemini drafting campaign, caption, and video source…")
                package = await asyncio.to_thread(
                    draft_caption_package,
                    settings, job.brief, job.sources, language=job.language,
                )
            # Keep user URLs/notes, plus Gemini's generated script for NotebookLM.
            merged_sources = list(job.sources) + [
                JobSource(
                    kind="text",
                    value=package.source_text,
                    title="Gemini campaign source",
                )
            ]
            fields = dict(
                caption=package.caption,
                title=package.title,
                steering_prompt=package.steering_prompt,
                video_format=package.video_format,
            )
            if not storyboard:
                fields.update(brief=package.brief, sources=merged_sources)
            self.store.update(job_id, **fields)

            video_path: Path | None = None
            if settings.skip_notebooklm:
                await notify(
                    "SKIP_NOTEBOOKLM=1 — skipping video generation for Telegram/Gemini test."
                )
                self.store.update(job_id, status=JobStatus.AWAITING_APPROVAL)
            else:
                video_arguments = dict(
                    narration_script=narration_from_storyboard(storyboard)
                ) if storyboard else {}
                notebook_id, artifact_id, video_path = await generate_video_overview(
                    settings,
                    job_id=job_id,
                    brief=package.brief,
                    sources=merged_sources,
                    steering_prompt=package.steering_prompt,
                    video_format=package.video_format,
                    language=job.language,
                    title=package.title,
                    caption=package.caption,
                    progress_callback=notify,
                    **video_arguments,
                )
                if storyboard:
                    from app.video_finishing import finish_video

                    await notify("Adding your end card and Khmer captions when needed; checking the finished video…")
                    self.store.update(job_id, notebook_id=notebook_id, artifact_id=artifact_id)
                    try:
                        video_path, report = await asyncio.to_thread(
                            finish_video, video_path, storyboard, job.sources,
                        )
                    except Exception as exc:
                        self.store.update(job_id, quality_report={
                            "processed": False,
                            "checks": [{
                                "id": "finishing", "label": "Video finishing", "status": "fail",
                                "detail": str(exc),
                            }],
                            "metadata": {},
                        })
                        raise
                    self.store.update(job_id, quality_report=report)
                    failures = [
                        check["label"] for check in report.get("checks", [])
                        if check.get("status") == "fail"
                    ]
                    if failures:
                        raise RuntimeError("Video checks need attention: " + ", ".join(failures))
                self.store.update(
                    job_id,
                    notebook_id=notebook_id,
                    artifact_id=artifact_id,
                    video_path=str(video_path),
                    status=JobStatus.AWAITING_APPROVAL,
                )

            try:
                await self._send_preview(
                    bot=bot,
                    settings=settings,
                    chat_id=job.chat_id,
                    job_id=job_id,
                    title=package.title,
                    caption=package.caption,
                    video_path=video_path,
                )
            except Exception:
                # Video is already saved as awaiting_approval — don't fail the job
                # when Telegram delivery times out or flaky network blocks upload.
                logger.exception("Telegram preview delivery failed for job %s", job_id)
                await notify(
                    "Video is ready for review in the dashboard, but Telegram preview "
                    "upload failed. Open the job there to approve or deny."
                )
            if settings.facebook_enabled:
                await notify("Ready for review — Approve posts to Facebook, Deny cancels.")
            else:
                await notify(
                    "Ready for review — Facebook Page not configured yet "
                    "(need FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN in .env). "
                    "Approve will mark the job done without posting."
                )
        except NotebookLMAuthError as exc:
            logger.exception("NotebookLM auth failed for job %s", job_id)
            self.store.update(job_id, status=JobStatus.FAILED, error=str(exc))
            await notify(
                f"Auth required for NotebookLM.\n{exc}\n\n"
                "Use /login_notebook for recovery steps, or set SKIP_NOTEBOOKLM=1 to test "
                "Telegram + Gemini only."
            )
        except Exception as exc:
            logger.exception("Generation failed for job %s", job_id)
            self.store.update(job_id, status=JobStatus.FAILED, error=str(exc))
            await notify(f"Generation failed: {exc}")

    async def _send_preview(
        self,
        *,
        bot: Bot,
        settings: Settings,
        chat_id: int,
        job_id: str,
        title: str,
        caption: str,
        video_path: Path | None,
    ) -> None:
        text = format_preview_caption(job_id=job_id, title=title, caption=caption)
        keyboard = approval_keyboard(job_id)

        async def _send_text(body: str):
            return await bot.send_message(
                chat_id=chat_id,
                text=body,
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
            )

        message = None
        if video_path and video_path.exists():
            size = video_path.stat().st_size
            if size <= TELEGRAM_VIDEO_LIMIT_BYTES:
                last_error: Exception | None = None
                for attempt in range(3):
                    try:
                        with video_path.open("rb") as fh:
                            message = await bot.send_video(
                                chat_id=chat_id,
                                video=fh,
                                caption=text[:1024],
                                parse_mode=ParseMode.HTML,
                                reply_markup=keyboard,
                                supports_streaming=True,
                                connect_timeout=CONNECT_TIMEOUT,
                                read_timeout=READ_TIMEOUT,
                                write_timeout=MEDIA_WRITE_TIMEOUT,
                                pool_timeout=POOL_TIMEOUT,
                            )
                        break
                    except (TimedOut, NetworkError) as exc:
                        last_error = exc
                        logger.warning(
                            "Telegram send_video attempt %s/3 failed for job %s: %s",
                            attempt + 1,
                            job_id,
                            exc,
                        )
                        if attempt < 2:
                            await asyncio.sleep(2 * (attempt + 1))
                if message is None:
                    logger.error(
                        "Telegram video upload failed after retries for job %s: %s",
                        job_id,
                        last_error,
                    )
                    message = await _send_text(
                        f"{text}\n\n"
                        f"<i>Video saved locally</i>: <code>{video_path}</code>\n"
                        f"(Telegram upload timed out; approve still posts the file.)"
                    )
            else:
                message = await _send_text(
                    f"{text}\n\n"
                    f"<i>Video saved locally</i>: <code>{video_path}</code>\n"
                    f"(Too large for Telegram upload; approve still posts the file.)"
                )
        else:
            note = (
                "\n\n<i>Caption-only preview (NotebookLM skipped).</i>"
                if settings.skip_notebooklm
                else "\n\n<i>No video file attached.</i>"
            )
            message = await _send_text(f"{text}{note}")

        self.store.update(job_id, telegram_preview_message_id=message.message_id)

    async def approve(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        if job.status != JobStatus.AWAITING_APPROVAL:
            raise RuntimeError(f"Job {job_id} is not awaiting approval (status={job.status})")

        settings = self._settings_for(job)
        bot = self._bot_for(job, settings)

        if not settings.facebook_enabled:
            self.store.update(job_id, status=JobStatus.POSTED, error=None)
            await bot.send_message(
                chat_id=job.chat_id,
                text=(
                    f"Approved job {job_id[:8]}.\n"
                    "Facebook is not configured, so nothing was posted.\n"
                    "Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in the server .env "
                    "(App ID + App Secret alone are not enough to post)."
                ),
            )
            return

        if not job.video_path:
            raise RuntimeError(
                "Job has no video path. Generate with NotebookLM before posting to Facebook."
            )

        self.store.update(job_id, status=JobStatus.POSTING, error=None)
        await bot.send_message(chat_id=job.chat_id, text="Posting to Facebook…")

        try:
            result = await post_page_video(
                settings,
                video_path=Path(job.video_path),
                title=job.title or "Marketing video",
                description=job.caption or job.brief,
            )
            self.store.update(
                job_id,
                status=JobStatus.POSTED,
                facebook_post_id=result.video_id,
                facebook_post_url=result.post_url,
            )
            await bot.send_message(
                chat_id=job.chat_id,
                text=f"Posted to Facebook.\n{result.post_url}",
                disable_web_page_preview=False,
            )
        except Exception as exc:
            logger.exception("Facebook post failed for job %s", job_id)
            self.store.update(
                job_id,
                status=JobStatus.AWAITING_APPROVAL,
                error=str(exc),
            )
            await bot.send_message(
                chat_id=job.chat_id,
                text=f"Facebook post failed: {exc}\nYou can Approve again.",
                reply_markup=approval_keyboard(job_id),
            )

    async def deny(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        if job.status not in {JobStatus.AWAITING_APPROVAL, JobStatus.COLLECTING, JobStatus.QUEUED}:
            raise RuntimeError(f"Job {job_id} cannot be denied (status={job.status})")

        bot = self._bot_for(job)
        self.store.update(job_id, status=JobStatus.DENIED)
        await bot.send_message(
            chat_id=job.chat_id,
            text=f"Job {job_id[:8]} denied. Nothing was posted.",
        )
