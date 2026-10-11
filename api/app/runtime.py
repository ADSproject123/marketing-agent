"""Shared runtime: settings, store, bot, pipeline, and job runner."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from telegram import Bot

from app.config import Settings, get_settings
from app.integrations.resolve import resolve_settings_for_account
from app.integrations.store import IntegrationStore
from app.jobs.pipeline import Pipeline
from app.jobs.store import Job, JobSource, JobStatus, JobStore
from app.telegram_bot.hub import TelegramBotHub

logger = logging.getLogger(__name__)


def reconcile_interrupted_jobs(store: JobStore) -> int:
    """Find jobs left running across server restarts and mark them failed."""
    stale_jobs = store.list_by_statuses([
        JobStatus.GENERATING,
        JobStatus.QUEUED,
        JobStatus.POSTING,
    ])
    for job in stale_jobs:
        store.update(
            job.id,
            status=JobStatus.FAILED,
            error="System restarted while processing. Please retry your campaign.",
        )
    if stale_jobs:
        logger.info("Reconciled %d interrupted jobs on startup", len(stale_jobs))
    return len(stale_jobs)


@dataclass
class Runtime:
    settings: Settings
    store: JobStore
    bot: Bot
    pipeline: Pipeline
    bot_hub: TelegramBotHub | None
    _running: set[str] = field(default_factory=set)
    _tasks: dict[str, asyncio.Task] = field(default_factory=dict)

    def start_job(self, job_id: str) -> None:
        if job_id in self._running:
            return
        self._running.add(job_id)

        async def _runner() -> None:
            try:
                await self.pipeline.run_generation(job_id)
            except asyncio.CancelledError:
                logger.info("Job %s generation task cancelled", job_id)
                raise
            finally:
                self._running.discard(job_id)
                self._tasks.pop(job_id, None)

        task = asyncio.create_task(_runner())
        self._tasks[job_id] = task

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running or queued job."""
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
        self._running.discard(job_id)
        self._tasks.pop(job_id, None)

        job = self.store.get(job_id)
        if not job:
            return False
        terminal_statuses = {
            JobStatus.POSTED,
            JobStatus.DENIED,
            JobStatus.FAILED,
            JobStatus.CANCELLED,
        }
        if job.status not in terminal_statuses:
            self.store.update(
                job_id,
                status=JobStatus.CANCELLED,
                error="Campaign cancelled by user.",
            )
            return True
        return False

    def create_and_start(
        self,
        *,
        brief: str = "",
        language: str = "en",
        sources: list[JobSource] | None = None,
        owner_account_id: str | None = None,
        start: bool = True,
    ) -> Job:
        resolved = resolve_settings_for_account(owner_account_id, base=self.settings)
        chat_id = resolved.allowed_telegram_user_id
        if not chat_id:
            raise ValueError(
                "Set ALLOWED_TELEGRAM_USER_ID in the server .env before starting a job."
            )

        # Ensure user bot is polled if they provided their own token.
        if (
            self.bot_hub
            and resolved.telegram_bot_token
            and resolved.telegram_bot_token != self.settings.telegram_bot_token
        ):
            asyncio.create_task(self.bot_hub.ensure_token(resolved.telegram_bot_token))

        job = self.store.create_job(
            chat_id=chat_id,
            user_id=chat_id,
            brief=(brief or "").strip() or "Auto — Gemini invents the campaign",
            language=language,
            sources=list(sources or []),
            status=JobStatus.QUEUED,
            owner_account_id=owner_account_id,
        )
        if start:
            self.start_job(job.id)
        logger.info(
            "Created and queued job %s for account %s",
            job.id[:8],
            (owner_account_id or "platform")[:8],
        )
        return job


_runtime: Runtime | None = None


def init_runtime(
    settings: Settings | None = None,
    bot: Bot | None = None,
    bot_hub: TelegramBotHub | None = None,
) -> Runtime:
    global _runtime
    settings = settings or get_settings()
    store = JobStore(settings.db_path)
    reconcile_interrupted_jobs(store)
    bot = bot or Bot(token=settings.telegram_bot_token)
    pipeline = Pipeline(settings, store, bot)
    _runtime = Runtime(
        settings=settings,
        store=store,
        bot=bot,
        pipeline=pipeline,
        bot_hub=bot_hub,
        _running=set(),
        _tasks={},
    )
    return _runtime


def get_runtime() -> Runtime:
    if _runtime is None:
        raise RuntimeError("Runtime not initialized. Start with: python api/run.py")
    return _runtime


async def sync_user_telegram_bots(hub: TelegramBotHub) -> None:
    tokens = IntegrationStore().list_telegram_bot_tokens()
    await hub.sync_tokens(tokens)
