"""Telegram handlers — approval gate only."""

from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import ContextTypes

from app.config import Settings
from app.integrations.store import IntegrationStore
from app.jobs.pipeline import Pipeline
from app.jobs.store import JobStore
from app.notebooklm.client import check_auth
from app.telegram_bot.messages import HELP_TEXT

logger = logging.getLogger(__name__)


class BotHandlers:
    def __init__(self, settings: Settings, store: JobStore, pipeline: Pipeline) -> None:
        self.settings = settings
        self.store = store
        self.pipeline = pipeline

    def _allowed_ids(self) -> set[int]:
        ids = {int(self.settings.allowed_telegram_user_id)}
        ids |= IntegrationStore().list_telegram_user_ids()
        return ids

    def _allowed(self, update: Update) -> bool:
        user = update.effective_user
        return bool(user and user.id in self._allowed_ids())

    async def _reject(self, update: Update) -> None:
        if update.effective_message:
            await update.effective_message.reply_text("Unauthorized.")

    async def help_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._allowed(update):
            await self._reject(update)
            return
        await update.effective_message.reply_html(HELP_TEXT)

    async def login_notebook_cmd(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        if not self._allowed(update):
            await self._reject(update)
            return

        authed = check_auth()
        status = "authenticated" if authed else "NOT authenticated"
        await update.effective_message.reply_text(
            "NotebookLM auth status: "
            f"{status}\n\n"
            "On the machine running this agent, run:\n"
            "  source .venv/bin/activate\n"
            "  notebooklm login --browser-cookies chrome\n"
            "  # or: notebooklm login --browser chrome\n\n"
            "Jobs are started from the web dashboard. Telegram is Approve/Deny only."
        )

    async def status_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._allowed(update):
            await self._reject(update)
            return

        jobs = self.store.list_recent_all(limit=8)
        if not jobs:
            await update.effective_message.reply_text(
                "No jobs yet. Start one from the web dashboard at http://127.0.0.1:8787"
            )
            return

        lines = ["Recent jobs:"]
        for job in jobs:
            short = job.id[:8]
            err = f" — {job.error[:80]}" if job.error else ""
            lines.append(f"• {short} [{job.status.value}] {job.brief[:60]}{err}")
        await update.effective_message.reply_text("\n".join(lines))

    async def on_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._allowed(update):
            await self._reject(update)
            return

        query = update.callback_query
        if not query or not query.data:
            return
        await query.answer()

        action, _, job_id = query.data.partition(":")
        if not job_id:
            await query.edit_message_reply_markup(reply_markup=None)
            return

        try:
            if action == "approve":
                await self.pipeline.approve(job_id)
            elif action == "deny":
                await self.pipeline.deny(job_id)
            else:
                await query.message.reply_text(
                    "Jobs are started from the web dashboard. "
                    "Here you can only Approve or Deny."
                )
        except Exception as exc:
            logger.exception("Callback %s failed for %s", action, job_id)
            chat = update.effective_chat
            if chat:
                await context.bot.send_message(chat_id=chat.id, text=f"Error: {exc}")
