"""Shared Telegram HTTP client settings for large video uploads."""

from __future__ import annotations

from telegram import Bot
from telegram.ext import Application
from telegram.request import HTTPXRequest

# Default PTB write_timeout is ~5s — too short for finished campaign MP4s.
CONNECT_TIMEOUT = 30.0
READ_TIMEOUT = 120.0
WRITE_TIMEOUT = 300.0
POOL_TIMEOUT = 30.0

# Alias used by send_video call sites (PTB 20.x has no separate media_write_timeout).
MEDIA_WRITE_TIMEOUT = WRITE_TIMEOUT


def telegram_request() -> HTTPXRequest:
    return HTTPXRequest(
        connect_timeout=CONNECT_TIMEOUT,
        read_timeout=READ_TIMEOUT,
        write_timeout=WRITE_TIMEOUT,
        pool_timeout=POOL_TIMEOUT,
    )


def build_application(token: str) -> Application:
    # Pass a single HTTPXRequest — builder rejects mixing .request() with
    # connect/read/write/pool_timeout setters (PTB 20.x).
    return Application.builder().token(token).request(telegram_request()).build()


def build_bot(token: str) -> Bot:
    return Bot(token=token, request=telegram_request())
