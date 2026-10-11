"""Turn the reviewed scene plan into the exact video-generation brief."""

from __future__ import annotations

from pathlib import Path

from app.jobs.store import JobSource
from app.llm.caption import CaptionPackage, _video_language_instruction


def package_from_storyboard(
    brief: str, storyboard: dict, sources: list[JobSource]
) -> CaptionPackage:
    """No creative redraft happens between script approval and video rendering."""
    language = storyboard["language"]
    files = [source for source in sources if source.kind == "file"]
    lines = [
        "### PRODUCTION DIRECTIVE: VIRAL SHORT-FORM COMMERCIAL ADVERTISEMENT",
        "### STRICT ENFORCEMENT: THIS IS NOT A PODCAST. NO HOST INTRODUCTIONS. NO CHAT.",
        "[DIRECTIVE: COMMERCIAL ADVERTISEMENT — NOT A PODCAST]",
        '- DO NOT say "Welcome to", "Hello listeners", "Welcome back", or "Today we\'re looking at".',
        "- DO NOT speak as two hosts chatting or debating.",
        "- Speak as a SINGLE confident commercial brand voiceover.",
        "- Begin speaking the OPENING HOOK on EXACT SECOND 0.0.",
        "- Pacing: Fast-paced commercial montage (TikTok/Reels format).",
        f"Brand / Business: {storyboard.get('business_name', '')}",
        f"Verified Offer: {storyboard.get('offer', '') or 'Promote stated benefit only; do not invent offers.'}",
        f"Call to Action: {storyboard.get('contact', '')}",
        f"Language Target: {language}",
        f"Title: {storyboard['title']}",
        "",
        "### PRODUCTION TIMELINE & SHOT LIST:",
    ]
    elapsed = 0.0
    for index, scene in enumerate(storyboard["scenes"], start=1):
        duration = float(scene["duration_seconds"])
        end = elapsed + duration
        asset = scene.get("asset_id")
        if asset is not None:
            source = files[int(asset)]
            asset_label = source.title or Path(source.value).name
        else:
            asset_label = "Cinematic AI B-Roll (no uploaded photo selected)"
        lines.extend([
            f"==================================================",
            f"SHOT {index} | TIMECODE: {elapsed:g}s – {end:g}s | DURATION: {duration:g}s",
            f'AUDIO VOICEOVER (verbatim): "{scene["narration"]}"',
            # Never ask NLM to burn headlines — English must stay text-free on screen.
            "EDITOR NOTE: spoken VO only — do NOT render this line, any headline, caption, or text box on video.",
            f"CAMERA DIRECTION: {scene['visual_direction']}",
            f"FEATURED VISUAL ASSET: {asset_label}",
            "==================================================",
            "",
        ])
        elapsed = end
    lines.extend([
        "The social post caption is separate from this narration script.",
        "Do not narrate the social caption or add an introduction, conclusion or extra scenes.",
    ])
    if language == "km":
        lines.extend([
            "KHMER CAPTIONS: Burn large high-contrast Khmer captions for every spoken line.",
            "Do NOT burn English captions, business-name pills, dark title chips, or logo text bars.",
            "Business name branding is added later on the end card — never as an opening name pill.",
        ])
        caption_steering = (
            "CRITICAL for Khmer: burn readable Khmer captions throughout. "
            "Do NOT burn English text, business-name pills, dark rounded title chips, "
            "or branded name labels. No opening name pill. "
        )
    else:
        lines.extend([
            "Produce clean visual footage only — ZERO on-screen text for English.",
            "CRITICAL: Do NOT burn captions, subtitles, titles, business-name pills, dark rounded "
            "chips, brown/black text bars, lower-thirds, or any readable words on the video frames.",
            "Spoken voiceover carries the message; visuals stay text-free. End-card branding is added later.",
        ])
        caption_steering = (
            "CRITICAL: English = clean footage with ZERO burned-in text. "
            "No captions, subtitles, titles, name pills, dark chips, or text bars of any kind. "
            "Voiceover only — do not put spoken words on screen. "
        )
    lines.append(_video_language_instruction(language))
    steering = (
        f"High-energy vertical 9:16 mobile video advertisement lasting approximately {elapsed:g} seconds. "
        "Style: High-retention TikTok/Reels commercial montage. "
        "Use the PRODUCTION TIMELINE & SHOT LIST as the production plan. "
        "CRITICAL: Start immediately on second 0 with Shot 1 voiceover. "
        "Do not add intro greetings, podcast host chatter, or welcome lines. "
        "Follow scene order and exact spoken narration. "
        "Use only the supplied business facts. Do not invent offers, prices, claims or contact details. "
        "Keep the final call to action exactly as approved. "
        + caption_steering
        + _video_language_instruction(language)
    )
    return CaptionPackage(
        brief=brief,
        title=storyboard["title"],
        caption=storyboard["caption"],
        steering_prompt=steering,
        source_text="\n".join(lines),
        video_format="short",
    )


def narration_from_storyboard(storyboard: dict) -> str:
    return "\n".join(scene["narration"] for scene in storyboard["scenes"])
