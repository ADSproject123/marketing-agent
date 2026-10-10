"""SQLite store for per-account integration credentials."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from app.config import DATA_DIR
from app.integrations.crypto import decrypt_secret, encrypt_secret

INTEGRATIONS_DB_PATH = DATA_DIR / "integrations.db"
KEEP = object()  # sentinel: leave existing secret unchanged


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class UserIntegrations:
    account_id: str
    telegram_bot_token: str | None = None
    telegram_user_id: int | None = None
    gemini_api_keys: str | None = None  # comma-separated
    gemini_model: str | None = None
    facebook_app_id: str | None = None
    facebook_page_id: str | None = None
    facebook_page_name: str | None = None
    facebook_page_access_token: str | None = None
    skip_notebooklm: bool | None = None
    updated_at: str | None = None

    def public_status(self) -> dict:
        """Safe payload for the settings UI (never returns raw secrets)."""
        return {
            "telegram_bot_token_set": bool(self.telegram_bot_token),
            "telegram_user_id": self.telegram_user_id,
            "gemini_api_keys_set": bool(self.gemini_api_keys),
            "gemini_model": self.gemini_model or "",
            "facebook_app_id": self.facebook_app_id or "",
            "facebook_page_id": self.facebook_page_id or "",
            "facebook_page_name": self.facebook_page_name or "",
            "facebook_page_access_token_set": bool(self.facebook_page_access_token),
            "facebook_connected": bool(
                self.facebook_page_id and self.facebook_page_access_token
            ),
            "skip_notebooklm": bool(self.skip_notebooklm) if self.skip_notebooklm is not None else False,
            "updated_at": self.updated_at,
            "ready": {
                "telegram": bool(self.telegram_user_id),
                "gemini": bool(self.gemini_api_keys),
                "facebook": bool(
                    self.facebook_app_id
                    and self.facebook_page_id
                    and self.facebook_page_access_token
                ),
                "notebooklm": "server",
            },
        }


class IntegrationStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or INTEGRATIONS_DB_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_integrations (
                    account_id TEXT PRIMARY KEY,
                    telegram_bot_token TEXT,
                    telegram_user_id INTEGER,
                    gemini_api_keys TEXT,
                    gemini_model TEXT,
                    facebook_app_id TEXT,
                    facebook_page_id TEXT,
                    facebook_page_name TEXT,
                    facebook_page_access_token TEXT,
                    skip_notebooklm INTEGER,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cols = {r[1] for r in conn.execute("PRAGMA table_info(user_integrations)")}
            if "facebook_page_name" not in cols:
                conn.execute(
                    "ALTER TABLE user_integrations ADD COLUMN facebook_page_name TEXT"
                )

    def get(self, account_id: str) -> UserIntegrations | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM user_integrations WHERE account_id = ?",
                (account_id,),
            ).fetchone()
        return self._from_row(row) if row else None

    def list_telegram_user_ids(self) -> set[int]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT telegram_user_id FROM user_integrations WHERE telegram_user_id IS NOT NULL"
            ).fetchall()
        return {int(r["telegram_user_id"]) for r in rows if r["telegram_user_id"] is not None}

    def list_telegram_bot_tokens(self) -> list[str]:
        tokens: list[str] = []
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT telegram_bot_token FROM user_integrations WHERE telegram_bot_token IS NOT NULL"
            ).fetchall()
        for row in rows:
            plain = decrypt_secret(row["telegram_bot_token"])
            if plain:
                tokens.append(plain)
        return tokens

    def upsert(
        self,
        account_id: str,
        *,
        telegram_bot_token: object = KEEP,
        telegram_user_id: object = KEEP,
        gemini_api_keys: object = KEEP,
        gemini_model: object = KEEP,
        facebook_app_id: object = KEEP,
        facebook_page_id: object = KEEP,
        facebook_page_name: object = KEEP,
        facebook_page_access_token: object = KEEP,
        skip_notebooklm: object = KEEP,
        clear_telegram_bot_token: bool = False,
        clear_gemini_api_keys: bool = False,
        clear_facebook_page_access_token: bool = False,
    ) -> UserIntegrations:
        current = self.get(account_id) or UserIntegrations(account_id=account_id)

        def pick_secret(incoming: object, existing: str | None, clear: bool) -> str | None:
            if clear:
                return None
            if incoming is KEEP:
                return existing
            if incoming is None or (isinstance(incoming, str) and not incoming.strip()):
                return existing
            return str(incoming).strip()

        def pick_plain(incoming: object, existing):
            if incoming is KEEP:
                return existing
            return incoming

        tg_token = pick_secret(
            telegram_bot_token, current.telegram_bot_token, clear_telegram_bot_token
        )
        gemini = pick_secret(gemini_api_keys, current.gemini_api_keys, clear_gemini_api_keys)
        fb_token = pick_secret(
            facebook_page_access_token,
            current.facebook_page_access_token,
            clear_facebook_page_access_token,
        )

        tg_uid = pick_plain(telegram_user_id, current.telegram_user_id)
        if tg_uid is not None and tg_uid != "":
            tg_uid = int(tg_uid)
        else:
            tg_uid = None

        model = pick_plain(gemini_model, current.gemini_model)
        if isinstance(model, str):
            model = model.strip() or None

        fb_app = pick_plain(facebook_app_id, current.facebook_app_id)
        if isinstance(fb_app, str):
            fb_app = fb_app.strip() or None

        fb_page = pick_plain(facebook_page_id, current.facebook_page_id)
        if isinstance(fb_page, str):
            fb_page = fb_page.strip() or None

        fb_name = pick_plain(facebook_page_name, current.facebook_page_name)
        if isinstance(fb_name, str):
            fb_name = fb_name.strip() or None

        skip = pick_plain(skip_notebooklm, current.skip_notebooklm)
        if skip is not None:
            skip = bool(skip)

        updated = _utcnow()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO user_integrations (
                    account_id, telegram_bot_token, telegram_user_id, gemini_api_keys,
                    gemini_model, facebook_app_id, facebook_page_id, facebook_page_name,
                    facebook_page_access_token, skip_notebooklm, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(account_id) DO UPDATE SET
                    telegram_bot_token = excluded.telegram_bot_token,
                    telegram_user_id = excluded.telegram_user_id,
                    gemini_api_keys = excluded.gemini_api_keys,
                    gemini_model = excluded.gemini_model,
                    facebook_app_id = excluded.facebook_app_id,
                    facebook_page_id = excluded.facebook_page_id,
                    facebook_page_name = excluded.facebook_page_name,
                    facebook_page_access_token = excluded.facebook_page_access_token,
                    skip_notebooklm = excluded.skip_notebooklm,
                    updated_at = excluded.updated_at
                """,
                (
                    account_id,
                    encrypt_secret(tg_token),
                    tg_uid,
                    encrypt_secret(gemini),
                    model,
                    fb_app,
                    fb_page,
                    fb_name,
                    encrypt_secret(fb_token),
                    None if skip is None else (1 if skip else 0),
                    updated,
                ),
            )
        out = self.get(account_id)
        assert out is not None
        return out

    @staticmethod
    def _from_row(row: sqlite3.Row) -> UserIntegrations:
        skip_raw = row["skip_notebooklm"]
        skip = None if skip_raw is None else bool(skip_raw)
        keys = row.keys()
        return UserIntegrations(
            account_id=row["account_id"],
            telegram_bot_token=decrypt_secret(row["telegram_bot_token"]),
            telegram_user_id=row["telegram_user_id"],
            gemini_api_keys=decrypt_secret(row["gemini_api_keys"]),
            gemini_model=row["gemini_model"],
            facebook_app_id=row["facebook_app_id"],
            facebook_page_id=row["facebook_page_id"],
            facebook_page_name=row["facebook_page_name"]
            if "facebook_page_name" in keys
            else None,
            facebook_page_access_token=decrypt_secret(row["facebook_page_access_token"]),
            skip_notebooklm=skip,
            updated_at=row["updated_at"],
        )
