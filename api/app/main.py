"""Combined runtime: FastAPI dashboard API + Telegram approval gate."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

import uvicorn
from telegram.ext import Application, CallbackQueryHandler, CommandHandler

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import get_settings
from app.runtime import init_runtime
from app.telegram_bot.handlers import BotHandlers
from app.webapp import app as web_app

logging.basicConfig(
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("marketing_agent")


async def run() -> None:
    settings = get_settings()
    application = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .build()
    )
    runtime = init_runtime(settings=settings, bot=application.bot)
    handlers = BotHandlers(runtime.settings, runtime.store, runtime.pipeline)

    application.add_handler(CommandHandler(["start", "help"], handlers.help_cmd))
    application.add_handler(CommandHandler("status", handlers.status_cmd))
    application.add_handler(CommandHandler("login_notebook", handlers.login_notebook_cmd))
    application.add_handler(CallbackQueryHandler(handlers.on_callback))

    await application.initialize()
    await application.start()
    await application.updater.start_polling(allowed_updates=["message", "callback_query"])
    logger.info(
        "Telegram approval gate online. API + dashboard at http://127.0.0.1:8787"
    )

    config = uvicorn.Config(
        web_app,
        host="127.0.0.1",
        port=8787,
        log_level="info",
        loop="asyncio",
    )
    server = uvicorn.Server(config)
    try:
        await server.serve()
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
