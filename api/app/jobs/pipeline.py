"""Orchestrates generate → Telegram review → Facebook post."""

from __future__ import annotations

import logging
from pathlib import Path

from telegram import Bot
from telegram.constants import ParseMode

from app.config import Settings
from app.facebook.poster import post_page_video
from app.jobs.store import JobSource, JobStatus, JobStore
from app.llm.caption import draft_caption_package
from app.notebooklm.client import NotebookLMAuthError, generate_video_overview
from app.telegram_bot.messages import approval_keyboard, format_preview_caption

logger = logging.getLogger(__name__)

# Telegram Bot API hard limit for video uploads is 50MB for bots.
TELEGRAM_VIDEO_LIMIT_BYTES = 49 * 1024 * 1024


class Pipeline:
    def __init__(self, settings: Settings, store: JobStore, bot: Bot) -> None:
        self.settings = settings
        self.store = store
        self.bot = bot

    async def run_generation(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job:
            logger.error("Job %s not found", job_id)
            return

        self.store.update(job_id, status=JobStatus.GENERATING, error=None)

        async def notify(text: str) -> None:
            try:
                await self.bot.send_message(chat_id=job.chat_id, text=text)
            except Exception:
                logger.exception("Failed to send progress to Telegram")

        try:
            await notify("Gemini drafting campaign, caption, and video source…")
            package = draft_caption_package(self.settings, job.brief, job.sources)
            # Keep user URLs/notes, plus Gemini's generated script for NotebookLM.
            merged_sources = list(job.sources) + [
                JobSource(
                    kind="text",
                    value=package.source_text,
                    title="Gemini campaign source",
                )
            ]
            self.store.update(
                job_id,
                brief=package.brief,
                caption=package.caption,
                title=package.title,
                steering_prompt=package.steering_prompt,
                video_format=package.video_format,
                sources=merged_sources,
            )

            video_path: Path | None = None
            if self.settings.skip_notebooklm:
                await notify(
                    "SKIP_NOTEBOOKLM=1 — skipping video generation for Telegram/Gemini test."
                )
                self.store.update(job_id, status=JobStatus.AWAITING_APPROVAL)
            else:
                notebook_id, artifact_id, video_path = await generate_video_overview(
                    self.settings,
                    job_id=job_id,
                    brief=package.brief,
                    sources=merged_sources,
                    steering_prompt=package.steering_prompt,
                    video_format=package.video_format,
                    progress_callback=notify,
                )
                self.store.update(
                    job_id,
                    notebook_id=notebook_id,
                    artifact_id=artifact_id,
                    video_path=str(video_path),
                    status=JobStatus.AWAITING_APPROVAL,
                )

            await self._send_preview(
                chat_id=job.chat_id,
                job_id=job_id,
                title=package.title,
                caption=package.caption,
                video_path=video_path,
            )
            if self.settings.facebook_enabled:
                await notify("Ready for review — Approve posts to Facebook, Deny cancels.")
            else:
                await notify(
                    "Ready for review — Facebook is not configured yet. "
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
        chat_id: int,
        job_id: str,
        title: str,
        caption: str,
        video_path: Path | None,
    ) -> None:
        text = format_preview_caption(job_id=job_id, title=title, caption=caption)
        keyboard = approval_keyboard(job_id)

        if video_path and video_path.exists():
            size = video_path.stat().st_size
            if size <= TELEGRAM_VIDEO_LIMIT_BYTES:
                with video_path.open("rb") as fh:
                    message = await self.bot.send_video(
                        chat_id=chat_id,
                        video=fh,
                        caption=text[:1024],
                        parse_mode=ParseMode.HTML,
                        reply_markup=keyboard,
                        supports_streaming=True,
                    )
            else:
                message = await self.bot.send_message(
                    chat_id=chat_id,
                    text=(
                        f"{text}\n\n"
                        f"<i>Video saved locally</i>: <code>{video_path}</code>\n"
                        f"(Too large for Telegram upload; approve still posts the file.)"
                    ),
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                )
        else:
            note = (
                "\n\n<i>Caption-only preview (NotebookLM skipped).</i>"
                if self.settings.skip_notebooklm
                else "\n\n<i>No video file attached.</i>"
            )
            message = await self.bot.send_message(
                chat_id=chat_id,
                text=f"{text}{note}",
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
            )

        self.store.update(job_id, telegram_preview_message_id=message.message_id)

    async def approve(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        if job.status != JobStatus.AWAITING_APPROVAL:
            raise RuntimeError(f"Job {job_id} is not awaiting approval (status={job.status})")

        if not self.settings.facebook_enabled:
            self.store.update(job_id, status=JobStatus.POSTED, error=None)
            await self.bot.send_message(
                chat_id=job.chat_id,
                text=(
                    f"Approved job {job_id[:8]}.\n"
                    "Facebook is not configured, so nothing was posted.\n"
                    "Add FACEBOOK_* values in .env when you are ready."
                ),
            )
            return

        if not job.video_path:
            raise RuntimeError(
                "Job has no video path. Generate with NotebookLM before posting to Facebook."
            )

        self.store.update(job_id, status=JobStatus.POSTING, error=None)
        await self.bot.send_message(chat_id=job.chat_id, text="Posting to Facebook…")

        try:
            result = await post_page_video(
                self.settings,
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
            await self.bot.send_message(
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
            await self.bot.send_message(
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

        self.store.update(job_id, status=JobStatus.DENIED)
        await self.bot.send_message(
            chat_id=job.chat_id,
            text=f"Job {job_id[:8]} denied. Nothing was posted.",
        )
