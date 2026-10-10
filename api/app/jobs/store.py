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
    created_at: str = field(default_factory=lambda: _utcnow())
    updated_at: str = field(default_factory=lambda: _utcnow())

    def to_row(self) -> dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        data["sources"] = json.dumps([asdict(s) for s in self.sources])
        return data

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Job":
        sources_raw = json.loads(row["sources"] or "[]")
        return cls(
            id=row["id"],
            chat_id=row["chat_id"],
            user_id=row["user_id"],
            brief=row["brief"],
            status=JobStatus(row["status"]),
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
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
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
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def create_job(
        self,
        *,
        chat_id: int,
        user_id: int,
        brief: str,
        sources: list[JobSource] | None = None,
        status: JobStatus = JobStatus.COLLECTING,
    ) -> Job:
        job = Job(
            id=str(uuid.uuid4()),
            chat_id=chat_id,
            user_id=user_id,
            brief=brief.strip(),
            status=status,
            sources=sources or [],
        )
        with self._connect() as conn:
            row = job.to_row()
            conn.execute(
                """
                INSERT INTO jobs (
                    id, chat_id, user_id, brief, status, sources, caption, title,
                    steering_prompt, video_format, video_path, notebook_id, artifact_id,
                    facebook_post_id, facebook_post_url, error,
                    telegram_preview_message_id, created_at, updated_at
                ) VALUES (
                    :id, :chat_id, :user_id, :brief, :status, :sources, :caption, :title,
                    :steering_prompt, :video_format, :video_path, :notebook_id, :artifact_id,
                    :facebook_post_id, :facebook_post_url, :error,
                    :telegram_preview_message_id, :created_at, :updated_at
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

    def add_source(self, job_id: str, source: JobSource) -> Job:
        job = self.get(job_id)
        if not job:
            raise KeyError(f"Job not found: {job_id}")
        sources = list(job.sources) + [source]
        return self.update(job_id, sources=sources)
