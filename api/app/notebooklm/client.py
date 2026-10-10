"""NotebookLM video generation via notebooklm-py."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from urllib.parse import urlparse

from notebooklm import NotebookLMClient, VideoFormat, VideoStyle

from app.config import Settings
from app.jobs.store import JobSource

logger = logging.getLogger(__name__)

YOUTUBE_RE = re.compile(r"(youtube\.com|youtu\.be)", re.IGNORECASE)


class NotebookLMAuthError(RuntimeError):
    """Raised when NotebookLM cookies are missing or expired."""


def check_auth() -> bool:
    try:
        storage = Path.home() / ".notebooklm" / "profiles" / "default" / "storage_state.json"
        return storage.exists() and storage.stat().st_size > 100
    except Exception:
        return False


async def interactive_login() -> None:
    raise NotebookLMAuthError(
        "Authenticate with: notebooklm login --browser chrome\n"
        "Or import cookies: notebooklm login --browser-cookies chrome"
    )


def _is_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def _video_format(name: str) -> VideoFormat:
    key = (name or "explainer").strip().upper()
    mapping = {
        "EXPLAINER": VideoFormat.EXPLAINER,
        "BRIEF": VideoFormat.BRIEF,
        "CINEMATIC": VideoFormat.CINEMATIC,
        "SHORT": VideoFormat.SHORT,
    }
    return mapping.get(key, VideoFormat.SHORT)


def _video_style(name: str) -> VideoStyle:
    key = (name or "auto_select").strip().upper()
    mapping = {
        "AUTO_SELECT": VideoStyle.AUTO_SELECT,
        "CUSTOM": VideoStyle.CUSTOM,
        "CLASSIC": VideoStyle.CLASSIC,
        "WHITEBOARD": VideoStyle.WHITEBOARD,
        "KAWAII": VideoStyle.KAWAII,
        "ANIME": VideoStyle.ANIME,
        "WATERCOLOR": VideoStyle.WATERCOLOR,
        "RETRO_PRINT": VideoStyle.RETRO_PRINT,
        "HERITAGE": VideoStyle.HERITAGE,
        "PAPER_CRAFT": VideoStyle.PAPER_CRAFT,
    }
    return mapping.get(key, VideoStyle.AUTO_SELECT)


async def generate_video_overview(
    settings: Settings,
    *,
    job_id: str,
    brief: str,
    sources: list[JobSource],
    steering_prompt: str,
    video_format: str,
    progress_callback=None,
) -> tuple[str, str, Path]:
    """
    Create a NotebookLM notebook, add sources, generate a Video Overview, download MP4.

    Returns (notebook_id, artifact_id, video_path).
    """
    if not check_auth():
        raise NotebookLMAuthError(
            "NotebookLM is not authenticated. Run:\n"
            "  notebooklm login --browser-cookies chrome\n"
            "or: notebooklm login --browser chrome"
        )

    notebook_name = f"Marketing Agent {job_id[:8]}"
    fmt = _video_format(video_format or settings.video_format)
    style = _video_style(settings.video_style)
    timeout = float(settings.video_timeout_minutes * 60)

    async with NotebookLMClient.from_storage() as client:
        if progress_callback:
            await progress_callback("Creating NotebookLM notebook…")

        notebook = await client.notebooks.create(notebook_name)
        notebook_id = notebook.id
        source_ids: list[str] = []

        brief_source = await client.sources.add_text(
            notebook_id,
            "Marketing brief",
            brief,
            wait=True,
            wait_timeout=180,
        )
        source_ids.append(brief_source.id)

        for src in sources:
            try:
                if src.kind == "url" and _is_url(src.value):
                    if YOUTUBE_RE.search(src.value):
                        created = await client.sources.add_url(notebook_id, src.value)
                    else:
                        created = await client.sources.add_url(notebook_id, src.value)
                    ready = await client.sources.wait_until_ready(
                        notebook_id, created.id, timeout=180
                    )
                    source_ids.append(ready.id)
                elif src.kind in {"text", "file"}:
                    title = (src.title or "Source")[:120]
                    created = await client.sources.add_text(
                        notebook_id,
                        title,
                        src.value,
                        wait=True,
                        wait_timeout=180,
                    )
                    source_ids.append(created.id)
                else:
                    logger.warning("Skipping unsupported source: %s", src)
            except Exception:
                logger.exception("Failed to add source %s", src)
                if progress_callback:
                    await progress_callback(f"Warning: could not add source ({src.kind})")

        if len(source_ids) < 1:
            raise RuntimeError("No sources available for NotebookLM video generation")

        # Always prefer short-form unless env explicitly asks for another format.
        if (settings.video_format or "short").lower() in {"short", "brief", ""}:
            fmt = VideoFormat.SHORT

        instructions = steering_prompt or ""
        if "vertical" not in instructions.lower() and "tiktok" not in instructions.lower():
            instructions = (
                "Create a short vertical TikTok/Reels-style video in a portrait mobile frame. "
                "Fast pacing, hook in the first 3 seconds, keep it brief. "
                + instructions
            ).strip()

        if progress_callback:
            await progress_callback(
                "Starting NotebookLM Short video (TikTok-style — can take several minutes)…"
            )

        status = await client.artifacts.generate_video(
            notebook_id,
            source_ids=source_ids,
            language=settings.video_language,
            instructions=instructions or None,
            video_format=fmt,
            video_style=style,
        )
        task_id = status.task_id

        last_status = {"value": None}

        def _on_status(gen_status) -> None:
            last_status["value"] = gen_status.status

        if progress_callback:
            await progress_callback(f"Video task started ({task_id[:8]}…) — waiting…")

        completed = await client.artifacts.wait_for_completion(
            notebook_id,
            task_id,
            timeout=timeout,
            initial_interval=float(max(10, settings.video_poll_interval_seconds)),
            max_interval=45.0,
            on_status_change=_on_status,
        )
        if completed.status != "completed":
            raise RuntimeError(
                f"NotebookLM video generation ended with status={completed.status} "
                f"error={completed.error}"
            )

        artifact_id = completed.task_id
        # Prefer concrete artifact id from listing when available.
        try:
            videos = await client.artifacts.list_video(notebook_id)
            if videos:
                artifact_id = getattr(videos[0], "id", None) or artifact_id
        except Exception:
            logger.exception("Could not list video artifacts; using task id")

        if progress_callback:
            await progress_callback("Downloading video…")

        dest = settings.videos_dir / f"{job_id}.mp4"
        await client.artifacts.download_video(
            notebook_id,
            str(dest),
            artifact_id=artifact_id if artifact_id != task_id else None,
        )
        if not dest.exists() or dest.stat().st_size < 1000:
            raise RuntimeError(f"Downloaded video missing or too small: {dest}")

        return notebook_id, str(artifact_id), dest
