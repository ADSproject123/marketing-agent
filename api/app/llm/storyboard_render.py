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
        "APPROVED VIDEO SCRIPT — follow the scene order and exact narration.",
        "Only supplied business facts are allowed. Do not invent prices, offers, reviews or addresses.",
        f"Business: {storyboard.get('business_name', '')}",
        f"Offer: {storyboard.get('offer', '') or 'No offer supplied; do not invent one.'}",
        f"Contact / action destination: {storyboard.get('contact', '')}",
        f"Title: {storyboard['title']}",
        f"Language: {language}",
        "",
    ]
    elapsed = 0.0
    for index, scene in enumerate(storyboard["scenes"], start=1):
        duration = float(scene["duration_seconds"])
        end = elapsed + duration
        asset = scene.get("asset_id")
        asset_name = "No photo selected; follow the visual direction."
        if asset is not None:
            source = files[int(asset)]
            asset_name = source.title or Path(source.value).name
        lines.extend([
            f"SCENE {index} ({elapsed:g}–{end:g}s):",
            f"SPOKEN NARRATION (verbatim): {scene['narration']}",
            f"ON-SCREEN HEADING: {scene['on_screen_text']}",
            f"VISUAL DIRECTION: {scene['visual_direction']}",
            f"SELECTED UPLOADED PHOTO: {asset_name}",
            "",
        ])
        elapsed = end
    lines.extend([
        "The social post caption is separate from this narration script.",
        "Do not narrate the social caption or add an introduction, conclusion or extra scenes.",
        "Narration subtitles and the final branded card are added in the editing pass.",
        _video_language_instruction(language),
    ])
    steering = (
        f"Create a short vertical 9:16 marketing video lasting approximately {elapsed:g} seconds. "
        "Use the APPROVED VIDEO SCRIPT source as the production plan. "
        "Follow its scene order, exact spoken narration, selected photos and visual directions. "
        "The first scene is the selected hook; open immediately without an intro. "
        "Keep speech clear, music below the voice, and text inside mobile safe areas. "
        "Use only the supplied business facts. Do not invent offers, prices, claims or contact details. "
        "Keep the final call to action exactly as approved. "
        "Avoid additional subtitles: narration captions are added in the final editing pass. "
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
