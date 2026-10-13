"""NotebookLM video generation via notebooklm-py."""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from urllib.parse import urlparse

from notebooklm import NotebookLMClient, VideoFormat, VideoStyle
from notebooklm.exceptions import ArtifactDownloadError

from app.config import Settings
from app.jobs.store import JobSource
from app.uploads import build_brand_assets_pdf

logger = logging.getLogger(__name__)

YOUTUBE_RE = re.compile(r"(youtube\.com|youtu\.be)", re.IGNORECASE)
_PLACEHOLDER_HOSTS = frozenset({
    "example.com",
    "example.org",
    "example.net",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
})


class NotebookLMAuthError(RuntimeError):
    """Raised when NotebookLM cookies are missing or expired."""


def _is_placeholder_url(value: str) -> bool:
    """Demo / fake hosts that NotebookLM cannot crawl."""
    try:
        host = (urlparse(value).hostname or "").lower().rstrip(".")
    except Exception:
        return False
    if not host:
        return False
    if host.startswith("www."):
        host = host[4:]
    return host in _PLACEHOLDER_HOSTS or host.endswith(".example.com")


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


def _khmer_caption_instructions(*, title: str, caption: str) -> str:
    """NotebookLM has no native `km` video language — force burned-in Khmer captions."""
    _ = (title, caption)  # social title/caption must not become name pills or English bars
    lines = [
        "CRITICAL CAPTION RULES FOR KHMER:",
        "- Show large burned-in Khmer captions / subtitles on screen for the entire video.",
        "- Every spoken line must also appear as Khmer on-screen text (subtitles in Khmer script).",
        "- Do not leave the video without readable Khmer text overlays.",
        "- Prefer short phrases, high contrast, TikTok-style captions.",
        "- Do NOT burn English captions, business-name pills, or dark rounded title chips.",
        "- Do NOT use the social post caption or English title as an on-screen name pill.",
    ]
    lines.append(
        "Make the video in Khmer language with visible Khmer captions throughout."
    )
    return "\n".join(lines)


async def generate_video_overview(
    settings: Settings,
    *,
    job_id: str,
    brief: str,
    sources: list[JobSource],
    steering_prompt: str,
    video_format: str,
    language: str | None = None,
    title: str | None = None,
    caption: str | None = None,
    narration_script: str | None = None,
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

    notebook_name = f"Rachana AI {job_id[:8]}"
    language = (language or settings.video_language or "en").strip()
    language_name = {"en": "English", "km": "Khmer (ខ្មែរ)"}.get(language, language)
    fmt = _video_format(video_format or settings.video_format)
    style = _video_style(settings.video_style)
    timeout = float(settings.video_timeout_minutes * 60)
    title = (title or "").strip()
    caption = (caption or "").strip()
    narration_script = (narration_script or "").strip()

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

        if narration_script:
            narration_source = await client.sources.add_text(
                notebook_id,
                "Approved spoken narration",
                (
                    f"Read these lines verbatim in {language_name}, in scene order:\n"
                    f"{narration_script}\n\n"
                    "This is the spoken script, separate from the social post caption. "
                    "Do not add extra spoken lines. Captions will be added in the editing pass."
                ),
                wait=True,
                wait_timeout=180,
            )
            source_ids.append(narration_source.id)
        elif language == "km" and (title or caption):
            caption_doc = "\n\n".join(
                part
                for part in (
                    f"TITLE:\n{title}" if title else "",
                    f"SOCIAL CAPTION / ON-SCREEN SCRIPT:\n{caption}" if caption else "",
                    "REQUIREMENT:\nShow these Khmer lines as burned-in on-screen captions "
                    "throughout the short vertical video.",
                )
                if part
            )
            caption_source = await client.sources.add_text(
                notebook_id,
                "Khmer on-screen captions",
                caption_doc,
                wait=True,
                wait_timeout=180,
            )
            source_ids.append(caption_source.id)

        file_sources = [src for src in sources if src.kind == "file"]
        failed_image_paths: list[Path] = []

        for src in sources:
            try:
                if src.kind == "url" and _is_url(src.value):
                    if _is_placeholder_url(src.value):
                        # example.com / localhost demos are not crawlable — keep as text.
                        created = await client.sources.add_text(
                            notebook_id,
                            (src.title or "Website link")[:120],
                            (
                                f"Brand website / CTA link (do not invent a different URL): "
                                f"{src.value}\n"
                                "Use this link only for on-screen CTA text if needed. "
                                "There is no real web page content to scrape."
                            ),
                            wait=True,
                            wait_timeout=180,
                        )
                        source_ids.append(created.id)
                        if progress_callback:
                            await progress_callback(
                                f"Skipped crawling placeholder URL {src.value} "
                                "(kept as a text link)."
                            )
                        continue
                    created = await client.sources.add_url(notebook_id, src.value)
                    ready = await client.sources.wait_until_ready(
                        notebook_id, created.id, timeout=180
                    )
                    source_ids.append(ready.id)
                elif src.kind == "file":
                    path = Path(src.value)
                    if not path.is_file():
                        raise FileNotFoundError(f"Brand asset missing: {path}")
                    source_title = (src.title or path.name or "Brand asset")[:120]
                    try:
                        created = await client.sources.add_file(
                            notebook_id,
                            path,
                            wait=True,
                            wait_timeout=180,
                            title=source_title,
                        )
                        source_ids.append(created.id)
                    except Exception:
                        logger.exception("Direct image upload failed for %s", path)
                        failed_image_paths.append(path)
                        if progress_callback:
                            await progress_callback(
                                f"Warning: could not upload image {path.name}; "
                                "will try PDF brand pack."
                            )
                elif src.kind == "text":
                    source_title = (src.title or "Source")[:120]
                    created = await client.sources.add_text(
                        notebook_id,
                        source_title,
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

        if failed_image_paths:
            all_brand_paths = [
                Path(src.value) for src in file_sources if Path(src.value).is_file()
            ] or failed_image_paths
            try:
                pdf_path = build_brand_assets_pdf(
                    all_brand_paths,
                    settings.uploads_dir / job_id / "brand-assets.pdf",
                )
                created = await client.sources.add_file(
                    notebook_id,
                    pdf_path,
                    wait=True,
                    wait_timeout=180,
                    title="Brand assets",
                )
                source_ids.append(created.id)
                if progress_callback:
                    await progress_callback(
                        "Uploaded brand images as a PDF pack for NotebookLM."
                    )
            except Exception:
                logger.exception("Failed to upload brand assets PDF for job %s", job_id)
                if progress_callback:
                    await progress_callback(
                        "Warning: could not add brand images to NotebookLM."
                    )

        if len(source_ids) < 1:
            raise RuntimeError("No sources available for NotebookLM video generation")

        # Always prefer short-form unless env explicitly asks for another format.
        if (settings.video_format or "short").lower() in {"short", "brief", ""}:
            fmt = VideoFormat.SHORT

        instructions = steering_prompt or ""
        if "vertical" not in instructions.lower() and "tiktok" not in instructions.lower():
            vertical_instruction = (
                "បង្កើតវីដេអូខ្លីបែប TikTok/Reels ក្នុងទម្រង់បញ្ឈរ 9:16។ "
                "កាត់ឈុតរហ័ស ទាក់ទាញអ្នកទស្សនាក្នុង 3 វិនាទីដំបូង និងរក្សាវីដេអូឱ្យខ្លី។ "
                if language == "km"
                else
                "Create a short vertical TikTok/Reels-style video in a portrait mobile frame. "
                "Fast pacing, hook in the first 3 seconds, keep it brief. "
            )
            instructions = (vertical_instruction + instructions).strip()
        if file_sources:
            asset_names = ", ".join(
                (src.title or Path(src.value).name) for src in file_sources[:5]
            )
            brand_line = (
                "Feature the uploaded brand logo and product photos on screen "
                f"({asset_names}). Use these exact assets; do not invent a different logo "
                "or substitute unrelated product imagery."
            )
            instructions = f"{instructions}\n{brand_line}".strip()
        if language == "km":
            # Khmer has no native NLM language code — burn Khmer captions in-footage.
            # Finishing no longer burns a second caption bar.
            caption_instruction = _khmer_caption_instructions(title=title, caption=caption)
            if narration_script:
                caption_instruction = (
                    "Speak the approved scene narration in order. "
                    "Do not read the social post caption aloud.\n\n"
                    + caption_instruction
                )
            instructions = (
                f"{instructions}\nប្រើភាសាខ្មែរសម្រាប់ការនិយាយ សន្ទនា "
                "និងអក្សររត់ខ្មែរនៅក្នុងវីដេអូ។ ប្រើអក្សរខ្មែរ "
                "ហើយរក្សាឈ្មោះម៉ាក និងតំណភ្ជាប់ដើមតាមការចាំបាច់។\n"
                "CRITICAL: Do NOT burn English captions, business-name pills, or dark title chips. "
                "Khmer captions only — no opening brand-name pill.\n\n"
                f"{caption_instruction}"
            ).strip()
        else:
            instructions = (
                f"{instructions}\nOutput language: {language_name} ({language}). "
                f"Use {language_name} for spoken narration / voiceover only. "
                "CRITICAL: produce CLEAN footage with ZERO on-screen text. "
                "Do NOT burn captions, subtitles, titles, headings, lower-thirds, text boxes, "
                "brown/black caption bars, or business-name pills "
                "(no dark rounded chips/labels with the brand name or spoken phrases). "
                "The voiceover speaks the script; the picture stays text-free."
            ).strip()

        if progress_callback:
            await progress_callback(
                f"Requesting NotebookLM Short video in {language_name} "
                "(TikTok-style — can take several minutes)…"
            )

        status = await client.artifacts.generate_video(
            notebook_id,
            source_ids=source_ids,
            # Khmer output is guided by its script and final prompt instruction.
            language="en" if language == "km" else language,
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
        download_artifact = artifact_id if artifact_id != task_id else None
        last_download_error: BaseException | None = None
        # Google CDN (lh3.googleusercontent.com) often ConnectTimeouts on first try.
        for attempt in range(1, 4):
            try:
                await client.artifacts.download_video(
                    notebook_id,
                    str(dest),
                    artifact_id=download_artifact,
                )
                last_download_error = None
                break
            except Exception as exc:
                transient = isinstance(exc, (ArtifactDownloadError, TimeoutError, OSError))
                name = type(exc).__name__
                transient = transient or ("Timeout" in name) or ("Network" in name)
                if not transient:
                    raise
                last_download_error = exc
                logger.warning(
                    "NotebookLM video download attempt %s/3 failed for job %s: %s",
                    attempt,
                    job_id,
                    exc,
                )
                if progress_callback and attempt < 3:
                    await progress_callback(
                        f"Download timed out — retrying ({attempt}/3)…"
                    )
                if attempt < 3:
                    await asyncio.sleep(2 * attempt)
        if last_download_error is not None:
            raise last_download_error
        if not dest.exists() or dest.stat().st_size < 1000:
            raise RuntimeError(f"Downloaded video missing or too small: {dest}")

        return notebook_id, str(artifact_id), dest
