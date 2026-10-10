"""Shared runtime: settings, store, bot, pipeline, and job runner."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from telegram import Bot

from app.config import Settings, get_settings
from app.integrations.resolve import resolve_settings_for_account
from app.integrations.store import IntegrationStore
from app.jobs.pipeline import Pipeline
from app.jobs.store import Job, JobSource, JobStatus, JobStore
from app.telegram_bot.hub import TelegramBotHub

logger = logging.getLogger(__name__)


@dataclass
class Runtime:
    settings: Settings
    store: JobStore
    bot: Bot
    pipeline: Pipeline
    bot_hub: TelegramBotHub | None
    _running: set[str]

    def start_job(self, job_id: str) -> None:
        if job_id in self._running:
            return
        self._running.add(job_id)

        async def _runner() -> None:
            try:
                await self.pipeline.run_generation(job_id)
            finally:
                self._running.discard(job_id)

        asyncio.create_task(_runner())

    def create_and_start(
        self,
        *,
        brief: str = "",
        sources: list[JobSource] | None = None,
        owner_account_id: str | None = None,
    ) -> Job:
        resolved = resolve_settings_for_account(owner_account_id, base=self.settings)
        chat_id = resolved.allowed_telegram_user_id
        if not chat_id:
            raise ValueError(
                "Set your Telegram user ID in Dashboard → Settings before starting a job."
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
            sources=list(sources or []),
            status=JobStatus.QUEUED,
            owner_account_id=owner_account_id,
        )
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
    bot = bot or Bot(token=settings.telegram_bot_token)
    pipeline = Pipeline(settings, store, bot)
    _runtime = Runtime(
        settings=settings,
        store=store,
        bot=bot,
        pipeline=pipeline,
        bot_hub=bot_hub,
        _running=set(),
    )
    return _runtime


def get_runtime() -> Runtime:
    if _runtime is None:
        raise RuntimeError("Runtime not initialized. Start with: python api/run.py")
    return _runtime


async def sync_user_telegram_bots(hub: TelegramBotHub) -> None:
    tokens = IntegrationStore().list_telegram_bot_tokens()
    await hub.sync_tokens(tokens)
