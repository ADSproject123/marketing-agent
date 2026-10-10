"""Poll extra Telegram bots configured by dashboard users."""

from __future__ import annotations

import asyncio
import logging

from telegram.ext import Application, CallbackQueryHandler, CommandHandler

from app.telegram_bot.handlers import BotHandlers

logger = logging.getLogger(__name__)


class TelegramBotHub:
    """Keeps one Application per user bot token so Approve/Deny still works."""

    def __init__(self, handlers: BotHandlers) -> None:
        self.handlers = handlers
        self._apps: dict[str, Application] = {}
        self._lock = asyncio.Lock()

    def _wire(self, application: Application) -> None:
        application.add_handler(CommandHandler(["start", "help"], self.handlers.help_cmd))
        application.add_handler(CommandHandler("status", self.handlers.status_cmd))
        application.add_handler(
            CommandHandler("login_notebook", self.handlers.login_notebook_cmd)
        )
        application.add_handler(CallbackQueryHandler(self.handlers.on_callback))

    async def ensure_token(self, token: str | None) -> None:
        if not token or not token.strip():
            return
        token = token.strip()
        async with self._lock:
            if token in self._apps:
                return
            application = Application.builder().token(token).build()
            self._wire(application)
            await application.initialize()
            await application.start()
            await application.updater.start_polling(
                allowed_updates=["message", "callback_query"]
            )
            self._apps[token] = application
            logger.info("Started extra Telegram bot polling (%s…)", token[:8])

    async def sync_tokens(self, tokens: list[str]) -> None:
        for token in tokens:
            try:
                await self.ensure_token(token)
            except Exception:
                logger.exception("Failed to start polling for a user Telegram bot")

    async def shutdown(self) -> None:
        async with self._lock:
            for token, application in list(self._apps.items()):
                try:
                    await application.updater.stop()
                    await application.stop()
                    await application.shutdown()
                except Exception:
                    logger.exception("Error shutting down bot %s…", token[:8])
            self._apps.clear()
