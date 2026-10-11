"""Exercise actual finishing on small synthetic media without provider calls."""

from __future__ import annotations

import shutil
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app.jobs.store import JobSource
from app.video_finishing import (
    HEIGHT, WIDTH, VideoFinishingError, _TextRenderer, _clusters, _quality_report, finish_video,
    narration_cues, probe_video, write_narration_srt,
)


def _plan(language="en"):
    return {
        "language": language,
        "business_name": "Lotus Coffee" if language == "en" else "ហាងកាហ្វេផ្កាឈូក",
        "offer": "Fresh coffee daily" if language == "en" else "កាហ្វេស្រស់រាល់ថ្ងៃ",
        "contact": "Visit 123 Main Street" if language == "en" else "សូមអញ្ជើញមកហាងរបស់យើង",
        "caption": "SOCIAL CAPTION MUST NOT BECOME SUBTITLES",
        "scenes": [
            {"id": "opening", "duration_seconds": 2,
             "narration": "Coffee made for your morning." if language == "en" else "កាហ្វេស្រស់សម្រាប់ពេលព្រឹករបស់អ្នក។",
             "on_screen_text": "Made fresh" if language == "en" else "កាហ្វេស្រស់",
             "asset_id": None},
            {"id": "ending", "duration_seconds": 2,
             "narration": "Visit Lotus Coffee today." if language == "en" else "សូមអញ្ជើញមកហាងកាហ្វេផ្កាឈូកថ្ងៃនេះ។",
             "on_screen_text": "Visit today" if language == "en" else "សូមអញ្ជើញមកថ្ងៃនេះ",
             "asset_id": None},
        ],
    }


class NarrationCaptionTests(unittest.TestCase):
    def test_timing_scales_to_media_and_uses_only_narration(self):
        plan = _plan()
        cues = narration_cues(plan, 8)
        self.assertEqual(cues[0].start, 0)
        self.assertEqual(cues[0].end, 4)
        self.assertEqual(cues[-1].end, 8)
        self.assertNotIn(plan["caption"], " ".join(cue.text for cue in cues))
        with tempfile.TemporaryDirectory() as temporary:
            path = write_narration_srt(cues, Path(temporary) / "narration.srt")
            contents = path.read_text()
            self.assertIn("00:00:00,000 --> 00:00:04,000", contents)
            self.assertIn(plan["scenes"][0]["narration"], contents)

    def test_srt_preserves_literal_unicode_and_command_like_text(self):
        plan = _plan("km")
        plan["scenes"][0]["narration"] = 'កាហ្វេ $(touch /tmp/unwanted) {\\an8} "quoted"'
        cues = narration_cues(plan, 4)
        with tempfile.TemporaryDirectory() as temporary:
            contents = write_narration_srt(cues, Path(temporary) / "safe.srt").read_text()
        self.assertIn("$(touch /tmp/unwanted)", contents)
        self.assertIn("{\\an8}", contents)
        self.assertIn("កាហ្វេ", contents)

    def test_khmer_coeng_does_not_split_from_following_consonant(self):
        self.assertEqual(_clusters("ខ្មែរ"), ["ខ្មែ", "រ"])

    def test_invalid_scene_timing_is_rejected(self):
        for duration in (0, -3, float("nan"), float("inf"), "invalid"):
            plan = _plan()
            plan["scenes"][0]["duration_seconds"] = duration
            with self.subTest(duration=duration), self.assertRaises(VideoFinishingError):
                narration_cues(plan, 4)

    def test_report_distinguishes_script_captions_from_audio_transcription(self):
        plan = _plan()
        metadata = {"duration_seconds": 70, "width": 720, "height": 1280, "has_audio": False}
        report = _quality_report(metadata, plan, narration_cues(plan, 70), Path("captions.srt"), 0)
        checks = {check["id"]: check for check in report["checks"]}
        self.assertEqual(checks["aspect_ratio"]["status"], "pass")
        self.assertEqual(checks["duration"]["status"], "warn")
        self.assertEqual(checks["audio"]["status"], "fail")
        self.assertEqual(checks["subtitle_alignment"]["status"], "warn")
        self.assertIn("not an audio transcript", checks["subtitle_alignment"]["detail"])

    def test_missing_processing_dependency_never_returns_raw_clip(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "raw.mp4"
            path.write_bytes(b"unprocessed")
            with patch("app.video_finishing._binary", side_effect=VideoFinishingError("Install FFmpeg")):
                with self.assertRaisesRegex(VideoFinishingError, "Install FFmpeg"):
                    finish_video(path, _plan(), [])
            self.assertEqual(path.read_bytes(), b"unprocessed")
            self.assertFalse(path.with_name("raw.finished.mp4").exists())

    def test_missing_text_glyphs_stop_finishing_instead_of_burning_broken_text(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)

            def fake_render(arguments, **kwargs):
                layout_arg = next(argument for argument in arguments if argument.startswith("--serialize-to="))
                Path(layout_arg.split("=", 1)[1]).write_text(json.dumps({"output": {"unknown-glyphs": 2}}))

            with patch("app.video_finishing._binary", return_value="pango-view"), patch(
                "app.video_finishing._run", side_effect=fake_render
            ):
                renderer = _TextRenderer(directory, "km")
                with self.assertRaisesRegex(VideoFinishingError, "font cannot display"):
                    renderer.fit("ខ្មែរ", 600, 100)

    def test_omitted_offer_is_intentional_and_short_video_needs_review(self):
        plan = _plan()
        plan["offer"] = ""
        metadata = {"duration_seconds": 4, "width": 720, "height": 1280,
                    "has_audio": True, "max_volume_db": -8}
        report = _quality_report(metadata, plan, narration_cues(plan, 4), Path("captions.srt"), 0)
        checks = {check["id"]: check for check in report["checks"]}
        self.assertEqual(checks["offer"]["status"], "pass")
        self.assertEqual(checks["offer"]["detail"], "No offer supplied; no offer added.")
        self.assertEqual(checks["duration"]["status"], "warn")


def _tool(name):
    return shutil.which(name) or (str(Path("/opt/homebrew/bin") / name)
                                 if (Path("/opt/homebrew/bin") / name).exists() else None)


@unittest.skipUnless(_tool("ffmpeg") and _tool("ffprobe"), "FFmpeg integration tools not installed")
class SyntheticVideoFinishingTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def _video(self, *, audio=True):
        path = self.root / ("with-audio.mp4" if audio else "silent.mp4")
        command = [str(_tool("ffmpeg")), "-hide_banner", "-loglevel", "error", "-y",
                   "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=15:d=4"]
        if audio:
            command += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=4"]
        command += ["-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p"]
        if audio:
            command += ["-c:a", "aac"]
        command += [str(path)]
        subprocess.run(command, capture_output=True, check=True, timeout=30)
        return path

    def _frame(self, video, at):
        frame = self.root / f"frame-{at}.png"
        subprocess.run([str(_tool("ffmpeg")), "-hide_banner", "-loglevel", "error", "-y",
                        "-ss", str(at), "-i", str(video), "-frames:v", "1", str(frame)],
                       capture_output=True, check=True, timeout=30)
        with Image.open(frame) as image:
            return image.convert("RGB")

    def test_actual_encoder_creates_vertical_clip_audio_subtitles_and_closing_card(self):
        original = self._video()
        finished, report = finish_video(original, _plan(), [])
        self.assertTrue(original.exists())
        self.assertNotEqual(original, finished)
        metadata = probe_video(finished)
        self.assertEqual((metadata["width"], metadata["height"]), (WIDTH, HEIGHT))
        self.assertTrue(metadata["has_audio"])
        self.assertAlmostEqual(metadata["duration_seconds"], 4, delta=.15)
        checks = {check["id"]: check for check in report["checks"]}
        self.assertEqual(checks["audio"]["status"], "pass")
        self.assertEqual(checks["contact"]["status"], "pass")
        contents = Path(report["subtitles_path"]).read_text()
        self.assertNotIn("SOCIAL CAPTION", contents)
        frame = self._frame(finished, 3.5)
        # White lettering was burned into the caption band, while the closing
        # card contains its cyan outline. This checks pixels in the actual MP4.
        caption_pixels = list(frame.crop((42, 910, 678, 1160)).get_flattened_data())
        self.assertGreater(sum(min(pixel) > 175 for pixel in caption_pixels), 250)
        closing_pixels = list(frame.crop((40, 340, 680, 910)).get_flattened_data())
        self.assertGreater(sum(pixel[1] > 140 and pixel[2] > 140 and pixel[0] < 150
                               for pixel in closing_pixels), 100)

    @unittest.skipUnless(_tool("pango-view"), "Pango text shaper not installed")
    def test_khmer_and_exact_selected_photo_are_actually_composed(self):
        original = self._video()
        asset = self.root / "brand's (real) photo.png"
        Image.new("RGB", (90, 70), (240, 20, 20)).save(asset)
        plan = _plan("km")
        plan["scenes"][0]["asset_id"] = "0"
        finished, report = finish_video(original, plan, [JobSource(kind="file", value=str(asset))])
        self.assertEqual(report["metadata"]["text_renderer"], "pango")
        self.assertIn("កាហ្វេ", Path(report["subtitles_path"]).read_text())
        frame = self._frame(finished, .5)
        pixel = frame.getpixel((360, 350))
        self.assertGreater(pixel[0], 210)
        self.assertLess(pixel[1], 45)
        # Khmer caption glyphs occupy the burned-in caption region.
        pixels = list(frame.crop((42, 910, 678, 1160)).get_flattened_data())
        self.assertGreater(sum(min(pixel) > 175 for pixel in pixels), 200)

    def test_missing_audio_is_reported_and_unknown_asset_is_rejected(self):
        original = self._video(audio=False)
        _, report = finish_video(original, _plan(), [])
        self.assertEqual(next(check["status"] for check in report["checks"]
                              if check["id"] == "audio"), "fail")
        plan = _plan()
        plan["scenes"][0]["asset_id"] = "../../private-photo.png"
        with self.assertRaisesRegex(VideoFinishingError, "unavailable brand photo"):
            finish_video(original, plan, [])


if __name__ == "__main__":
    unittest.main()
