"""Language generation checks without Gemini, NotebookLM, or Telegram requests."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.jobs.pipeline import Pipeline
from app.llm.caption import CaptionPackage, draft_caption_package
from app.notebooklm.client import generate_video_overview


def settings_for_generation(**overrides):
    values = {
        "gemini_api_keys": (),
        "gemini_model": "test-model",
        "video_format": "short",
        "video_style": "auto_select",
        "video_language": "en",
        "video_timeout_minutes": 1,
        "video_poll_interval_seconds": 10,
        "skip_notebooklm": False,
        "facebook_enabled": False,
        "uploads_dir": Path(tempfile.gettempdir()) / "marketing-agent-uploads",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class CaptionLanguageTests(unittest.TestCase):
    def test_khmer_fallback_does_not_reuse_english_input_as_generated_copy(self):
        package = draft_caption_package(
            settings_for_generation(), "Launch an English-language product", language="km"
        )

        for text in (package.brief, package.title, package.caption, package.source_text):
            self.assertRegex(text, "[\u1780-\u17ff]")
            self.assertNotIn("Launch an English-language product", text)
        self.assertRegex(package.steering_prompt, "[\u1780-\u17ff]")
        self.assertTrue(package.steering_prompt.endswith("Make the video in Khmer language."))
        self.assertNotIn("{instructions}", package.steering_prompt)

    def test_selected_language_overrides_settings_and_source_language(self):
        with patch("app.llm.caption._generate_with_key", return_value="{}") as generate:
            package = draft_caption_package(
                settings_for_generation(gemini_api_keys=("test-key",)),
                "New summer collection",
                language="km",
            )

        prompt = generate.call_args.kwargs["user_prompt"]
        self.assertIn("Required output language: Khmer (ខ្មែរ) (km)", prompt)
        self.assertIn("New summer collection", prompt)
        self.assertIn("Keep JSON keys in English", prompt)
        self.assertTrue(prompt.endswith("Make the video in Khmer language."))
        for text in (package.brief, package.title, package.caption, package.source_text):
            self.assertRegex(text, "[\u1780-\u17ff]")
        self.assertNotIn("Campaign brief:", package.source_text)
        self.assertTrue(package.steering_prompt.endswith("Make the video in Khmer language."))

    def test_english_choice_overrides_khmer_default(self):
        response = json.dumps({
            "brief": "Introduce our new collection.",
            "title": "A fresh start",
            "caption": "Meet your new favorites.",
            "source_text": "Collection details. " * 12,
            "steering_prompt": "Create a vertical short video.",
        })
        with patch("app.llm.caption._generate_with_key", return_value=response) as generate:
            package = draft_caption_package(
                settings_for_generation(gemini_api_keys=("test-key",), video_language="km"),
                "បង្ហាញផលិតផលថ្មី",
                language="en",
            )

        self.assertIn("Required output language: English (en)", generate.call_args.kwargs["user_prompt"])
        self.assertEqual(package.caption, "Meet your new favorites.")
        self.assertIn("Output language: English (en)", package.steering_prompt)

    def test_omitted_language_uses_configured_default(self):
        package = draft_caption_package(settings_for_generation(video_language="km"))
        self.assertRegex(package.caption, "[\u1780-\u17ff]")


class NotebookLanguageTests(unittest.IsolatedAsyncioTestCase):
    async def test_khmer_prompt_drives_video_language_with_supported_request_option(self):
        with tempfile.TemporaryDirectory() as temporary:
            video_dir = Path(temporary)

            async def download(_notebook_id, destination, **_kwargs):
                Path(destination).write_bytes(b"test video" * 150)

            client = SimpleNamespace(
                notebooks=SimpleNamespace(create=AsyncMock(return_value=SimpleNamespace(id="notebook"))),
                sources=SimpleNamespace(add_text=AsyncMock(return_value=SimpleNamespace(id="source"))),
                artifacts=SimpleNamespace(
                    generate_video=AsyncMock(return_value=SimpleNamespace(task_id="task")),
                    wait_for_completion=AsyncMock(return_value=SimpleNamespace(status="completed", task_id="task")),
                    list_video=AsyncMock(return_value=[]),
                    download_video=AsyncMock(side_effect=download),
                ),
            )
            context = AsyncMock()
            context.__aenter__.return_value = client
            config = settings_for_generation(videos_dir=video_dir)

            with patch("app.notebooklm.client.check_auth", return_value=True), patch(
                "app.notebooklm.client.NotebookLMClient.from_storage", return_value=context
            ):
                await generate_video_overview(
                    config,
                    job_id="khmer-job",
                    brief="សេចក្តីសង្ខេបយុទ្ធនាការជាភាសាខ្មែរ",
                    sources=[],
                    steering_prompt="បង្កើតវីដេអូខ្លីសម្រាប់ការផ្សព្វផ្សាយ។",
                    video_format="short",
                    language="km",
                    title="ចំណោងជើងសាកល្បង",
                    caption="សារផ្សព្វផ្សាយសំរាប់អក្សររត់",
                )

            arguments = client.artifacts.generate_video.call_args.kwargs
            self.assertEqual(arguments["language"], "en")
            self.assertIn("បង្កើតវីដេអូខ្លីសម្រាប់ការផ្សព្វផ្សាយ។", arguments["instructions"])
            self.assertIn("ប្រើភាសាខ្មែរ", arguments["instructions"])
            self.assertIn("burned-in Khmer captions", arguments["instructions"])
            self.assertIn("សារផ្សព្វផ្សាយសំរាប់អក្សររត់", arguments["instructions"])
            self.assertTrue(
                arguments["instructions"].endswith(
                    "Make the video in Khmer language with visible Khmer captions throughout."
                )
            )
            add_text_calls = client.sources.add_text.await_args_list
            self.assertGreaterEqual(len(add_text_calls), 2)
            self.assertEqual(add_text_calls[0].args[2], "សេចក្តីសង្ខេបយុទ្ធនាការជាភាសាខ្មែរ")
            self.assertIn("សារផ្សព្វផ្សាយសំរាប់អក្សររត់", add_text_calls[1].args[2])
            self.assertEqual(config.video_language, "en")


class PipelineLanguageTests(unittest.IsolatedAsyncioTestCase):
    async def test_job_language_is_used_for_caption_and_video_without_changing_settings(self):
        settings = settings_for_generation()
        job = SimpleNamespace(
            id="khmer-job", brief="English input", sources=[], language="km", chat_id=1
        )
        store = Mock()
        store.get.return_value = job
        bot = SimpleNamespace(send_message=AsyncMock())
        pipeline = Pipeline(settings, store, bot)
        package = CaptionPackage(
            brief="សេចក្តីសង្ខេប", title="ចំណងជើង", caption="សារផ្សព្វផ្សាយ",
            steering_prompt="Use Khmer.", source_text="ស្គ្រីបវីដេអូ", video_format="short",
        )

        with patch.object(pipeline, "_settings_for", return_value=settings), patch.object(
            pipeline, "_bot_for", return_value=bot
        ), patch.object(pipeline, "_send_preview", new_callable=AsyncMock), patch(
            "app.jobs.pipeline.draft_caption_package", return_value=package
        ) as draft, patch(
            "app.jobs.pipeline.generate_video_overview", new_callable=AsyncMock,
            return_value=("notebook", "artifact", Path("test.mp4")),
        ) as video:
            await pipeline.run_generation(job.id)

        self.assertEqual(draft.call_args.kwargs["language"], "km")
        self.assertEqual(video.call_args.kwargs["language"], "km")
        self.assertEqual(settings.video_language, "en")
        self.assertEqual(video.call_args.kwargs["brief"], package.brief)


if __name__ == "__main__":
    unittest.main()
