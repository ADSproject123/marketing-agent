"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# api/app/config.py → api/ → project root
APP_DIR = Path(__file__).resolve().parent
API_DIR = APP_DIR.parent
PROJECT_ROOT = API_DIR.parent

DATA_DIR = PROJECT_ROOT / "data"
VIDEOS_DIR = DATA_DIR / "videos"
UPLOADS_DIR = DATA_DIR / "uploads"
DOWNLOADS_DIR = DATA_DIR / "downloads"
DB_PATH = DATA_DIR / "jobs.db"
WEB_DIST = PROJECT_ROOT / "web" / "dist"

# Prefer project-root .env; fall back to api/.env
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(API_DIR / ".env")


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _optional(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip()


def _flag(name: str, default: bool = False) -> bool:
    raw = _optional(name)
    if raw is None:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


def _parse_gemini_keys() -> tuple[str, ...]:
    """
    Collect Gemini API keys for rotation.

    Supported forms:
    - GEMINI_API_KEYS=key1,key2
    - GEMINI_API_KEY / GEMINI_API_KEY_2 / GEMINI_API_KEY_3 ...
    - GOOGLE_API_KEY (alias for a single key)
    """
    keys: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None) -> None:
        if not raw:
            return
        for part in raw.split(","):
            key = part.strip()
            if key and key not in seen:
                seen.add(key)
                keys.append(key)

    add(_optional("GEMINI_API_KEYS"))
    add(_optional("GEMINI_API_KEY"))
    add(_optional("GOOGLE_API_KEY"))

    idx = 2
    while True:
        extra = _optional(f"GEMINI_API_KEY_{idx}")
        if not extra:
            break
        add(extra)
        idx += 1

    return tuple(keys)


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    allowed_telegram_user_id: int
    gemini_api_keys: tuple[str, ...]
    gemini_model: str
    facebook_app_id: str | None
    facebook_page_id: str | None
    facebook_page_access_token: str | None
    facebook_graph_version: str
    skip_notebooklm: bool
    video_format: str
    video_style: str
    video_language: str
    video_poll_interval_seconds: int
    video_timeout_minutes: int
    data_dir: Path
    videos_dir: Path
    uploads_dir: Path
    downloads_dir: Path
    db_path: Path

    @property
    def gemini_api_key(self) -> str | None:
        return self.gemini_api_keys[0] if self.gemini_api_keys else None

    @property
    def facebook_enabled(self) -> bool:
        return bool(
            self.facebook_app_id
            and self.facebook_page_id
            and self.facebook_page_access_token
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings(
        telegram_bot_token=_require("TELEGRAM_BOT_TOKEN"),
        allowed_telegram_user_id=int(_require("ALLOWED_TELEGRAM_USER_ID")),
        gemini_api_keys=_parse_gemini_keys(),
        gemini_model=_optional("GEMINI_MODEL", "gemini-2.0-flash") or "gemini-2.0-flash",
        facebook_app_id=_optional("FACEBOOK_APP_ID"),
        facebook_page_id=_optional("FACEBOOK_PAGE_ID"),
        facebook_page_access_token=_optional("FACEBOOK_PAGE_ACCESS_TOKEN"),
        facebook_graph_version=_optional("FACEBOOK_GRAPH_VERSION", "v22.0") or "v22.0",
        skip_notebooklm=_flag("SKIP_NOTEBOOKLM", default=False),
        video_format=_optional("NOTEBOOKLM_VIDEO_FORMAT", "short") or "short",
        video_style=_optional("NOTEBOOKLM_VIDEO_STYLE", "auto_select") or "auto_select",
        video_language=_optional("NOTEBOOKLM_VIDEO_LANGUAGE", "en") or "en",
        video_poll_interval_seconds=int(
            _optional("VIDEO_POLL_INTERVAL_SECONDS", "30") or "30"
        ),
        video_timeout_minutes=int(_optional("VIDEO_TIMEOUT_MINUTES", "45") or "45"),
        data_dir=DATA_DIR,
        videos_dir=VIDEOS_DIR,
        uploads_dir=UPLOADS_DIR,
        downloads_dir=DOWNLOADS_DIR,
        db_path=DB_PATH,
    )
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.videos_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.downloads_dir.mkdir(parents=True, exist_ok=True)
    return settings
