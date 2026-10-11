"""LLM helper — Gemini invents the campaign, caption, steering, and NotebookLM source."""

from __future__ import annotations

import json
import logging
import re
import threading
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types

from app.config import Settings
from app.jobs.store import JobSource

logger = logging.getLogger(__name__)

_key_lock = threading.Lock()
_active_key_index = 0

ALLOWED_VIDEO_FORMATS = {"short", "brief", "explainer", "cinematic"}
GUIDED_CAMPAIGN_HEADINGS = (
    "BUSINESS CAMPAIGN BRIEF",
    'សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម',
)
GUIDED_TEMPERATURE = 0.55
AUTO_TEMPERATURE = 0.9

# Promotional claim detectors. Avoid bare "off"/"free" — those false-positive on
# natural phrases like "off the busy street" or "feel free to message".
_CLAIM_PATTERNS = (
    re.compile(r"\d+\s*%"),
    re.compile(r"\$\s*\d+", re.I),
    re.compile(r"\b(?:discount|sale)\b", re.I),
    re.compile(r"\b(?:buy\s+one|bogo|limited[- ]time)\b", re.I),
    re.compile(r"\b\d+\s*%\s*off\b", re.I),
    re.compile(r"\boff\s+(?:today|now|this|your|our|all|every)\b", re.I),
    re.compile(
        r"(?<!feel )(?<!set )\bfree\s+(?:coffee|drink|pastry|gift|trial|shipping|"
        r"entry|wifi|wi-?fi|delivery|dessert|cookie|muffin|sample|refill)\b",
        re.I,
    ),
)

GUIDED_SYSTEM_PROMPT = """You are a marketing creative director for short-form vertical social video (TikTok / Reels).

MODE: GUIDED — the user supplied a real business brief.
- Use ONLY supplied business facts. Never invent prices, discounts, deadlines, addresses, testimonials, or product claims.
- Preserve the supplied business name, audience, benefit, offer, timing, and selected customer action.
- If no offer is supplied, promote the stated customer benefit without making up a special offer.
- Templates are creative inspiration only; they must not override supplied facts or the selected customer action.
- A BUSINESS CAMPAIGN BRIEF (or its Khmer equivalent) always describes a real user business and must never be replaced by an invented campaign.
- Follow the requested output language. Keep JSON keys in English.

Return ONLY valid JSON with:
- brief: 1-3 sentence campaign brief that refines the user's facts (do not invent a new business)
- title: short social video title (<= 60 chars)
- caption: punchy social caption with a hook, <= 220 chars preferred, optional hashtags. No invented offers.
- steering_prompt: ONE short paragraph for NotebookLM. Must include: short vertical 9:16 TikTok/Reels, under 60 seconds, hook in first 3 seconds, required narration language, exact CTA, and "do not invent offers or prices".
- source_text: a compact SHOT LIST (max ~350 words), not an essay. Use exactly these headings:
  HOOK (0-3s):
  BEAT 1:
  BEAT 2:
  BEAT 3:
  OFFER/BENEFIT: (only facts supplied; if none, state the customer benefit)
  CTA:
  ON-SCREEN TEXT:
  MUST SAY:
  MUST NOT INVENT:
- video_format: always "short"

Be concrete. Return ONLY JSON. No markdown fences."""

AUTO_SYSTEM_PROMPT = """You are a marketing creative director for short-form vertical social video (TikTok / Reels).

MODE: AUTO — invent a fresh campaign when the brief is empty or asks for full auto.
- Invent a concrete local-business style campaign with a clear offer, audience, and CTA.
- Still prefer any facts the user did supply.
- Follow the requested output language. Keep JSON keys in English.

Return ONLY valid JSON with:
- brief: 1-3 sentence campaign brief
- title: short social video title (<= 60 chars)
- caption: punchy social caption with a hook, <= 220 chars preferred, optional hashtags
- steering_prompt: ONE short paragraph for NotebookLM. Must include: short vertical 9:16 TikTok/Reels, under 60 seconds, hook in first 3 seconds, required narration language, and CTA.
- source_text: a compact SHOT LIST (max ~350 words) with headings:
  HOOK (0-3s):
  BEAT 1:
  BEAT 2:
  BEAT 3:
  OFFER/BENEFIT:
  CTA:
  ON-SCREEN TEXT:
  MUST SAY:
- video_format: always "short"

Be concrete. Return ONLY JSON. No markdown fences."""

SYSTEM_PROMPT = GUIDED_SYSTEM_PROMPT


@dataclass
class CaptionPackage:
    brief: str
    title: str
    caption: str
    steering_prompt: str
    source_text: str
    video_format: str = "short"


def _video_language_instruction(language: str) -> str:
    if language == "km":
        return (
            'កាត់ឈុតរហ័ស ទាក់ទាញអ្នកទស្សនាក្នុង 3 វិនាទីដំបូង និងរក្សាវីដេអូឱ្យខ្លី។ '
            + " "
            + 'ប្រើភាសាខ្មែរសម្រាប់ការនិយាយ សន្ទនា ចំណងជើង អក្សររត់ '
            + " "
            + 'និងអត្ថបទទាំងអស់ក្នុងវីដេអូ។ ប្រើអក្សរខ្មែរ '
            + "\n\nMake the video in Khmer language."
        )
    name = {"en": "English", "km": "Khmer (" + 'ខ្មែរ' + ")"}.get(language, language)
    return (
        f"Output language: {name} ({language}). "
        f"Narration and all on-screen text must be in {name}. "
        "Preserve brand names and URLs."
    )


def _fallback_package(hint: str, video_format: str, language: str = "en") -> CaptionPackage:
    if _is_guided_campaign(hint):
        raise ValueError(
            "We could not generate your business campaign. Please try again. "
            "Your saved business details have not changed."
        )
    seed = (hint or "").strip() or "weekend local caffe latte promo"
    title = "Weekend Latte Lift — 20% Off"[:60]
    brief = (
        f"Auto campaign: punchy short-form promo inspired by “{seed[:120]}”. "
        "Local cafe weekend offer, vertical TikTok energy."
    )
    caption = (
        "Your weekend just got better. Swing by for 20% off every latte this weekend only. "
        "#Coffee #WeekendVibes #LocalCafe"
    )
    steering = (
        "Create a short vertical TikTok-style video (portrait 9:16). "
        "Hook in the first 3 seconds. Fast cuts, under 60 seconds. "
        "Focus on a weekend latte discount promo."
    )
    source_text = (
        "HOOK (0-3s): Steam pour + weekend energy\n"
        "BEAT 1: Show iced and hot lattes\n"
        "BEAT 2: Flash 20% off this weekend only\n"
        "BEAT 3: Friendly barista / cozy shop vibe\n"
        "OFFER/BENEFIT: 20% off all lattes this weekend\n"
        "CTA: Come in this weekend — tell a friend\n"
        "ON-SCREEN TEXT: 20% OFF LATTES · THIS WEEKEND\n"
        "MUST SAY: Weekend latte deal, visit today\n"
        f"SEED HINT: {seed[:200]}"
    )
    if language == "km":
        title = 'កាហ្វេឡាតេពិសេសចុងសប្តាហ៍'
        brief = 'យុទ្ធនាការវីដេអូខ្លីសម្រាប់ហាងកាហ្វេក្នុងតំបន់។ ផ្សព្វផ្សាយការផ្តល់ជូននៅចុងសប្តាហ៍នេះជាភាសាខ្មែរ។'
        caption = 'ចុងសប្តាហ៍នេះ កាន់តែរីករាយជាមួយកាហ្វេ! មកហាងឥឡូវនេះ។ #កាហ្វេ #ចុងសប្តាហ៍'
        source_text = (
            "HOOK (0-3s): "
            + 'បង្ហាញការចាក់កាហ្វេ'
            + "\nBEAT 1: "
            + 'បង្ហាញការផ្តល់ជូន'
            + "\nBEAT 2: "
            + 'បង្ហាញភេសជ្ជៈ'
            + "\nBEAT 3: "
            + 'អញ្ជើញមកហាង'
            + "\nOFFER/BENEFIT: "
            + 'ការផ្តល់ជូនចុងសប្តាហ៍'
            + "\nCTA: "
            + 'មកហាងនៅចុងសប្តាហ៍នេះ'
            + f"\nON-SCREEN TEXT: {title}\nMUST SAY: {title}"
        )
        steering = 'Khmer (ខ្មែរ)' + " " + 'បង្កើតវីដេអូខ្លីបែប TikTok/Reels ក្នុងទម្រង់បញ្ឈរ 9:16។ '
    steering = f"{steering} {_video_language_instruction(language)}"
    fmt = video_format if video_format in ALLOWED_VIDEO_FORMATS else "short"
    return CaptionPackage(
        brief=brief,
        title=title,
        caption=caption,
        steering_prompt=steering,
        source_text=source_text,
        video_format=fmt,
    )


def _is_guided_campaign(brief: str) -> bool:
    return (brief or "").lstrip().startswith(GUIDED_CAMPAIGN_HEADINGS)


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


def _normalize_blob(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _invented_claim_matches(text: str, allowed_blob: str) -> list[str]:
    allowed = _normalize_blob(allowed_blob)
    found: list[str] = []
    for pattern in _CLAIM_PATTERNS:
        for match in pattern.finditer(text or ""):
            snippet = match.group(0)
            if _normalize_blob(snippet) not in allowed:
                found.append(snippet)
    return found


def _assert_no_invented_claims(
    *,
    guided: bool,
    brief: str,
    sources_blob: str,
    title: str,
    caption: str,
    source_text: str,
) -> None:
    if not guided:
        return
    allowed = f"{brief}\n{sources_blob}"
    no_offer = bool(re.search(r"no special offer|" + 'មិនមានការផ្ដល់ជូនពិសេស', brief, re.I))
    combined = f"{title}\n{caption}\n{source_text}"
    invented = _invented_claim_matches(combined, allowed)
    if no_offer:
        invented = list({*invented, *_invented_claim_matches(combined, "")})
    if invented:
        raise ValueError(
            "Business campaign generation invented offers or prices that were not supplied. "
            "Please try again."
        )


def _ensure_shot_list(
    source_text: str, *, language: str, brief: str, title: str, caption: str
) -> str:
    text = (source_text or "").strip()
    required = ("HOOK", "BEAT 1", "CTA")
    if text and all(key in text.upper() for key in required) and len(text) >= 80:
        return text[:3500]
    if language == "km":
        return (
            f"HOOK (0-3s): {title}\n"
            f"BEAT 1: {brief[:180]}\n"
            f"BEAT 2: {caption[:180]}\n"
            "BEAT 3: "
            + 'បង្ហាញអត្ថប្រយោជន៍ និងការអំពាវនាវ'
            + "\n"
            + f"OFFER/BENEFIT: {brief[:200]}\n"
            + f"CTA: {caption[:120]}\n"
            + f"ON-SCREEN TEXT: {title}\n"
            + f"MUST SAY: {title}\n"
            + "MUST NOT INVENT: "
            + 'តម្លៃ ឬការផ្ដល់ជូនដែលមិនបានផ្ដល់'
        )
    return (
        f"HOOK (0-3s): {title}\n"
        f"BEAT 1: {brief[:180]}\n"
        f"BEAT 2: {caption[:180]}\n"
        "BEAT 3: Show the main benefit and end on the CTA\n"
        f"OFFER/BENEFIT: {brief[:200]}\n"
        f"CTA: {caption[:120]}\n"
        f"ON-SCREEN TEXT: {title}\n"
        f"MUST SAY: {title}\n"
        "MUST NOT INVENT: prices, discounts, or offers not supplied by the user"
    )


def _build_user_prompt(
    *,
    guided: bool,
    language: str,
    language_name: str,
    default_format: str,
    hint: str,
    sources_blob: str,
) -> str:
    mode = (
        "GUIDED (real business — do not invent facts)"
        if guided
        else "AUTO (invent a fresh campaign if needed)"
    )
    prompt = (
        "Create a short-form vertical marketing campaign package.\n"
        f"Mode: {mode}\n"
        f"Required output language: {language_name} ({language}).\n"
        f"Write brief, title, caption, steering_prompt, and source_text in {language_name}, "
        "even if the supplied brief, template, or sources are in a different language.\n"
        "Use native script rather than transliteration. Proper brand names and URLs may stay unchanged.\n"
        "Keep JSON keys in English. "
        f"The steering_prompt must require narration and all on-screen text in {language_name}.\n"
        f"Preferred video_format: {default_format}\n"
        "Output must be optimized for a short vertical TikTok/Reels-style video.\n\n"
        f"Brief:\n{hint or '(empty — invent the campaign)'}\n\n"
        f"Sources / template / notes:\n{sources_blob}\n"
    )
    if language == "km":
        prompt += "\nMake the video in Khmer language."
    return prompt


def _generate_with_key(
    *,
    api_key: str,
    model: str,
    user_prompt: str,
    system_instruction: str,
    temperature: float,
) -> str:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
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
        if src.kind == "file":
            name = Path(src.value).name if src.value else "brand-asset"
            lines.append(
                f"- [{label}] Brand image file: {name}. "
                "Feature this logo/product photo in the video; do not invent a different logo."
            )
            continue
        snippet = src.value[:4000 if src.kind == "text" else 800]
        lines.append(f"- [{label}] {snippet}")
    return "\n".join(lines)


def draft_caption_package(
    settings: Settings,
    brief: str = "",
    sources: list[JobSource] | None = None,
    *,
    language: str | None = None,
) -> CaptionPackage:
    """Draft campaign + caption + NotebookLM source text via Gemini."""
    global _active_key_index

    sources = sources or []
    language = (language or settings.video_language or "en").strip()
    language_name = {"en": "English", "km": "Khmer (" + 'ខ្មែរ' + ")"}.get(
        language, language
    )
    default_format = (
        settings.video_format
        if settings.video_format in ALLOWED_VIDEO_FORMATS
        else "short"
    )
    if default_format == "explainer":
        default_format = "short"

    keys = settings.gemini_api_keys
    hint = (brief or "").strip()
    guided_campaign = _is_guided_campaign(hint)
    system_instruction = GUIDED_SYSTEM_PROMPT if guided_campaign else AUTO_SYSTEM_PROMPT
    temperature = GUIDED_TEMPERATURE if guided_campaign else AUTO_TEMPERATURE
    sources_blob = _sources_blob(sources)

    if not keys:
        logger.warning("No Gemini API keys configured; using fallback campaign package")
        return _fallback_package(hint, default_format, language)

    user_prompt = _build_user_prompt(
        guided=guided_campaign,
        language=language,
        language_name=language_name,
        default_format=default_format,
        hint=hint,
        sources_blob=sources_blob,
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
                system_instruction=system_instruction,
                temperature=temperature,
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

            if guided_campaign and any(
                not str(data.get(field) or "").strip()
                for field in ("brief", "title", "caption", "steering_prompt", "source_text")
            ):
                raise ValueError(
                    "Business campaign generation was incomplete. Please try again."
                )
            default_brief = hint or "Auto marketing campaign"
            if language == "km" and not guided_campaign:
                default_brief = _fallback_package(hint, default_format, language).brief
            invented_brief = str(data.get("brief") or "").strip() or default_brief
            title = (str(data.get("title") or "").strip() or invented_brief[:60])[:60]
            caption = str(data.get("caption") or "").strip() or invented_brief
            source_text = _ensure_shot_list(
                str(data.get("source_text") or "").strip(),
                language=language,
                brief=invented_brief,
                title=title,
                caption=caption,
            )

            _assert_no_invented_claims(
                guided=guided_campaign,
                brief=hint,
                sources_blob=sources_blob,
                title=title,
                caption=caption,
                source_text=source_text,
            )

            steering = str(data.get("steering_prompt") or invented_brief).strip()
            if "vertical" not in steering.lower() and "tiktok" not in steering.lower():
                if language == "km":
                    steering = 'Khmer (ខ្មែរ)' + " " + 'បង្កើតវីដេអូខ្លីបែប TikTok/Reels ក្នុងទម្រង់បញ្ឈរ 9:16។ ' + " " + steering
                else:
                    steering = (
                        "Make a short vertical TikTok/Reels-style video (portrait 9:16), "
                        "fast pacing, hook in 3 seconds. " + steering
                    )
            if "do not invent" not in steering.lower():
                steering += " Do not invent offers or prices."
            lang_bit = _video_language_instruction(language)
            if lang_bit not in steering:
                steering = f"{steering} {lang_bit}"

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
            if guided_campaign and isinstance(exc, ValueError):
                logger.exception(
                    "Guided campaign rejected for key %s: %s",
                    _mask_key(api_key),
                    exc,
                )
                raise
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
    return _fallback_package(hint, default_format, language)


WEEKLY_PLAN_ROLES = (
    ("monday", "awareness"),
    ("wednesday", "product"),
    ("friday", "offer"),
)

WEEKLY_PLAN_SYSTEM = """You are a senior social video director for short-form vertical TikTok/Reels.

Create a 3-part weekly campaign series for one business. Posts must be distinct but on-brand.
Use ONLY facts from the supplied brief and notes. Never invent prices, discounts, deadlines,
addresses, testimonials, or product claims that were not provided.

Return JSON only with this shape:
{
  "posts": [
    {
      "day": "monday",
      "role": "awareness",
      "title": "short title",
      "angle": "one-sentence creative angle",
      "cta": "viewer action",
      "brief_delta": "extra brief lines for this post only",
      "notes_delta": "extra creative direction for this post only"
    },
    { "day": "wednesday", "role": "product", ... },
    { "day": "friday", "role": "offer", ... }
  ]
}

Rules:
- Exactly 3 posts in that day/role order.
- Each video intent is under ~45 seconds, vertical 9:16.
- Keep JSON keys in English. Write title, angle, cta, brief_delta, notes_delta in the required language.
"""


def _normalize_weekly_posts(raw: object, *, language: str) -> list[dict]:
    if isinstance(raw, dict):
        items = raw.get("posts")
    else:
        items = raw
    if not isinstance(items, list) or len(items) != 3:
        raise ValueError("Weekly plan must include exactly 3 posts.")

    posts: list[dict] = []
    for expected, item in zip(WEEKLY_PLAN_ROLES, items, strict=True):
        if not isinstance(item, dict):
            raise ValueError("Weekly plan post was incomplete.")
        day, role = expected
        title = str(item.get("title") or "").strip()
        angle = str(item.get("angle") or "").strip()
        cta = str(item.get("cta") or "").strip()
        brief_delta = str(item.get("brief_delta") or "").strip()
        notes_delta = str(item.get("notes_delta") or "").strip()
        if not all((title, angle, cta, brief_delta, notes_delta)):
            raise ValueError("Weekly plan post was incomplete.")
        posts.append(
            {
                "day": day,
                "role": role,
                "title": title[:120],
                "angle": angle[:500],
                "cta": cta[:200],
                "brief_delta": brief_delta[:1500],
                "notes_delta": notes_delta[:1500],
            }
        )
    if language == "km":
        for post in posts:
            blob = " ".join(
                post[key]
                for key in ("title", "angle", "cta", "brief_delta", "notes_delta")
            )
            if not re.search(r"[\u1780-\u17ff]", blob):
                raise ValueError("Weekly plan must be written in Khmer.")
    return posts


def draft_weekly_plan(
    settings: Settings,
    brief: str = "",
    notes: str = "",
    *,
    language: str | None = None,
    urls: list[str] | None = None,
) -> list[dict]:
    """Draft a Mon/Wed/Fri 3-post series plan via Gemini (no jobs created)."""
    global _active_key_index

    language = (language or settings.video_language or "en").strip()
    if language not in {"en", "km"}:
        language = "en"
    language_name = {"en": "English", "km": "Khmer (" + "ខ្មែរ" + ")"}.get(
        language, language
    )
    keys = settings.gemini_api_keys
    if not keys:
        raise ValueError("Connect a Gemini API key in Settings before planning your week.")

    url_lines = "\n".join(f"- {url}" for url in (urls or []) if url) or "(none)"
    user_prompt = (
        f"Required output language: {language_name} ({language}).\n"
        "Write title, angle, cta, brief_delta, and notes_delta in that language.\n"
        "Keep JSON keys in English.\n\n"
        f"Business brief:\n{(brief or '').strip() or '(empty)'}\n\n"
        f"Creative notes:\n{(notes or '').strip() or '(none)'}\n\n"
        f"Source URLs:\n{url_lines}\n"
    )
    if language == "km":
        user_prompt += "\nMake the plan in Khmer language."

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
                system_instruction=WEEKLY_PLAN_SYSTEM,
                temperature=GUIDED_TEMPERATURE,
            )
            data = _parse_json(content)
            posts = _normalize_weekly_posts(data, language=language)
            with _key_lock:
                _active_key_index = idx
            return posts
        except Exception as exc:
            last_error = exc
            if isinstance(exc, ValueError) and not _is_rotatable_error(exc):
                raise
            if _is_rotatable_error(exc) and offset < len(keys) - 1:
                logger.warning(
                    "Gemini key %s failed for weekly plan (%s); trying next key",
                    _mask_key(api_key),
                    exc,
                )
                continue
            logger.exception(
                "Gemini weekly plan failed with key %s",
                _mask_key(api_key),
            )
            break

    raise ValueError(
        f"Could not generate a weekly plan. {last_error or 'Please try again.'}"
    )
