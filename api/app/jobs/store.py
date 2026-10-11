"""SQLite-backed job store for the marketing pipeline."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Iterator


class JobStatus(str, Enum):
    COLLECTING = "collecting"
    SCRIPT_REVIEW = "script_review"
    QUEUED = "queued"
    GENERATING = "generating"
    AWAITING_APPROVAL = "awaiting_approval"
    POSTING = "posting"
    POSTED = "posted"
    DENIED = "denied"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class JobSource:
    kind: str  # url | text | file
    value: str
    title: str | None = None


@dataclass
class Job:
    id: str
    chat_id: int
    user_id: int
    brief: str
    status: JobStatus
    language: str = "en"
    sources: list[JobSource] = field(default_factory=list)
    caption: str | None = None
    title: str | None = None
    steering_prompt: str | None = None
    video_format: str | None = None
    video_path: str | None = None
    notebook_id: str | None = None
    artifact_id: str | None = None
    facebook_post_id: str | None = None
    facebook_post_url: str | None = None
    error: str | None = None
    telegram_preview_message_id: int | None = None
    owner_account_id: str | None = None
    storyboard: dict[str, Any] | None = None
    quality_report: dict[str, Any] | None = None
    created_at: str = field(default_factory=lambda: _utcnow())
    updated_at: str = field(default_factory=lambda: _utcnow())

    def to_row(self) -> dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        data["sources"] = json.dumps([asdict(s) for s in self.sources])
        for key in ("storyboard", "quality_report"):
            data[key] = json.dumps(data[key], ensure_ascii=False) if data[key] is not None else None
        return data

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Job":
        sources_raw = json.loads(row["sources"] or "[]")
        keys = row.keys()
        return cls(
            id=row["id"],
            chat_id=row["chat_id"],
            user_id=row["user_id"],
            brief=row["brief"],
            status=JobStatus(row["status"]),
            language=row["language"] if "language" in keys else "en",
            sources=[JobSource(**s) for s in sources_raw],
            caption=row["caption"],
            title=row["title"],
            steering_prompt=row["steering_prompt"],
            video_format=row["video_format"],
            video_path=row["video_path"],
            notebook_id=row["notebook_id"],
            artifact_id=row["artifact_id"],
            facebook_post_id=row["facebook_post_id"],
            facebook_post_url=row["facebook_post_url"],
            error=row["error"],
            telegram_preview_message_id=row["telegram_preview_message_id"],
            owner_account_id=row["owner_account_id"] if "owner_account_id" in keys else None,
            storyboard=json.loads(row["storyboard"]) if "storyboard" in keys and row["storyboard"] else None,
            quality_report=json.loads(row["quality_report"]) if "quality_report" in keys and row["quality_report"] else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
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
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    chat_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    brief TEXT NOT NULL,
                    status TEXT NOT NULL,
                    language TEXT NOT NULL DEFAULT 'en',
                    sources TEXT NOT NULL DEFAULT '[]',
                    caption TEXT,
                    title TEXT,
                    steering_prompt TEXT,
                    video_format TEXT,
                    video_path TEXT,
                    notebook_id TEXT,
                    artifact_id TEXT,
                    facebook_post_id TEXT,
                    facebook_post_url TEXT,
                    error TEXT,
                    telegram_preview_message_id INTEGER,
                    owner_account_id TEXT,
                    storyboard TEXT,
                    quality_report TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cols = {
                r[1]
                for r in conn.execute("PRAGMA table_info(jobs)").fetchall()
            }
            if "owner_account_id" not in cols:
                conn.execute("ALTER TABLE jobs ADD COLUMN owner_account_id TEXT")
            if "language" not in cols:
                conn.execute("ALTER TABLE jobs ADD COLUMN language TEXT NOT NULL DEFAULT 'en'")
            for column in ("storyboard", "quality_report"):
                if column not in cols:
                    conn.execute(f"ALTER TABLE jobs ADD COLUMN {column} TEXT")

    def create_job(
        self,
        *,
        chat_id: int,
        user_id: int,
        brief: str,
        language: str = "en",
        sources: list[JobSource] | None = None,
        status: JobStatus = JobStatus.COLLECTING,
        owner_account_id: str | None = None,
    ) -> Job:
        if language not in {"en", "km"}:
            raise ValueError("Campaign language must be English (en) or Khmer (km).")
        job = Job(
            id=str(uuid.uuid4()),
            chat_id=chat_id,
            user_id=user_id,
            brief=brief.strip(),
            status=status,
            language=language,
            sources=sources or [],
            owner_account_id=owner_account_id,
        )
        with self._connect() as conn:
            row = job.to_row()
            conn.execute(
                """
                INSERT INTO jobs (
                    id, chat_id, user_id, brief, status, language, sources, caption, title,
                    steering_prompt, video_format, video_path, notebook_id, artifact_id,
                    facebook_post_id, facebook_post_url, error,
                    telegram_preview_message_id, owner_account_id, created_at, updated_at
                ) VALUES (
                    :id, :chat_id, :user_id, :brief, :status, :language, :sources, :caption, :title,
                    :steering_prompt, :video_format, :video_path, :notebook_id, :artifact_id,
                    :facebook_post_id, :facebook_post_url, :error,
                    :telegram_preview_message_id, :owner_account_id, :created_at, :updated_at
                )
                """,
                row,
            )
        return job

    def get(self, job_id: str) -> Job | None:
        with self._connect() as conn:
            cur = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cur.fetchone()
            return Job.from_row(row) if row else None

    def get_collecting_for_user(self, user_id: int) -> Job | None:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT * FROM jobs
                WHERE user_id = ? AND status = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id, JobStatus.COLLECTING.value),
            )
            row = cur.fetchone()
            return Job.from_row(row) if row else None

    def list_recent(self, user_id: int, limit: int = 10) -> list[Job]:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT * FROM jobs
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
            return [Job.from_row(r) for r in cur.fetchall()]

    def list_recent_all(self, limit: int = 20) -> list[Job]:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT * FROM jobs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            return [Job.from_row(r) for r in cur.fetchall()]

    def list_recent_for_account(
        self, owner_account_id: str, limit: int = 20, offset: int = 0
    ) -> list[Job]:
        with self._connect() as conn:
            cur = conn.execute(
                """
                SELECT * FROM jobs
                WHERE owner_account_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (owner_account_id, limit, offset),
            )
            return [Job.from_row(r) for r in cur.fetchall()]

    def count_for_account(self, owner_account_id: str) -> int:
        with self._connect() as conn:
            cur = conn.execute(
                "SELECT COUNT(*) FROM jobs WHERE owner_account_id = ?",
                (owner_account_id,),
            )
            row = cur.fetchone()
            return int(row[0]) if row else 0

    def list_by_statuses(self, statuses: list[JobStatus] | tuple[JobStatus, ...]) -> list[Job]:
        if not statuses:
            return []
        placeholders = ",".join("?" for _ in statuses)
        vals = [s.value if isinstance(s, JobStatus) else str(s) for s in statuses]
        with self._connect() as conn:
            cur = conn.execute(
                f"""
                SELECT * FROM jobs
                WHERE status IN ({placeholders})
                ORDER BY created_at DESC
                """,
                vals,
            )
            return [Job.from_row(r) for r in cur.fetchall()]

    def update(self, job_id: str, **fields: Any) -> Job:
        if not fields:
            job = self.get(job_id)
            if not job:
                raise KeyError(f"Job not found: {job_id}")
            return job

        allowed = {
            "brief",
            "status",
            "sources",
            "caption",
            "title",
            "steering_prompt",
            "video_format",
            "video_path",
            "notebook_id",
            "artifact_id",
            "facebook_post_id",
            "facebook_post_url",
            "error",
            "telegram_preview_message_id",
            "owner_account_id",
            "storyboard",
            "quality_report",
        }
        unknown = set(fields) - allowed
        if unknown:
            raise ValueError(f"Unknown job fields: {unknown}")

        values: dict[str, Any] = {"id": job_id, "updated_at": _utcnow()}
        assignments: list[str] = ["updated_at = :updated_at"]

        for key, value in fields.items():
            if key == "status" and isinstance(value, JobStatus):
                value = value.value
            if key == "sources":
                value = json.dumps(
                    [asdict(s) if isinstance(s, JobSource) else s for s in value]
                )
            if key in {"storyboard", "quality_report"}:
                value = json.dumps(value, ensure_ascii=False) if value is not None else None
            values[key] = value
            assignments.append(f"{key} = :{key}")

        with self._connect() as conn:
            conn.execute(
                f"UPDATE jobs SET {', '.join(assignments)} WHERE id = :id",
                values,
            )

        job = self.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        return job

    def save_storyboard(
        self, job_id: str, storyboard: dict, *, expected_updated_at: str,
        allowed_statuses: tuple[JobStatus, ...] = (JobStatus.SCRIPT_REVIEW,),
        status: JobStatus = JobStatus.SCRIPT_REVIEW,
    ) -> Job:
        """Compare and save in one statement, including the render state transition."""
        placeholders = ",".join("?" for _ in allowed_statuses)
        with self._connect() as conn:
            cursor = conn.execute(
                f"UPDATE jobs SET storyboard = ?, title = ?, caption = ?, status = ?, "
                f"error = NULL, quality_report = NULL, updated_at = ? "
                f"WHERE id = ? AND updated_at = ? AND status IN ({placeholders})",
                (json.dumps(storyboard, ensure_ascii=False), storyboard["title"],
                 storyboard["caption"], status.value, _utcnow(), job_id,
                 expected_updated_at, *(value.value for value in allowed_statuses)),
            )
            if cursor.rowcount != 1:
                raise ValueError("This campaign changed. Reload the latest script before continuing.")
        job = self.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        return job

    def claim_draft_retry(self, job_id: str, *, expected_updated_at: str) -> Job:
        """Reserve a failed script draft once without starting a video job."""
        with self._connect() as conn:
            cursor = conn.execute(
                "UPDATE jobs SET status = ?, error = NULL, updated_at = ? "
                "WHERE id = ? AND updated_at = ? AND status = ? AND storyboard IS NULL",
                (JobStatus.COLLECTING.value, _utcnow(), job_id, expected_updated_at, JobStatus.FAILED.value),
            )
            if cursor.rowcount != 1:
                raise ValueError("This draft changed. Reload it before retrying.")
        job = self.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        return job

    def add_source(self, job_id: str, source: JobSource) -> Job:
        job = self.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        sources = list(job.sources) + [source]
        return self.update(job_id, sources=sources)
