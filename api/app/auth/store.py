"""SQLite-backed user accounts for the dashboard."""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from app.auth.security import hash_password, verify_password
from app.config import DATA_DIR

USERS_DB_PATH = DATA_DIR / "users.db"


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class User:
    id: str
    email: str
    name: str
    password_hash: str
    created_at: str

    def public(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "created_at": self.created_at,
        }


class UserStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = Path(db_path or USERS_DB_PATH)
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
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)"
            )

    def get_by_id(self, user_id: str) -> User | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        return self._from_row(row) if row else None

    def get_by_email(self, email: str) -> User | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ? COLLATE NOCASE",
                (email.strip(),),
            ).fetchone()
        return self._from_row(row) if row else None

    def create(self, *, email: str, name: str, password: str) -> User:
        email_n = email.strip().lower()
        name_n = name.strip()
        if not email_n or "@" not in email_n:
            raise ValueError("Enter a valid email address.")
        if len(name_n) < 2:
            raise ValueError("Name must be at least 2 characters.")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if self.get_by_email(email_n):
            raise ValueError("An account with this email already exists.")

        user = User(
            id=str(uuid.uuid4()),
            email=email_n,
            name=name_n,
            password_hash=hash_password(password),
            created_at=_utcnow(),
        )
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO users (id, email, name, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user.id, user.email, user.name, user.password_hash, user.created_at),
            )
        return user

    def authenticate(self, email: str, password: str) -> User | None:
        user = self.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def _from_row(row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            email=row["email"],
            name=row["name"],
            password_hash=row["password_hash"],
            created_at=row["created_at"],
        )
