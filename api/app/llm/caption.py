"""LLM helper — Gemini invents the campaign, caption, steering, and NotebookLM source."""

from __future__ import annotations

import json
import logging
import re
import threading
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.config import Settings
from app.jobs.store import JobSource

logger = logging.getLogger(__name__)

_key_lock = threading.Lock()
_active_key_index = 0

ALLOWED_VIDEO_FORMATS = {"short", "brief", "explainer", "cinematic"}


@dataclass
class CaptionPackage:
    brief: str
    title: str
    caption: str
    steering_prompt: str
    source_text: str
    video_format: str = "short"


SYSTEM_PROMPT = """You are a marketing creative director for short-form vertical social video (TikTok / Reels).

You receive an optional brief, optional predefined template, and optional sources (URLs / notes).
Use them when present. If the brief is empty or says auto, invent the campaign yourself.

Return ONLY valid JSON with:
- brief: 1-3 sentence campaign brief (refine the user brief or invent one)
- title: short social video title (<= 80 chars)
- caption: punchy social caption with a hook, 1-2 short paragraphs, optional hashtags
- steering_prompt: instructions for NotebookLM Video Overview. ALWAYS ask for a SHORT vertical mobile video (TikTok/Reels frame, portrait 9:16, fast pacing, under ~60 seconds, hook in first 3 seconds). Never ask for a long desktop explainer.
- source_text: a self-contained 350-700 word marketing script / talking-points document for NotebookLM. Fold in facts from any provided sources. Include product angle, offer, audience, key lines, CTA.
- video_format: always "short"

Be concrete. Return ONLY JSON. No markdown fences."""


def _fallback_package(hint: str, video_format: str) -> CaptionPackage:
    seed = (hint or "").strip() or "weekend local caffe latte promo"
    title = "Weekend Latte Lift — 20% Off"[:80]
    brief = (
        f"Auto campaign: punchy short-form promo inspired by “{seed[:120]}”. "
        "Local cafe weekend offer, vertical TikTok energy."
    )
    caption = (
        "Your weekend just got better. ☕✨ Swing by for 20% off every latte this weekend only.\n\n"
        "Tag your coffee date.\n\n#Coffee #WeekendVibes #LocalCafe"
    )
    steering = (
        "Create a short vertical TikTok-style video (portrait mobile frame). "
        "Hook in the first 3 seconds. Fast cuts, under 60 seconds. "
        "Focus on a weekend latte discount promo."
    )
    source_text = (
        "CAMPAIGN: Weekend Latte Lift\n"
        "OFFER: 20% off all lattes this weekend only.\n"
        "AUDIENCE: Local coffee lovers, students, remote workers.\n"
        "HOOK: “Your weekend plans just got caffeinated.”\n"
        "BEATS: (1) cold open with steam / pour shot energy, (2) flash the 20% off, "
        "(3) show iced + hot options, (4) CTA to visit this weekend.\n"
        "TONE: warm, local, urgent but friendly.\n"
        "CTA: Come in this weekend — tell a friend.\n"
        f"SEED HINT: {seed[:200]}"
    )
    fmt = video_format if video_format in ALLOWED_VIDEO_FORMATS else "short"
    return CaptionPackage(
        brief=brief,
        title=title,
        caption=caption,
        steering_prompt=steering,
        source_text=source_text,
        video_format=fmt,
    )


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _is_rotatable_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    markers = (
        "429",
        "resource_exhausted",
        "quota",
        "rate limit",
        "rate_limit",
        "too many requests",
        "api key not valid",
        "api_key_invalid",
        "permission_denied",
        "403",
    )
    return any(marker in text for marker in markers)


def _mask_key(key: str) -> str:
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}…{key[-4:]}"


def _generate_with_key(
    *,
    api_key: str,
    model: str,
    user_prompt: str,
) -> str:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.95,
            response_mime_type="application/json",
        ),
    )
    return (response.text or "").strip()


def _sources_blob(sources: list[JobSource]) -> str:
    if not sources:
        return "(no extra sources — invent solid talking points yourself)"
    lines: list[str] = []
    for src in sources:
        label = src.title or src.kind
        snippet = src.value[:800]
        lines.append(f"- [{label}] {snippet}")
    return "\n".join(lines)


def draft_caption_package(
    settings: Settings,
    brief: str = "",
    sources: list[JobSource] | None = None,
) -> CaptionPackage:
    """Draft campaign + caption + NotebookLM source text via Gemini."""
    global _active_key_index

    sources = sources or []
    default_format = (
        settings.video_format
        if settings.video_format in ALLOWED_VIDEO_FORMATS
        else "short"
    )
    if default_format == "explainer":
        default_format = "short"

    keys = settings.gemini_api_keys
    hint = (brief or "").strip()

    if not keys:
        logger.warning("No Gemini API keys configured; using fallback campaign package")
        return _fallback_package(hint, default_format)

    user_prompt = (
        "Create a short-form vertical marketing campaign package.\n"
        f"Preferred video_format: {default_format}\n"
        "Output must be optimized for a short vertical TikTok/Reels-style video.\n\n"
        f"Brief:\n{hint or '(empty — invent the campaign)'}\n\n"
        f"Sources / template / notes:\n{_sources_blob(sources)}\n"
    )

    last_error: BaseException | None = None
    with _key_lock:
        start = _active_key_index % len(keys)

    for offset in range(len(keys)):
        idx = (start + offset) % len(keys)
        api_key = keys[idx]
        try:
            content = _generate_with_key(
                api_key=api_key,
                model=settings.gemini_model,
                user_prompt=user_prompt,
            )
            data = _parse_json(content)
            fmt = str(data.get("video_format") or default_format).lower()
            if fmt not in ALLOWED_VIDEO_FORMATS:
                fmt = default_format
            if settings.video_format in {"short", "brief"} or not settings.video_format:
                fmt = "short"

            with _key_lock:
                _active_key_index = idx

            if offset > 0:
                logger.info(
                    "Gemini key rotated successfully to %s (index %s)",
                    _mask_key(api_key),
                    idx,
                )

            invented_brief = str(data.get("brief") or hint or "Auto marketing campaign").strip()
            title = str(data.get("title") or invented_brief[:80]).strip()[:80]
            caption = str(data.get("caption") or invented_brief).strip()
            source_text = str(data.get("source_text") or "").strip()
            if len(source_text) < 120:
                source_text = (
                    f"Campaign brief:\n{invented_brief}\n\n"
                    f"Social title: {title}\n\n"
                    f"Caption draft:\n{caption}\n"
                )

            steering = str(data.get("steering_prompt") or invented_brief).strip()
            if "vertical" not in steering.lower() and "tiktok" not in steering.lower():
                steering = (
                    "Make a short vertical TikTok/Reels-style video (portrait mobile frame), "
                    "fast pacing, hook in 3 seconds. " + steering
                )

            return CaptionPackage(
                brief=invented_brief,
                title=title,
                caption=caption,
                steering_prompt=steering,
                source_text=source_text,
                video_format=fmt,
            )
        except Exception as exc:
            last_error = exc
            if _is_rotatable_error(exc) and offset < len(keys) - 1:
                logger.warning(
                    "Gemini key %s failed (%s); trying next key",
                    _mask_key(api_key),
                    exc,
                )
                continue
            logger.exception(
                "Gemini campaign drafting failed with key %s",
                _mask_key(api_key),
            )
            break

    logger.error("All Gemini keys failed; last error: %s", last_error)
    return _fallback_package(hint, default_format)
