"""SQLite-backed schedule store for automated campaign generation and publishing."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from app.config import DATA_DIR, DB_PATH


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Schedule:
    id: str
    owner_account_id: str
    title: str
    brief: str
    language: str = "en"
    video_style: str = "Warm and friendly"
    target_duration: int = 30
    schedule_type: str = "recurring"  # recurring | once
    time_of_day: str = "09:00"  # HH:MM (24-hour)
    days_of_week: list[str] = field(default_factory=lambda: ["mon", "wed", "fri"])
    run_at: str | None = None  # ISO timestamp if schedule_type == 'once'
    timezone: str = "Asia/Phnom_Penh"
    auto_post_facebook: bool = True
    is_active: bool = True
    last_run_at: str | None = None
    last_job_id: str | None = None
    last_status: str | None = None  # success | failed | running
    last_error: str | None = None
    next_run_at: str | None = None
    run_count: int = 0
    created_at: str = field(default_factory=_utcnow)
    updated_at: str = field(default_factory=_utcnow)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _row_to_schedule(row: sqlite3.Row) -> Schedule:
    keys = row.keys()
    days_raw = row["days_of_week"] if "days_of_week" in keys and row["days_of_week"] else "[]"
    try:
        days = json.loads(days_raw) if isinstance(days_raw, str) else list(days_raw)
    except Exception:
        days = ["mon", "wed", "fri"]

    return Schedule(
        id=row["id"],
        owner_account_id=row["owner_account_id"],
        title=row["title"],
        brief=row["brief"],
        language=row["language"] if "language" in keys and row["language"] else "en",
        video_style=row["video_style"] if "video_style" in keys and row["video_style"] else "Warm and friendly",
        target_duration=int(row["target_duration"] or 30) if "target_duration" in keys else 30,
        schedule_type=row["schedule_type"] if "schedule_type" in keys and row["schedule_type"] else "recurring",
        time_of_day=row["time_of_day"] if "time_of_day" in keys and row["time_of_day"] else "09:00",
        days_of_week=days,
        run_at=row["run_at"] if "run_at" in keys else None,
        timezone=row["timezone"] if "timezone" in keys and row["timezone"] else "Asia/Phnom_Penh",
        auto_post_facebook=bool(row["auto_post_facebook"]) if "auto_post_facebook" in keys else True,
        is_active=bool(row["is_active"]) if "is_active" in keys else True,
        last_run_at=row["last_run_at"] if "last_run_at" in keys else None,
        last_job_id=row["last_job_id"] if "last_job_id" in keys else None,
        last_status=row["last_status"] if "last_status" in keys else None,
        last_error=row["last_error"] if "last_error" in keys else None,
        next_run_at=row["next_run_at"] if "next_run_at" in keys else None,
        run_count=int(row["run_count"] or 0) if "run_count" in keys else 0,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class ScheduleStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
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
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schedules (
                    id TEXT PRIMARY KEY,
                    owner_account_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    brief TEXT NOT NULL,
                    language TEXT NOT NULL DEFAULT 'en',
                    video_style TEXT NOT NULL DEFAULT 'Warm and friendly',
                    target_duration INTEGER NOT NULL DEFAULT 30,
                    schedule_type TEXT NOT NULL DEFAULT 'recurring',
                    time_of_day TEXT NOT NULL DEFAULT '09:00',
                    days_of_week TEXT NOT NULL DEFAULT '["mon","wed","fri"]',
                    run_at TEXT,
                    timezone TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
                    auto_post_facebook INTEGER NOT NULL DEFAULT 1,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    last_run_at TEXT,
                    last_job_id TEXT,
                    last_status TEXT,
                    last_error TEXT,
                    next_run_at TEXT,
                    run_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_schedules_owner ON schedules(owner_account_id);"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(is_active);"
            )

    def create(self, schedule: Schedule) -> Schedule:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO schedules (
                    id, owner_account_id, title, brief, language, video_style,
                    target_duration, schedule_type, time_of_day, days_of_week,
                    run_at, timezone, auto_post_facebook, is_active,
                    last_run_at, last_job_id, last_status, last_error,
                    next_run_at, run_count, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?
                );
                """,
                (
                    schedule.id,
                    schedule.owner_account_id,
                    schedule.title,
                    schedule.brief,
                    schedule.language,
                    schedule.video_style,
                    schedule.target_duration,
                    schedule.schedule_type,
                    schedule.time_of_day,
                    json.dumps(schedule.days_of_week),
                    schedule.run_at,
                    schedule.timezone,
                    1 if schedule.auto_post_facebook else 0,
                    1 if schedule.is_active else 0,
                    schedule.last_run_at,
                    schedule.last_job_id,
                    schedule.last_status,
                    schedule.last_error,
                    schedule.next_run_at,
                    schedule.run_count,
                    schedule.created_at,
                    schedule.updated_at,
                ),
            )
        return schedule

    def get(self, schedule_id: str) -> Schedule | None:
        with self._connect() as conn:
            cur = conn.execute("SELECT * FROM schedules WHERE id = ?;", (schedule_id,))
            row = cur.fetchone()
            return _row_to_schedule(row) if row else None

    def list_for_account(self, owner_account_id: str) -> list[Schedule]:
        with self._connect() as conn:
            cur = conn.execute(
                "SELECT * FROM schedules WHERE owner_account_id = ? ORDER BY created_at DESC;",
                (owner_account_id,),
            )
            return [_row_to_schedule(row) for row in cur.fetchall()]

    def list_all_active(self) -> list[Schedule]:
        with self._connect() as conn:
            cur = conn.execute(
                "SELECT * FROM schedules WHERE is_active = 1 ORDER BY next_run_at ASC;"
            )
            return [_row_to_schedule(row) for row in cur.fetchall()]

    def update(self, schedule_id: str, **fields: Any) -> Schedule | None:
        if not fields:
            return self.get(schedule_id)
        fields["updated_at"] = _utcnow()
        if "days_of_week" in fields and isinstance(fields["days_of_week"], (list, tuple)):
            fields["days_of_week"] = json.dumps(list(fields["days_of_week"]))
        if "auto_post_facebook" in fields:
            fields["auto_post_facebook"] = 1 if fields["auto_post_facebook"] else 0
        if "is_active" in fields:
            fields["is_active"] = 1 if fields["is_active"] else 0

        clauses = [f"{k} = ?" for k in fields]
        values = list(fields.values())
        values.append(schedule_id)

        with self._connect() as conn:
            conn.execute(
                f"UPDATE schedules SET {', '.join(clauses)} WHERE id = ?;",
                values,
            )
        return self.get(schedule_id)

    def toggle_active(self, schedule_id: str) -> Schedule | None:
        schedule = self.get(schedule_id)
        if not schedule:
            return None
        return self.update(schedule_id, is_active=not schedule.is_active)

    def delete(self, schedule_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM schedules WHERE id = ?;", (schedule_id,))
            return cur.rowcount > 0
