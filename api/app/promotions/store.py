"""Account-owned promotion profiles stored alongside campaign jobs."""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from app.config import DB_PATH


@dataclass
class Promotion:
    id: str
    account_id: str
    kind: str
    name: str
    description: str
    benefit: str
    location: str
    website: str
    created_at: str
    updated_at: str

    def public(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "description": self.description,
            "benefit": self.benefit,
            "location": self.location,
            "website": self.website,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class PromotionStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or DB_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 30000;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS promotion_profiles (
                    id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    benefit TEXT NOT NULL DEFAULT '',
                    location TEXT NOT NULL DEFAULT '',
                    website TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_promotions_account "
                "ON promotion_profiles(account_id, created_at DESC)"
            )

    def create(
        self,
        *,
        account_id: str,
        kind: str,
        name: str,
        description: str,
        benefit: str = "",
        location: str = "",
        website: str = "",
    ) -> Promotion:
        if not account_id:
            raise ValueError("A promotion must belong to an account.")
        if kind not in {"shop", "product", "service", "other"}:
            raise ValueError("Choose a shop, product, service, or other promotion.")
        if not name.strip() or not description.strip():
            raise ValueError("Add a name and description for your promotion.")
        now = datetime.now(timezone.utc).isoformat()
        promotion = Promotion(
            id=str(uuid.uuid4()),
            account_id=account_id,
            kind=kind,
            name=name.strip(),
            description=description.strip(),
            benefit=benefit.strip(),
            location=location.strip(),
            website=website.strip(),
            created_at=now,
            updated_at=now,
        )
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO promotion_profiles (
                    id, account_id, kind, name, description,
                    benefit, location, website, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    promotion.id, promotion.account_id, promotion.kind,
                    promotion.name, promotion.description, promotion.benefit,
                    promotion.location, promotion.website,
                    promotion.created_at, promotion.updated_at,
                ),
            )
        return promotion

    def list_for_account(self, account_id: str) -> list[Promotion]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM promotion_profiles WHERE account_id = ? "
                "ORDER BY created_at DESC, id DESC",
                (account_id,),
            ).fetchall()
        return [self._from_row(row) for row in rows]

    def get(self, promotion_id: str, *, account_id: str) -> Promotion | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM promotion_profiles WHERE id = ? AND account_id = ?",
                (promotion_id, account_id),
            ).fetchone()
        return self._from_row(row) if row else None

    @staticmethod
    def _from_row(row: sqlite3.Row) -> Promotion:
        return Promotion(**dict(row))
