"""Reviewed scripts survive rendering without a second creative draft."""

import copy
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.jobs.pipeline import Pipeline
from app.jobs.store import JobSource, JobStatus
from app.llm.storyboard_render import package_from_storyboard
from app.notebooklm.client import generate_video_overview
from app.storyboards import effective_storyboard


def plan(language="en"):
    return {
        "language": language, "title": "Lotus Coffee", "caption": "SOCIAL COPY ONLY",
        "business_name": "Lotus Coffee", "offer": "", "contact": "@lotuscoffee",
        "hooks": [{"id": "a", "text": "Your next coffee break."},
                  {"id": "b", "text": "Need a quiet study spot?"},
                  {"id": "c", "text": "Freshly roasted every morning."}],
        "selected_hook": "b",
        "scenes": [
            {"id": "open", "duration_seconds": 3, "narration": "Your next coffee break.",
             "on_screen_text": "Your next coffee break.", "visual_direction": "Coffee close-up", "asset_id": None},
            {"id": "benefit", "duration_seconds": 8, "narration": "Fresh coffee, with a quiet place to study.",
             "on_screen_text": "Fresh coffee", "visual_direction": "Show our actual shop", "asset_id": None},
            {"id": "end", "duration_seconds": 5, "narration": "Message Lotus Coffee at @lotuscoffee.",
             "on_screen_text": "@lotuscoffee", "visual_direction": "Business end card", "asset_id": None},
        ],
    }


class RenderBriefTests(unittest.TestCase):
    def test_selected_hook_and_exact_photo_are_passed_without_social_caption_as_narration(self):
        storyboard = effective_storyboard(plan())
        storyboard["scenes"][1]["asset_id"] = "0"
        sources = [JobSource(kind="file", value="/private/tmp/coffee.png", title="Our coffee photo")]
        package = package_from_storyboard("Original business facts", storyboard, sources)
        self.assertIn("SPOKEN NARRATION (verbatim): Need a quiet study spot?", package.source_text)
        self.assertIn("SELECTED UPLOADED PHOTO: Our coffee photo", package.source_text)
        self.assertIn("approximately 16 seconds", package.steering_prompt)
        self.assertNotIn("SOCIAL COPY ONLY", package.source_text)
        self.assertEqual(package.caption, "SOCIAL COPY ONLY")
        self.assertEqual(package.brief, "Original business facts")

    def test_khmer_render_prompt_keeps_the_final_language_instruction(self):
        package = package_from_storyboard("Original facts", effective_storyboard(plan("km")), [])
        self.assertTrue(package.steering_prompt.endswith("Make the video in Khmer language."))
        self.assertTrue(package.source_text.endswith("Make the video in Khmer language."))


class ReviewedPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def run_pipeline(self, report=None, finishing_error=None):
        storyboard = plan()
        job = SimpleNamespace(
            id="reviewed", brief="Original business facts", sources=[], language="en", chat_id=1,
            status=JobStatus.QUEUED, storyboard=copy.deepcopy(storyboard),
        )
        store = Mock()
        store.get.return_value = job
        bot = SimpleNamespace(send_message=AsyncMock())
        settings = SimpleNamespace(skip_notebooklm=False, facebook_enabled=True)
        pipeline = Pipeline(settings, store, bot)
        finisher = Mock(return_value=(Path("reviewed.finished.mp4"), report or {
            "processed": True, "checks": [{"id": "audio", "label": "Audio", "status": "pass", "detail": "Audible"}],
            "metadata": {"width": 720, "height": 1280, "has_audio": True},
        }), side_effect=finishing_error)
        with patch.object(pipeline, "_settings_for", return_value=settings), patch.object(
            pipeline, "_bot_for", return_value=bot
        ), patch.object(pipeline, "_send_preview", new_callable=AsyncMock) as preview, patch(
            "app.jobs.pipeline.draft_caption_package", side_effect=AssertionError("Must not redraft an approved plan")
        ) as draft, patch(
            "app.jobs.pipeline.generate_video_overview", new_callable=AsyncMock,
            return_value=("notebook", "artifact", Path("reviewed.mp4")),
        ) as video, patch("app.video_finishing.finish_video", finisher):
            await pipeline.run_generation(job.id)
        return store, preview, draft, video, finisher, job

    async def test_reviewed_script_is_finished_before_preview_without_rewriting_user_setup(self):
        store, preview, draft, video, finisher, job = await self.run_pipeline()
        draft.assert_not_called()
        self.assertIn("Need a quiet study spot?", video.call_args.kwargs["narration_script"])
        self.assertNotIn("SOCIAL COPY ONLY", video.call_args.kwargs["narration_script"])
        self.assertEqual(finisher.call_args.args[1]["scenes"][0]["narration"], "Need a quiet study spot?")
        preview.assert_awaited_once()
        self.assertEqual(preview.call_args.kwargs["video_path"], Path("reviewed.finished.mp4"))
        updates = [call.kwargs for call in store.update.call_args_list]
        self.assertTrue(any(update.get("quality_report", {}).get("processed") for update in updates))
        self.assertTrue(any(update.get("status") == JobStatus.AWAITING_APPROVAL for update in updates))
        self.assertTrue(all("brief" not in update and "sources" not in update for update in updates))
        self.assertEqual(job.storyboard, plan())

    async def test_failed_output_checks_do_not_send_a_publishable_preview(self):
        store, preview, _, _, _, _ = await self.run_pipeline(report={
            "processed": True, "metadata": {},
            "checks": [{"id": "audio", "label": "Audio", "status": "fail", "detail": "Silent audio"}],
        })
        preview.assert_not_awaited()
        self.assertTrue(any(call.kwargs.get("status") == JobStatus.FAILED for call in store.update.call_args_list))

    async def test_missing_finishing_dependency_reports_failure_and_retains_script(self):
        store, preview, _, _, _, _ = await self.run_pipeline(finishing_error=RuntimeError("ffmpeg missing"))
        preview.assert_not_awaited()
        reports = [call.kwargs["quality_report"] for call in store.update.call_args_list if "quality_report" in call.kwargs]
        self.assertFalse(reports[-1]["processed"])
        self.assertEqual(reports[-1]["checks"][0]["status"], "fail")


class NotebookApprovedNarrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_khmer_narration_is_separate_from_social_caption(self):
        with tempfile.TemporaryDirectory() as temporary:
            async def download(_notebook, destination, **kwargs):
                Path(destination).write_bytes(b"test" * 400)

            client = SimpleNamespace(
                notebooks=SimpleNamespace(create=AsyncMock(return_value=SimpleNamespace(id="notebook"))),
                sources=SimpleNamespace(add_text=AsyncMock(return_value=SimpleNamespace(id="source"))),
                artifacts=SimpleNamespace(
                    generate_video=AsyncMock(return_value=SimpleNamespace(task_id="task")),
                    wait_for_completion=AsyncMock(return_value=SimpleNamespace(status="completed", task_id="task")),
                    list_video=AsyncMock(return_value=[]), download_video=AsyncMock(side_effect=download),
                ),
            )
            context = AsyncMock()
            context.__aenter__.return_value = client
            settings = SimpleNamespace(
                video_language="en", video_format="short", video_style="auto_select",
                video_timeout_minutes=1, video_poll_interval_seconds=10, videos_dir=Path(temporary),
            )
            with patch("app.notebooklm.client.check_auth", return_value=True), patch(
                "app.notebooklm.client.NotebookLMClient.from_storage", return_value=context
            ):
                await generate_video_overview(
                    settings, job_id="reviewed", brief="Original facts", sources=[], steering_prompt="Use the script.",
                    video_format="short", language="km", title="Lotus", caption="SOCIAL COPY ONLY",
                    narration_script="សាកល្បងកាហ្វេរបស់យើង។",
                )
            documents = "\n".join(call.args[2] for call in client.sources.add_text.await_args_list)
            self.assertIn("សាកល្បងកាហ្វេរបស់យើង។", documents)
            self.assertNotIn("SOCIAL COPY ONLY", documents)
            instructions = client.artifacts.generate_video.call_args.kwargs["instructions"]
            self.assertTrue(instructions.endswith("Make the video in Khmer language."))


if __name__ == "__main__":
    unittest.main()
