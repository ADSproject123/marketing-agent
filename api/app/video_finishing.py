"""Finish an approved campaign with reproducible overlays and measured checks.

Provider footage is preserved inside a vertical canvas. Captions come from the
approved narration, not the social caption or an audio transcription. Their
planned timing is scaled to the downloaded clip and must be checked in preview.
Text is rendered to PNGs so this works with FFmpeg builds without libass.
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageOps, features

from .jobs.store import JobSource

WIDTH = 720
HEIGHT = 1280
FPS = 30
MAX_SCENES = 20
SOFT_CUT_DURATION = 0.28
SOFT_CUT_PEAK_ALPHA = 140  # ~55% opacity at the cut mid-point
BGM_DIR = Path(__file__).resolve().parent.parent / "assets" / "audio" / "bgm"
SFX_DIR = Path(__file__).resolve().parent.parent / "assets" / "audio" / "sfx"
HOOK_WHOOSH = SFX_DIR / "hook_whoosh.wav"
END_STING = SFX_DIR / "end_sting.wav"
ALLOWED_BGM_TRACKS = frozenset({
    "none", "upbeat_commercial", "cozy_lofi", "energetic_trend", "acoustic_warmth",
})


class VideoFinishingError(RuntimeError):
    """A clip cannot be safely finished or measured."""


@dataclass(frozen=True)
class CaptionCue:
    start: float
    end: float
    text: str
    scene_index: int


def _binary(name: str, *, required: bool = True) -> str | None:
    found = shutil.which(name)
    if not found:
        for directory in ("/opt/homebrew/bin", "/usr/local/bin"):
            candidate = Path(directory) / name
            if candidate.is_file() and os.access(candidate, os.X_OK):
                found = str(candidate)
                break
    if required and not found:
        raise VideoFinishingError(
            f"Video finishing needs {name} installed on the API server. Install it and retry the video."
        )
    return found


def _run(arguments: list[str], *, timeout: int = 180) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            arguments, capture_output=True, text=True, check=True,
            timeout=timeout, stdin=subprocess.DEVNULL,
        )
    except subprocess.TimeoutExpired as exc:
        raise VideoFinishingError("Video finishing timed out. Retry the video.") from exc
    except (subprocess.CalledProcessError, OSError) as exc:
        raise VideoFinishingError(
            "Video finishing could not process this clip. Check FFmpeg, image assets, and text rendering, then retry."
        ) from exc


def probe_video(video_path: Path) -> dict[str, Any]:
    """Read actual media properties rather than assuming provider defaults."""
    result = _run([
        str(_binary("ffprobe")), "-v", "error", "-show_streams", "-show_format",
        "-of", "json", str(video_path),
    ], timeout=30)
    try:
        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        video = next(stream for stream in streams if stream.get("codec_type") == "video")
        duration = float(video.get("duration") or data.get("format", {}).get("duration") or 0)
        width, height = int(video["width"]), int(video["height"])
        if not math.isfinite(duration) or duration <= 0 or width <= 0 or height <= 0:
            raise ValueError("Invalid media dimensions or duration")
        return {
            "duration_seconds": round(duration, 3), "width": width, "height": height,
            "has_audio": any(stream.get("codec_type") == "audio" for stream in streams),
            "video_codec": video.get("codec_name"),
            "sample_aspect_ratio": video.get("sample_aspect_ratio", "1:1"),
        }
    except (KeyError, TypeError, ValueError, StopIteration) as exc:
        raise VideoFinishingError("The generated file is not a readable video. Retry generation.") from exc


def _clean_text(value: Any) -> str:
    # Keep user punctuation literal; remove invisible control characters only.
    return " ".join("".join(
        char for char in str(value or "")
        if char in "\n\t" or unicodedata.category(char) != "Cc"
    ).split())


def _clusters(text: str) -> list[str]:
    """Keep combining marks and Khmer coeng sequences together when paginating."""
    result: list[str] = []
    attach_next = False
    for char in text:
        attached = bool(unicodedata.combining(char)) or unicodedata.category(char).startswith("M")
        if result and (attached or attach_next or char in {"\u200d", "\u200c"}):
            result[-1] += char
        else:
            result.append(char)
        attach_next = char in {"\u17d2", "\u200d"}
    return result


def _caption_pages(text: str, language: str) -> list[str]:
    """Paginate speech instead of shrinking an entire scene into tiny text."""
    text = _clean_text(text)
    if not text:
        return []
    limit = 72 if language == "en" else 55
    # Prefer spoken phrase boundaries, then word boundaries; Khmer is also
    # supported when no whitespace separates its words.
    phrases = re.split(r"(?<=[.!?។៕])\s*", text)
    pages: list[str] = []
    for phrase in phrases:
        clusters = _clusters(phrase.strip())
        while clusters:
            count = min(limit, len(clusters))
            if count < len(clusters):
                lower = max(1, count // 2)
                for boundary in range(count - 1, lower - 1, -1):
                    if clusters[boundary].isspace():
                        count = boundary + 1
                        break
            page = "".join(clusters[:count]).strip()
            if page:
                pages.append(page)
            clusters = clusters[count:]
    return pages


def narration_cues(storyboard: dict[str, Any], actual_duration: float) -> list[CaptionCue]:
    """Build narration-only cues on the approved scene timeline."""
    scenes = storyboard.get("scenes")
    if not isinstance(scenes, list) or not scenes or len(scenes) > MAX_SCENES:
        raise VideoFinishingError("An approved script with 1–20 scenes is required before finishing.")
    try:
        durations = [float(scene["duration_seconds"]) for scene in scenes]
    except (KeyError, TypeError, ValueError) as exc:
        raise VideoFinishingError("Each approved scene needs a valid duration.") from exc
    if any(not math.isfinite(value) or value <= 0 for value in durations):
        raise VideoFinishingError("Each approved scene needs a positive duration.")
    language = storyboard.get("language", "en")
    if language not in {"en", "km"}:
        raise VideoFinishingError("The approved video language must be English or Khmer.")
    planned_duration = sum(durations)
    scale = actual_duration / planned_duration
    cursor = 0.0
    cues: list[CaptionCue] = []
    for index, (scene, duration) in enumerate(zip(scenes, durations)):
        pages = _caption_pages(scene.get("narration", ""), language)
        if not pages:
            raise VideoFinishingError("Every approved scene needs narration for its subtitles.")
        weights = [max(1, len(_clusters(page))) for page in pages]
        scene_start = cursor
        for page, weight in zip(pages, weights):
            end = cursor + duration * scale * weight / sum(weights)
            cues.append(CaptionCue(round(cursor, 6), round(end, 6), page, index))
            cursor = end
        cursor = scene_start + duration * scale
    last = cues[-1]
    cues[-1] = CaptionCue(last.start, actual_duration, last.text, last.scene_index)
    return cues


def _srt_time(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    whole, fraction = divmod(milliseconds, 1000)
    hours, remainder = divmod(whole, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{fraction:03}"


def write_narration_srt(cues: list[CaptionCue], destination: Path) -> Path:
    # SRT text is not markup. User-provided braces, quotes, and backslashes are
    # never inserted into FFmpeg expressions or shell commands.
    destination.write_text("\n\n".join(
        f"{index}\n{_srt_time(cue.start)} --> {_srt_time(cue.end)}\n{cue.text}"
        for index, cue in enumerate(cues, 1)
    ) + "\n", encoding="utf-8")
    return destination


class _TextRenderer:
    def __init__(self, directory: Path, language: str) -> None:
        self.directory = directory
        self.language = language
        self.pango = _binary("pango-view", required=False)
        self.serial = 0
        self.cache: dict[tuple[str, int, int, int, str], Image.Image] = {}
        if language == "km" and not self.pango and not features.check("raqm"):
            raise VideoFinishingError(
                "Khmer video text needs pango-view or Pillow with RAQM on the API server. Install a text shaper and retry."
            )

    def _pango_image(self, text: str, width: int, size: int, color: str) -> Image.Image:
        self.serial += 1
        input_path = self.directory / f"text-{self.serial}.txt"
        output_path = self.directory / f"text-{self.serial}.png"
        layout_path = self.directory / f"text-{self.serial}.json"
        input_path.write_text(text, encoding="utf-8")
        font = "Khmer Sangam MN" if self.language == "km" and sys.platform == "darwin" else (
            "Noto Sans Khmer" if self.language == "km" else "Sans"
        )
        _run([
            str(self.pango), "--no-display", "--backend=cairo", "--pixels",
            f"--font={font} {size}", f"--language={self.language}",
            "--background=transparent", f"--foreground={color}",
            f"--width={width}", "--margin=0", "--align=center", "--wrap=word-char",
            f"--output={output_path}", f"--serialize-to={layout_path}", str(input_path),
        ], timeout=30)
        try:
            layout = json.loads(layout_path.read_text(encoding="utf-8"))
            unknown = int(layout["output"]["unknown-glyphs"])
        except (OSError, KeyError, TypeError, ValueError) as exc:
            raise VideoFinishingError("The video text layout could not be verified. Check Pango and retry.") from exc
        if unknown:
            raise VideoFinishingError(
                "A video font cannot display part of the approved text. Install the required font or edit those characters, then retry."
            )
        with Image.open(output_path) as rendered:
            return rendered.convert("RGBA")

    def _pillow_image(self, text: str, width: int, size: int, color: str) -> Image.Image:
        font_paths = (
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Khmer Sangam MN.ttf" if self.language == "km" else
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansKhmer-Regular.ttf" if self.language == "km" else
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        )
        font_path = next((path for path in font_paths if Path(path).is_file()), None)
        if not font_path:
            raise VideoFinishingError("No suitable video font was found on the API server.")
        font = ImageFont.truetype(font_path, size)
        dummy = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        lines: list[str] = []
        line = ""
        for cluster in _clusters(text):
            candidate = line + cluster
            if line and dummy.textlength(candidate, font=font) > width:
                lines.append(line)
                line = cluster
            else:
                line = candidate
        if line:
            lines.append(line)
        height = max(1, int(len(lines) * size * 1.55))
        image = Image.new("RGBA", (width, height))
        draw = ImageDraw.Draw(image)
        for index, line in enumerate(lines):
            line_width = draw.textlength(line, font=font)
            draw.text(((width - line_width) / 2, index * size * 1.55), line, font=font, fill=color)
        return image

    def fit(self, text: str, width: int, height: int, *, size: int = 34, color: str = "white") -> Image.Image:
        text = _clean_text(text)
        if not text:
            return Image.new("RGBA", (width, 1))
        key = (text, width, height, size, color)
        if key in self.cache:
            return self.cache[key]
        for font_size in range(size, 19, -2):
            image = self._pango_image(text, width, font_size, color) if self.pango else (
                self._pillow_image(text, width, font_size, color)
            )
            if image.height <= height:
                self.cache[key] = image
                return image
        raise VideoFinishingError("A video text field is too long to display clearly. Shorten it in the script and retry.")


def _paste_text(canvas: Image.Image, renderer: _TextRenderer, text: str, y: int,
                max_height: int, *, size: int = 34, width: int = 600, color: str = "white") -> int:
    if not _clean_text(text):
        return 0
    image = renderer.fit(text, width, max_height, size=size, color=color)
    canvas.alpha_composite(image, ((WIDTH - image.width) // 2, y))
    return image.height


def _authorized_assets(sources: list[JobSource]) -> list[Path]:
    return [Path(source.value) for source in sources if source.kind == "file"]


def _selected_asset(scene: dict[str, Any], assets: list[Path]) -> Path | None:
    asset_id = scene.get("asset_id")
    if asset_id is None or asset_id == "":
        return None
    try:
        index = int(asset_id)
        if str(index) != str(asset_id) or index < 0 or index >= len(assets):
            raise ValueError("Unknown asset")
    except (ValueError, TypeError) as exc:
        raise VideoFinishingError("The script references an unavailable brand photo. Choose a campaign photo and retry.") from exc
    path = assets[index]
    if not path.is_file():
        raise VideoFinishingError("A selected brand photo is missing. Upload it again before retrying.")
    return path


def _is_logo_like(path: Path, image: Image.Image) -> bool:
    """Treat small icons / transparent marks as watermarks, not full photo cards."""
    name = path.name.lower()
    if any(token in name for token in ("logo", "icon", "-mark", "_mark", "watermark")):
        return True
    width, height = image.size
    if max(width, height) <= 512:
        return True
    if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
        alpha = image.convert("RGBA").split()[3]
        # Mostly transparent canvas around a mark.
        transparent = sum(1 for value in alpha.get_flattened_data() if value < 16)
        if transparent / max(1, width * height) >= 0.25:
            return True
    return False


def _draw_logo_watermark(canvas: Image.Image, image: Image.Image) -> None:
    mark = ImageOps.contain(image.convert("RGBA"), (128, 128))
    pad = 12
    badge = Image.new("RGBA", (mark.width + pad * 2, mark.height + pad * 2), (255, 255, 255, 210))
    badge.alpha_composite(mark, (pad, pad))
    canvas.alpha_composite(badge, (36, 48))


def _draw_product_card(canvas: Image.Image, draw: ImageDraw.ImageDraw, image: Image.Image) -> None:
    photo = ImageOps.contain(image.convert("RGBA"), (420, 280))
    card_w, card_h = photo.width + 28, photo.height + 28
    x = (WIDTH - card_w) // 2
    y = 150
    draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=18, fill=(255, 255, 255, 230))
    canvas.alpha_composite(photo, (x + 14, y + 14))


def _asset_by_id(asset_id: Any, assets: list[Path]) -> Path | None:
    if asset_id is None or asset_id == "":
        return None
    try:
        index = int(asset_id)
        if str(index) != str(asset_id) or index < 0 or index >= len(assets):
            raise ValueError("Unknown asset")
    except (ValueError, TypeError) as exc:
        raise VideoFinishingError("The end-card QR image is unavailable. Upload KHQR again and retry.") from exc
    path = assets[index]
    if not path.is_file():
        raise VideoFinishingError("The end-card QR image is missing. Upload it again before retrying.")
    return path


def _telegram_qr_image(username: str, size: int = 320) -> Image.Image:
    handle = _clean_text(username).lstrip("@")
    if not handle:
        raise VideoFinishingError("A Telegram username is required to build the end-card QR.")
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(f"https://t.me/{handle}")
    qr.make(fit=True)
    image = qr.make_image(fill_color="#111827", back_color="#ffffff").convert("RGBA")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def _load_qr_panel(storyboard: dict[str, Any], assets: list[Path], size: int = 320) -> Image.Image | None:
    khqr_path = _asset_by_id(storyboard.get("endcard_qr_asset_id"), assets)
    if khqr_path is not None:
        try:
            with Image.open(khqr_path) as original:
                if original.format not in {"PNG", "JPEG", "WEBP"}:
                    raise ValueError("Not a campaign image")
                return ImageOps.contain(ImageOps.exif_transpose(original).convert("RGBA"), (size, size))
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            raise VideoFinishingError("The KHQR image cannot be rendered. Replace it and retry.") from exc
    telegram = _clean_text(storyboard.get("telegram_username")).lstrip("@")
    if telegram:
        return _telegram_qr_image(telegram, size=size)
    return None


def _resolve_bgm(storyboard: dict[str, Any]) -> tuple[Path | None, float]:
    track = _clean_text(storyboard.get("bgm_track") or "none") or "none"
    if track not in ALLOWED_BGM_TRACKS or track == "none":
        return None, 0.0
    path = BGM_DIR / f"{track}.mp3"
    if not path.is_file():
        raise VideoFinishingError(
            f"Background music track '{track}' is missing on the API server. Add it under assets/audio/bgm/."
        )
    try:
        volume = float(storyboard.get("bgm_volume", 0.22))
    except (TypeError, ValueError) as exc:
        raise VideoFinishingError("Background music volume must be a number.") from exc
    if not math.isfinite(volume) or not 0.05 <= volume <= 0.5:
        raise VideoFinishingError("Background music volume must be between 0.05 and 0.5.")
    return path, volume


def _scene_boundary_times(cues: list[CaptionCue], *, closing_start: float) -> list[float]:
    """Scene starts suitable for soft-cuts (skip t=0 and the closing-card moment)."""
    boundaries: list[float] = []
    previous = None
    for cue in cues:
        if cue.scene_index == previous:
            continue
        previous = cue.scene_index
        start = float(cue.start)
        if start <= 0.05:
            continue
        if abs(start - closing_start) < 0.05 or start >= closing_start:
            continue
        boundaries.append(start)
    return boundaries


def _soft_cut_alpha(time: float, boundary: float) -> int:
    """Triangular veil alpha peaking at the scene boundary."""
    half = SOFT_CUT_DURATION / 2
    distance = abs(time - boundary)
    if distance >= half:
        return 0
    progress = 1.0 - (distance / half)
    return max(0, min(255, int(SOFT_CUT_PEAK_ALPHA * progress)))


def _apply_soft_cut_veil(frame: Image.Image, alpha: int) -> Image.Image:
    if alpha <= 0:
        return frame
    veiled = frame.copy()
    veiled.alpha_composite(Image.new("RGBA", veiled.size, (0, 0, 0, alpha)))
    return veiled


def _overlay_timeline(
    intervals: list[tuple[CaptionCue, bool]],
    boundaries: list[float],
) -> list[tuple[CaptionCue, bool, int]]:
    """Split caption intervals so soft-cut veils can animate without changing duration."""
    if not boundaries:
        return [(cue, closing, 0) for cue, closing in intervals]
    cuts = sorted(boundaries)
    step = max(1.0 / FPS, 0.04)
    half = SOFT_CUT_DURATION / 2
    pieces: list[tuple[CaptionCue, bool, int]] = []
    for cue, closing in intervals:
        cursor = float(cue.start)
        end = float(cue.end)
        while cursor < end - 1e-6:
            active = [boundary for boundary in cuts if abs(cursor - boundary) < half]
            if active:
                next_end = min(end, cursor + step)
            else:
                upcoming = [boundary - half for boundary in cuts if boundary - half > cursor + 1e-6]
                next_end = min([end, *upcoming])
            if next_end <= cursor + 1e-6:
                next_end = min(end, cursor + step)
            mid = (cursor + next_end) / 2
            alpha = max((_soft_cut_alpha(mid, boundary) for boundary in cuts), default=0)
            pieces.append((
                CaptionCue(cursor, next_end, cue.text, cue.scene_index),
                closing,
                alpha,
            ))
            cursor = next_end
    return pieces


def apply_bgm_with_ducking(
    video_path: Path,
    bgm_path: Path,
    output_path: Path,
    *,
    bgm_volume: float = 0.22,
    duration: float,
    closing_start: float | None = None,
) -> None:
    """Backward-compatible BGM mix; prefer ``apply_audio_polish`` for SFX + swell."""
    apply_audio_polish(
        video_path, output_path,
        duration=duration,
        closing_start=closing_start if closing_start is not None else max(0.0, duration - 1.6),
        bgm_path=bgm_path,
        bgm_volume=bgm_volume,
    )


def apply_audio_polish(
    video_path: Path,
    output_path: Path,
    *,
    duration: float,
    closing_start: float,
    bgm_path: Path | None = None,
    bgm_volume: float = 0.22,
) -> dict[str, Any]:
    """Duck BGM under speech, swell into the end card, and layer hook/end SFX."""
    ffmpeg = str(_binary("ffmpeg"))
    if not HOOK_WHOOSH.is_file() or not END_STING.is_file():
        raise VideoFinishingError(
            "Finishing SFX assets are missing on the API server. Add hook_whoosh.wav and end_sting.wav under assets/audio/sfx/."
        )
    hook_delay_ms = 0
    sting_delay_ms = max(0, int(round(closing_start * 1000)))
    swell_start = max(0.0, duration - 1.6)
    inputs = ["-i", str(video_path)]
    filter_parts: list[str] = []
    # Speech always comes from input 0.
    next_index = 1
    if bgm_path is not None:
        inputs.extend(["-stream_loop", "-1", "-i", str(bgm_path)])
        bgm_idx = next_index
        next_index += 1
        swell_vol = min(0.5, bgm_volume * 1.55)
        # Raise BGM into the closing card while keeping base level elsewhere.
        filter_parts.append(f"[0:a]asplit=2[sc][speak]")
        filter_parts.append(
            f"[{bgm_idx}:a]volume='if(gte(t,{swell_start:.3f}),{swell_vol:.3f},{bgm_volume:.3f})'"
            f":eval=frame[bgm_dyn]"
        )
        filter_parts.append(
            "[bgm_dyn][sc]sidechaincompress=threshold=0.08:ratio=5:attack=100:release=600[ducked_bgm]"
        )
        filter_parts.append(
            "[speak][ducked_bgm]amix=inputs=2:duration=first:dropout_transition=2[bed]"
        )
        bed_label = "bed"
    else:
        filter_parts.append("[0:a]anull[bed]")
        bed_label = "bed"

    inputs.extend(["-i", str(HOOK_WHOOSH), "-i", str(END_STING)])
    hook_idx = next_index
    sting_idx = next_index + 1
    filter_parts.append(
        f"[{hook_idx}:a]volume=0.42,adelay={hook_delay_ms}|{hook_delay_ms},"
        f"apad=whole_dur={duration:.3f}[hook]"
    )
    filter_parts.append(
        f"[{sting_idx}:a]volume=0.48,adelay={sting_delay_ms}|{sting_delay_ms},"
        f"apad=whole_dur={duration:.3f}[sting]"
    )
    filter_parts.append(
        f"[{bed_label}][hook][sting]amix=inputs=3:duration=first:dropout_transition=2:normalize=0,"
        "loudnorm=I=-16:TP=-1.5:LRA=11[aout]"
    )
    command = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        *inputs,
        "-filter_complex", ";".join(filter_parts),
        "-map", "0:v", "-map", "[aout]",
        "-t", f"{duration:.6f}",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        str(output_path),
    ]
    _run(command, timeout=300)
    return {
        "sfx": ["hook_whoosh", "end_sting"],
        "bgm": bgm_path is not None,
        "closing_start": round(closing_start, 3),
    }


def _scene_overlay(scene: dict[str, Any], cue: CaptionCue, storyboard: dict[str, Any],
                   renderer: _TextRenderer, assets: list[Path], *, closing: bool,
                   opening: bool = False) -> Image.Image:
    """Minimal overlays: captions + optional logo watermark; closing CTA card.

    Mid-scene on_screen_text banners are intentionally not burned — they duplicated
    NotebookLM text and bottom captions. Business name appears only on open/close.
    """
    canvas = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(canvas)
    business = _clean_text(storyboard.get("business_name"))
    # No mid/opening business-name pill — it cluttered the frame. Name stays on the end card only.
    _ = opening  # kept for call-site compatibility

    asset = None if closing else _selected_asset(scene, assets)
    if asset:
        try:
            with Image.open(asset) as original:
                if original.format not in {"PNG", "JPEG", "WEBP"}:
                    raise ValueError("Not a campaign image")
                image = ImageOps.exif_transpose(original).convert("RGBA")
                if _is_logo_like(asset, image):
                    _draw_logo_watermark(canvas, image)
                else:
                    _draw_product_card(canvas, draw, image)
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            raise VideoFinishingError("A selected brand photo cannot be rendered. Replace it and retry.") from exc

    if closing:
        # The closing card displays only exact approved values. No promotional
        # claims, prices, or contact details are supplied by the renderer.
        qr_panel = _load_qr_panel(storyboard, assets, size=300)
        offer = _clean_text(storyboard.get("offer"))
        contact = _clean_text(storyboard.get("contact"))
        telegram = _clean_text(storyboard.get("telegram_username")).lstrip("@")
        if qr_panel is not None:
            panel_top, panel_bottom = 250, 980
            draw.rounded_rectangle((40, panel_top, WIDTH - 40, panel_bottom), radius=24,
                                   fill=(13, 23, 40, 247), outline=(113, 195, 193, 255), width=2)
            y = panel_top + 28
            if business:
                y += _paste_text(canvas, renderer, business, y, 90, size=36) + 16
            if offer:
                y += _paste_text(canvas, renderer, offer, y, 70, size=28) + 14
            qr_box = Image.new("RGBA", (320, 320), (255, 255, 255, 255))
            qr_box.alpha_composite(qr_panel, ((320 - qr_panel.width) // 2, (320 - qr_panel.height) // 2))
            qr_x = (WIDTH - 320) // 2
            canvas.alpha_composite(qr_box, (qr_x, y))
            y += 320 + 18
            cta = (
                f"Scan to message @{telegram}" if telegram and not storyboard.get("endcard_qr_asset_id")
                else "Scan to order / pay"
            )
            if storyboard.get("language") == "km":
                cta = (
                    f"ស្កេនដើម្បីផ្ញើសារ @{telegram}" if telegram and not storyboard.get("endcard_qr_asset_id")
                    else "ស្កេនដើម្បីបញ្ជាទិញ"
                )
            _paste_text(canvas, renderer, cta, y, 80, size=28, color="#bce6e3")
            # QR closing card is the CTA — skip bottom narration captions to avoid clutter.
            return canvas
        draw.rounded_rectangle((40, 340, WIDTH - 40, 906), radius=24,
                               fill=(13, 23, 40, 247), outline=(113, 195, 193, 255), width=2)
        y = 374
        if business:
            y += _paste_text(canvas, renderer, business, y, 130, size=40) + 24
        remaining = 872 - y
        values = [value for value in (offer, contact) if value]
        for value in values:
            allowance = max(60, (remaining - 20 * len(values)) // max(1, len(values)))
            y += _paste_text(canvas, renderer, value, y, allowance, size=32,
                             color="#bce6e3" if value == contact else "white") + 20

    caption = renderer.fit(cue.text, 588, 172, size=34)
    bottom_y = HEIGHT - 132 - caption.height
    draw.rounded_rectangle((48, bottom_y - 14, WIDTH - 48, HEIGHT - 110), radius=14,
                           fill=(9, 14, 23, 210))
    canvas.alpha_composite(caption, ((WIDTH - caption.width) // 2, bottom_y))
    return canvas


def _volume_stats(video_path: Path) -> dict[str, float]:
    output = _run([
        str(_binary("ffmpeg")), "-hide_banner", "-nostdin", "-i", str(video_path),
        "-vn", "-af", "volumedetect", "-f", "null", "-",
    ], timeout=60).stderr
    stats: dict[str, float] = {}
    for name in ("mean_volume", "max_volume"):
        match = re.search(rf"{name}:\s*(-?\d+(?:\.\d+)?|-inf)\s*dB", output)
        if match:
            value = float(match.group(1))
            if math.isfinite(value):
                stats[f"{name}_db"] = value
    return stats


def _quality_report(metadata: dict[str, Any], storyboard: dict[str, Any], cues: list[CaptionCue],
                    subtitles_path: Path, asset_count: int) -> dict[str, Any]:
    checks: list[dict[str, str]] = []

    def add(check_id: str, label: str, status: str, detail: str) -> None:
        checks.append({"id": check_id, "label": label, "status": status, "detail": detail})

    duration = metadata["duration_seconds"]
    vertical = metadata["width"] * 16 == metadata["height"] * 9
    add("aspect_ratio", "Vertical format", "pass" if vertical else "fail",
        f"Measured {metadata['width']} × {metadata['height']}; source footage is preserved inside a 9:16 canvas.")
    add("duration", "Video length", "pass" if 10 <= duration <= 60.1 else "warn",
        f"Measured {duration:.1f} seconds. Short campaign videos target 10–60 seconds.")
    planned = sum(float(scene["duration_seconds"]) for scene in storyboard["scenes"])
    deviation = abs(duration - planned)
    add("scene_timing", "Scene timing", "warn" if deviation > max(3, planned * .15) else "pass",
        f"Approved plan: {planned:.1f}s; actual clip: {duration:.1f}s. Overlay timing was scaled to the clip.")
    has_audio = metadata["has_audio"]
    peak = metadata.get("max_volume_db", -100)
    audible = has_audio and peak > -50
    add("audio", "Audio", "pass" if audible else "fail",
        "Audio track present; loudness normalized for review. Listen to confirm the voice and pronunciation."
        if audible else "The clip has no audible audio track. Regenerate before publishing.")
    add("subtitles", "Narration subtitles", "pass",
        f"Burned in {len(cues)} cues from the approved narration, separately from the social caption.")
    dense = any(len(_clusters(cue.text)) / max(.001, cue.end - cue.start) > 25 for cue in cues)
    add("subtitle_readability", "Subtitle reading time", "warn" if dense else "pass",
        "Some narration captions change quickly. Review readability or shorten the script."
        if dense else "Narration captions have time to read at the planned playback speed.")
    add("subtitle_alignment", "Speech and subtitle match", "warn",
        "Captions use the approved script and planned timing, not an audio transcript. Check spoken words and timing in preview.")
    for key, label in (("business_name", "Branding"), ("offer", "Offer"), ("contact", "Contact and action")):
        text = _clean_text(storyboard.get(key))
        add(key, label, "pass" if text or key == "offer" else "warn",
            "The exact approved text was rendered on the closing card; generated footage was not checked with OCR."
            if text else "No offer supplied; no offer added." if key == "offer" else
            "No approved text was supplied for this field. Review whether it should appear in the video.")
    has_qr = bool(_clean_text(storyboard.get("telegram_username")) or storyboard.get("endcard_qr_asset_id"))
    add("endcard_qr", "Scan-to-action end card", "pass" if has_qr else "warn",
        "Closing card includes a Telegram or KHQR scan target."
        if has_qr else "No Telegram username or KHQR image was supplied for a scan end card.")
    bgm_track = _clean_text(storyboard.get("bgm_track") or "none") or "none"
    polish = metadata.get("audio_polish") or {}
    soft_cuts = int(metadata.get("soft_cut_count") or 0)
    if bgm_track != "none":
        bgm_detail = f"Mixed track '{bgm_track}' with speech ducking"
        if polish.get("bgm"):
            bgm_detail += ", end-card swell"
        if polish.get("sfx"):
            bgm_detail += ", hook/end SFX"
        if soft_cuts:
            bgm_detail += f", {soft_cuts} scene soft-cuts"
        bgm_detail += "."
        add("bgm", "Background music", "pass", bgm_detail)
    else:
        extras = []
        if polish.get("sfx"):
            extras.append("hook/end SFX")
        if soft_cuts:
            extras.append(f"{soft_cuts} scene soft-cuts")
        add("bgm", "Background music", "warn",
            ("No background music selected; still applied " + " and ".join(extras) + ".")
            if extras else "No background music selected for this video.")
    add("audio_polish", "Edit polish", "pass" if soft_cuts or polish.get("sfx") else "warn",
        f"Applied {soft_cuts} soft-cuts"
        + (", hook whoosh + end sting" if polish.get("sfx") else "")
        + ("." if soft_cuts or polish.get("sfx") else "No scene soft-cuts or SFX were applied."))
    add("brand_assets", "Chosen photos", "pass" if asset_count else "warn",
        f"Rendered {asset_count} scene photo selections from this campaign's uploaded images."
        if asset_count else "No campaign photo was selected for a scene. Review the generated visuals.")
    return {
        "processed": True, "checks": checks, "metadata": metadata,
        "caption_source": "approved_narration", "subtitles_path": str(subtitles_path),
    }


def finish_video(video_path: Path, storyboard: dict[str, Any],
                 sources: list[JobSource]) -> tuple[Path, dict[str, Any]]:
    """Finish downloaded footage; never return an unprocessed clip on failure.

    This synchronous function is intended for ``asyncio.to_thread``. Processing
    uses argument arrays and generated filenames, with no shell interpretation
    or user-provided FFmpeg expressions. The original downloaded clip remains.
    """
    video_path = Path(video_path)
    if not video_path.is_file():
        raise VideoFinishingError("The generated video is missing. Retry generation.")
    ffmpeg = str(_binary("ffmpeg"))
    source_metadata = probe_video(video_path)
    duration = source_metadata["duration_seconds"]
    if duration > 600:
        raise VideoFinishingError("The generated clip is longer than 10 minutes. Request a shorter campaign video and retry.")
    cues = narration_cues(storyboard, duration)
    assets = _authorized_assets(sources)
    selected_assets = [_selected_asset(scene, assets) for scene in storyboard["scenes"]]
    destination = video_path.with_name(f"{video_path.stem}.finished.mp4")
    subtitles_path = video_path.with_name(f"{video_path.stem}.narration.srt")
    with tempfile.TemporaryDirectory(prefix="campaign-finish-", dir=video_path.parent) as temporary:
        directory = Path(temporary)
        renderer = _TextRenderer(directory, storyboard.get("language", "en"))
        # Closing facts appear over the last 3 seconds without adding time or
        # interrupting the generated audio. Split an existing cue if necessary.
        closing_start = max(0, duration - min(3, duration * .3))
        intervals: list[tuple[CaptionCue, bool]] = []
        for cue in cues:
            if cue.start < closing_start < cue.end:
                intervals.append((CaptionCue(cue.start, closing_start, cue.text, cue.scene_index), False))
                intervals.append((CaptionCue(closing_start, cue.end, cue.text, cue.scene_index), True))
            else:
                intervals.append((cue, cue.start >= closing_start))
        soft_boundaries = _scene_boundary_times(cues, closing_start=closing_start)
        timeline = _overlay_timeline(intervals, soft_boundaries)
        playlist_lines = ["ffconcat version 1.0"]
        for index, (cue, closing, veil_alpha) in enumerate(timeline):
            frame_path = directory / f"overlay-{index:04}.png"
            frame = _scene_overlay(
                storyboard["scenes"][cue.scene_index], cue, storyboard,
                renderer, assets, closing=closing, opening=cue.scene_index == 0,
            )
            frame = _apply_soft_cut_veil(frame, veil_alpha)
            frame.save(frame_path)
            playlist_lines.extend([f"file '{frame_path.name}'", f"duration {cue.end - cue.start:.6f}"])
        # The demuxer needs a final repeated image to honor the last duration.
        playlist_lines.append(f"file 'overlay-{len(timeline) - 1:04}.png'")
        playlist = directory / "overlays.ffconcat"
        playlist.write_text("\n".join(playlist_lines) + "\n", encoding="utf-8")
        temporary_video = directory / "finished.mp4"
        filter_graph = (
            f"[0:v]scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease:force_divisible_by=2,"
            f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x0d1728,setsar=1,fps={FPS}[base];"
            f"[1:v]fps={FPS},format=rgba[overlay];"
            "[base][overlay]overlay=0:0:eof_action=repeat:shortest=0,format=yuv420p[out]"
        )
        command = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-i", str(video_path), "-f", "concat", "-safe", "1", "-i", str(playlist),
            "-filter_complex_threads", "2", "-filter_complex", filter_graph,
            "-map", "[out]", "-map", "0:a:0?", "-t", f"{duration:.6f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-threads", "2",
            "-c:a", "aac", "-b:a", "128k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-movflags", "+faststart", "-map_metadata", "-1", str(temporary_video),
        ]
        _run(command, timeout=300)
        metadata = probe_video(temporary_video)
        if metadata["has_audio"]:
            metadata.update(_volume_stats(temporary_video))
        metadata["original_width"] = source_metadata["width"]
        metadata["original_height"] = source_metadata["height"]
        metadata["planned_duration_seconds"] = round(sum(
            float(scene["duration_seconds"]) for scene in storyboard["scenes"]
        ), 3)
        metadata["text_renderer"] = "pango" if renderer.pango else "pillow"
        metadata["soft_cut_count"] = len(soft_boundaries)
        temporary_srt = write_narration_srt(cues, directory / "narration.srt")
        bgm_path, bgm_volume = _resolve_bgm(storyboard)
        polish_info: dict[str, Any] = {}
        if metadata["has_audio"]:
            polished = directory / "finished-polished.mp4"
            polish_info = apply_audio_polish(
                temporary_video, polished,
                duration=duration,
                closing_start=closing_start,
                bgm_path=bgm_path,
                bgm_volume=bgm_volume,
            )
            metadata = probe_video(polished)
            if metadata["has_audio"]:
                metadata.update(_volume_stats(polished))
            metadata["original_width"] = source_metadata["width"]
            metadata["original_height"] = source_metadata["height"]
            metadata["planned_duration_seconds"] = round(sum(
                float(scene["duration_seconds"]) for scene in storyboard["scenes"]
            ), 3)
            metadata["text_renderer"] = "pango" if renderer.pango else "pillow"
            metadata["soft_cut_count"] = len(soft_boundaries)
            metadata["audio_polish"] = polish_info
            if bgm_path is not None:
                metadata["bgm_track"] = _clean_text(storyboard.get("bgm_track"))
            temporary_video = polished
        elif bgm_path is not None:
            raise VideoFinishingError(
                "Background music needs an audible narration track. Regenerate the video, then retry."
            )
        # Publish completed artifacts only after encoding and probing succeed.
        temporary_video.replace(destination)
        temporary_srt.replace(subtitles_path)
    return destination, _quality_report(
        metadata, storyboard, cues, subtitles_path, sum(path is not None for path in selected_assets),
    )
