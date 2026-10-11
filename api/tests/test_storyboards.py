"""Scene drafts preserve facts, remain private, and render only after review."""

import copy
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx

from app import webapp
from app.jobs.store import JobSource, JobStatus, JobStore
from app.storyboards import Storyboard, draft_storyboard, effective_storyboard, revise_storyboard, validate_storyboard

BRIEF = "BUSINESS CAMPAIGN BRIEF\nName: My cafe\nLocation: Phnom Penh\nMain customer benefit: Fresh local coffee\nCall to action: Visit in person\nNo special offer supplied. Focus on the stated customer benefit; do not invent a promotion."


def plan():
    return {
        "language": "en", "title": "Fresh coffee", "caption": "Visit My cafe for fresh local coffee.",
        "business_name": "My cafe", "offer": "", "contact": "Phnom Penh",
        "telegram_username": "", "endcard_qr_asset_id": None,
        "bgm_track": "cozy_lofi", "bgm_volume": 0.22,
        "hooks": [{"id": "h1", "text": "Ready for fresh coffee?"},
                  {"id": "h2", "text": "Meet your next coffee stop."},
                  {"id": "h3", "text": "Your fresh coffee starts here."}],
        "selected_hook": "h1",
        "scenes": [
            {"id": "s1", "duration_seconds": 3, "narration": "Ready for fresh coffee?", "on_screen_text": "Ready for fresh coffee?", "visual_direction": "Coffee close-up", "asset_id": None},
            {"id": "s2", "duration_seconds": 12, "narration": "Fresh local coffee made for your next relaxing break at My cafe.", "on_screen_text": "Fresh local coffee", "visual_direction": "Warm product photo", "asset_id": None},
            {"id": "s3", "duration_seconds": 10, "narration": "Visit My cafe in Phnom Penh and enjoy your next fresh coffee today.", "on_screen_text": "Visit My cafe · Phnom Penh", "visual_direction": "Business ending", "asset_id": None},
        ],
    }


class StoryboardModelTests(unittest.TestCase):
    def test_selected_hook_is_the_rendered_first_scene(self):
        value = plan()
        value["selected_hook"] = "h2"
        effective = effective_storyboard(value)
        self.assertEqual(effective["scenes"][0]["narration"], value["hooks"][1]["text"])
        self.assertEqual(effective["scenes"][0]["on_screen_text"], value["hooks"][1]["text"])
        self.assertEqual(value["scenes"][0]["narration"], "Ready for fresh coffee?")

    def test_schema_rejects_bad_timeline_hook_ids_and_foreign_assets(self):
        for mutate in (
            lambda value: value.update(selected_hook="missing"),
            lambda value: value["scenes"][0].update(duration_seconds=7),
            lambda value: value["scenes"][1].update(duration_seconds=float("nan")),
            lambda value: value["scenes"][1].update(duration_seconds=True),
            lambda value: value["scenes"][1].update(id="s1"),
            lambda value: value["hooks"][1].update(id="h1"),
            lambda value: value["scenes"][1].update(asset_id="/etc/passwd"),
            lambda value: value.update(language="km"),
        ):
            value = plan()
            mutate(value)
            with self.assertRaises(ValueError):
                validate_storyboard(value, language="en", sources=[])
        value = plan()
        value["scenes"][1]["asset_id"] = "0"
        valid = validate_storyboard(value, language="en", sources=[JobSource(kind="file", value="asset.png")])
        self.assertEqual(valid["scenes"][1]["asset_id"], "0")

    def test_saved_business_metadata_is_immutable(self):
        value = plan()
        value["contact"] = "Invented phone"
        with self.assertRaisesRegex(ValueError, "Business details"):
            validate_storyboard(value, language="en", sources=[], original=plan())

    def test_generated_metadata_comes_from_original_facts(self):
        value = plan()
        value.update(business_name="Invented name", offer="50% off", contact="Fake number")
        settings = SimpleNamespace(gemini_api_keys=("key",), gemini_model="model")
        with patch("app.storyboards.llm._generate_with_key", return_value=json.dumps(value)):
            result = draft_storyboard(settings, BRIEF, [], language="en")
        self.assertEqual(result["business_name"], "My cafe")
        self.assertEqual(result["offer"], "")
        self.assertEqual(result["contact"], "Phnom Penh")

    def test_offer_timing_is_preserved_on_the_end_card_metadata(self):
        value = plan()
        settings = SimpleNamespace(gemini_api_keys=("key",), gemini_model="model")
        with patch("app.storyboards._call_json", return_value=value):
            result = draft_storyboard(settings, "BUSINESS CAMPAIGN BRIEF\nName: My cafe\nOffer: 10% off coffee\nOffer timing: This Friday", [], language="en")
        self.assertEqual(result["offer"], "10% off coffee · This Friday")

    def test_invented_offer_contact_and_khmer_discount_are_rejected(self):
        settings = SimpleNamespace(gemini_api_keys=("key",), gemini_model="model")
        for narration in ("Visit for 25% off.", "Call +855 12345678 today.", "បញ្ចុះតម្លៃឥឡូវនេះ"):
            value = plan()
            value["scenes"][1]["narration"] = narration
            with patch("app.storyboards.llm._generate_with_key", return_value=json.dumps(value)):
                with self.assertRaises(ValueError):
                    draft_storyboard(settings, BRIEF, [], language="en")

    def test_khmer_instruction_and_key_rotation_are_preserved(self):
        value = plan()
        value.update(language="km", title="កាហ្វេស្រស់", caption="មកហាងកាហ្វេរបស់យើង")
        settings = SimpleNamespace(gemini_api_keys=("first", "second"), gemini_model="model")
        with patch("app.storyboards.llm._active_key_index", 0), patch(
            "app.storyboards.llm._generate_with_key", side_effect=[RuntimeError("429 quota"), json.dumps(value)]
        ) as generate:
            result = draft_storyboard(settings, "សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម\nឈ្មោះ: ហាងកាហ្វេ\nទីតាំង: ភ្នំពេញ", [], language="km")
        self.assertEqual(result["business_name"], "ហាងកាហ្វេ")
        self.assertEqual(generate.call_args.kwargs["api_key"], "second")
        self.assertTrue(generate.call_args.kwargs["user_prompt"].endswith("Make the video in Khmer language."))
        self.assertIn("អ្នកជាអ្នកសរសេរ", generate.call_args.kwargs["system_instruction"])

    def test_hook_and_ending_revisions_cannot_change_unrelated_fields(self):
        original = plan()
        settings = SimpleNamespace(gemini_api_keys=("key",), gemini_model="model")
        hooks = copy.deepcopy(original["hooks"])
        hooks[0]["text"] = "Find your next coffee break."
        with patch("app.storyboards._call_json", return_value={"hooks": hooks, "business_name": "Fake"}):
            revised = revise_storyboard(settings, original, "stronger_hook", brief=BRIEF, sources=[])
        self.assertEqual(revised["scenes"][1:], original["scenes"][1:])
        self.assertEqual(revised["business_name"], original["business_name"])
        ending = copy.deepcopy(original["scenes"][-1])
        ending.update(id="foreign", asset_id="999", duration_seconds=1, narration="Visit My cafe in Phnom Penh today.")
        with patch("app.storyboards._call_json", return_value={"scene": ending}):
            revised = revise_storyboard(settings, original, "change_ending", brief=BRIEF, sources=[])
        self.assertEqual(revised["scenes"][:-1], original["scenes"][:-1])
        self.assertEqual(revised["scenes"][-1]["id"], "s3")
        self.assertEqual(revised["scenes"][-1]["duration_seconds"], 10)
        self.assertIsNone(revised["scenes"][-1]["asset_id"])

    def test_shorter_revision_must_shorten_spoken_text_and_preserve_assets(self):
        original = plan()
        settings = SimpleNamespace(gemini_api_keys=("key",), gemini_model="model")
        scenes = copy.deepcopy(original["scenes"])
        scenes[1]["duration_seconds"] = 8
        scenes[2]["duration_seconds"] = 7
        with patch("app.storyboards._call_json", return_value={"scenes": scenes}):
            with self.assertRaisesRegex(ValueError, "tighter narration"):
                revise_storyboard(settings, original, "shorter", brief=BRIEF, sources=[])
        scenes[1].update(narration="Enjoy fresh local coffee.", asset_id="fake", visual_direction="Fake")
        scenes[2]["narration"] = "Visit My cafe, Phnom Penh."
        with patch("app.storyboards._call_json", return_value={"scenes": scenes}):
            result = revise_storyboard(settings, original, "shorter", brief=BRIEF, sources=[])
        self.assertEqual(sum(scene["duration_seconds"] for scene in result["scenes"]), 18)
        self.assertIsNone(result["scenes"][1]["asset_id"])
        self.assertEqual(result["scenes"][1]["visual_direction"], "Warm product photo")


class StoryboardStoreTests(unittest.TestCase):
    def test_migration_preserves_old_jobs_and_unicode_plans(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "jobs.db"
            store = JobStore(path)
            job = store.create_job(chat_id=1, user_id=1, brief="Existing campaign")
            with sqlite3.connect(path) as connection:
                for field in ("storyboard", "quality_report", "language", "owner_account_id"):
                    connection.execute(f"ALTER TABLE jobs DROP COLUMN {field}")
            restored = JobStore(path)
            self.assertEqual(restored.get(job.id).brief, "Existing campaign")
            self.assertEqual(restored.get(job.id).language, "en")
            value = plan()
            value["title"] = "កាហ្វេស្រស់"
            restored.update(job.id, storyboard=value, quality_report={"ready": True})
            self.assertEqual(JobStore(path).get(job.id).storyboard["title"], "កាហ្វេស្រស់")
            self.assertTrue(JobStore(path).get(job.id).quality_report["ready"])

    def test_compare_and_save_rejects_stale_timestamp_and_duplicate_render(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = JobStore(Path(temporary) / "jobs.db")
            job = store.create_job(chat_id=1, user_id=1, brief=BRIEF, status=JobStatus.SCRIPT_REVIEW)
            first = store.save_storyboard(job.id, plan(), expected_updated_at=job.updated_at)
            with self.assertRaises(ValueError):
                store.save_storyboard(job.id, plan(), expected_updated_at=job.updated_at)
            store.save_storyboard(job.id, plan(), expected_updated_at=first.updated_at, status=JobStatus.QUEUED)
            with self.assertRaises(ValueError):
                store.save_storyboard(job.id, plan(), expected_updated_at=first.updated_at, status=JobStatus.QUEUED)


class StoryboardApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.store = JobStore(self.root / "jobs.db")
        self.settings = SimpleNamespace(allowed_telegram_user_id=1, gemini_api_keys=("key",), gemini_model="model", uploads_dir=self.root / "uploads", videos_dir=self.root / "videos")
        self.user = {"id": "owner"}
        webapp.app.dependency_overrides[webapp._require_user] = lambda: self.user
        self.addCleanup(webapp.app.dependency_overrides.pop, webapp._require_user, None)

        def create_and_start(**fields):
            start = fields.pop("start", True)
            self.assertFalse(start, "A draft must never start rendering")
            return self.store.create_job(chat_id=1, user_id=1, status=JobStatus.QUEUED, **fields)

        self.runtime = SimpleNamespace(settings=self.settings, store=self.store, _running=set(), create_and_start=Mock(side_effect=create_and_start), start_job=Mock())
        for name, value in (("get_runtime", self.runtime), ("resolve_settings_for_account", self.settings)):
            patcher = patch(f"app.webapp.{name}", return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=webapp.app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)

    def create_review(self, **fields):
        job = self.store.create_job(chat_id=1, user_id=1, brief=BRIEF, owner_account_id="owner", status=JobStatus.SCRIPT_REVIEW, **fields)
        return self.store.update(job.id, storyboard=plan())

    async def test_create_draft_then_explicit_render_starts_once(self):
        with patch("app.webapp.draft_storyboard", return_value=plan()):
            response = await self.client.post("/api/campaign-drafts", json={"brief": BRIEF, "language": "en"})
        self.assertEqual(response.status_code, 200, response.text)
        job = response.json()["job"]
        self.assertEqual(job["status"], "script_review")
        self.runtime.start_job.assert_not_called()
        edit = {"storyboard": job["storyboard"], "expected_updated_at": job["updated_at"]}
        first = await self.client.post(f"/api/jobs/{job['id']}/render", json=edit)
        second = await self.client.post(f"/api/jobs/{job['id']}/render", json=edit)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 409)
        self.runtime.start_job.assert_called_once_with(job["id"])
        self.assertEqual(first.json()["job"]["status"], "queued")

    async def test_ownership_and_stale_edits_are_guarded(self):
        job = self.create_review()
        edit = {"storyboard": plan(), "expected_updated_at": job.updated_at}
        self.user = {"id": "other"}
        for path, method, body in (("", "get", None), ("/storyboard", "put", edit), ("/render", "post", edit), ("/revise", "post", edit | {"action": "shorter"}), ("/redraft", "post", {})):
            response = await self.client.request(method, f"/api/jobs/{job.id}{path}", json=body)
            self.assertEqual(response.status_code, 404)
        self.user = {"id": "owner"}
        first = await self.client.put(f"/api/jobs/{job.id}/storyboard", json=edit)
        second = await self.client.put(f"/api/jobs/{job.id}/storyboard", json=edit)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)

    async def test_revision_failure_does_not_replace_saved_plan(self):
        job = self.create_review()
        with patch("app.webapp.revise_storyboard", side_effect=ValueError("Please retry")):
            response = await self.client.post(f"/api/jobs/{job.id}/revise", json={"storyboard": plan(), "expected_updated_at": job.updated_at, "action": "shorter"})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(self.store.get(job.id).storyboard, plan())
        self.assertEqual(self.store.get(job.id).updated_at, job.updated_at)

    async def test_finished_revision_clones_assets_and_keeps_prior_approval(self):
        job = self.create_review()
        image = self.settings.uploads_dir / job.id / "logo.png"
        image.parent.mkdir(parents=True)
        image.write_bytes(b"test image")
        job = self.store.update(job.id, sources=[JobSource(kind="file", value=str(image), title="Logo")], status=JobStatus.AWAITING_APPROVAL, telegram_preview_message_id=42)
        response = await self.client.post(f"/api/jobs/{job.id}/redraft", json={})
        self.assertEqual(response.status_code, 200, response.text)
        clone = self.store.get(response.json()["job"]["id"])
        self.assertNotEqual(clone.id, job.id)
        self.assertEqual(clone.status, JobStatus.SCRIPT_REVIEW)
        self.assertEqual(clone.brief, job.brief)
        self.assertEqual(clone.storyboard, job.storyboard)
        self.assertTrue(Path(clone.sources[0].value).is_file())
        self.assertNotEqual(clone.sources[0].value, str(image))
        self.assertEqual(self.store.get(job.id).telegram_preview_message_id, 42)
        self.assertEqual(self.store.get(job.id).status, JobStatus.AWAITING_APPROVAL)
        self.runtime.start_job.assert_not_called()

    async def test_private_media_requires_owner_and_scoped_recorded_path(self):
        job = self.create_review()
        image = self.settings.uploads_dir / job.id / "logo.png"
        image.parent.mkdir(parents=True)
        image.write_bytes(b"image")
        video = self.settings.videos_dir / "finished.mp4"
        video.parent.mkdir(parents=True)
        video.write_bytes(b"video")
        job = self.store.update(job.id, sources=[JobSource(kind="file", value=str(image), title="Logo")], video_path=str(video), quality_report={"ready": True, "subtitles_path": "/private/file.srt"})
        response = await self.client.get(f"/api/jobs/{job.id}")
        payload = response.json()
        self.assertEqual(payload["assets"][0]["id"], "0")
        self.assertNotIn("subtitles_path", payload["quality_report"])
        self.assertEqual((await self.client.get(payload["assets"][0]["url"])).content, b"image")
        self.assertEqual((await self.client.get(payload["video_url"])).content, b"video")
        self.user = {"id": "other"}
        self.assertEqual((await self.client.get(payload["video_url"])).status_code, 404)
        self.assertEqual((await self.client.get(payload["assets"][0]["url"])).status_code, 404)
        self.user = {"id": "owner"}
        self.store.update(job.id, video_path=str(self.root / "jobs.db"))
        self.assertEqual((await self.client.get(payload["video_url"])).status_code, 404)

    async def test_failed_render_can_retry_but_active_runner_cannot_edit(self):
        job = self.create_review()
        job = self.store.update(job.id, status=JobStatus.FAILED)
        edit = {"storyboard": plan(), "expected_updated_at": job.updated_at}
        self.runtime._running.add(job.id)
        self.assertEqual((await self.client.put(f"/api/jobs/{job.id}/storyboard", json=edit)).status_code, 409)
        self.runtime._running.clear()
        self.assertEqual((await self.client.post(f"/api/jobs/{job.id}/render", json=edit)).status_code, 200)

    async def test_failed_initial_draft_retries_saved_setup_without_rendering(self):
        with patch("app.webapp.draft_storyboard", side_effect=ValueError("Temporary error")):
            response = await self.client.post("/api/campaign-drafts", json={"brief": BRIEF, "language": "en"})
        self.assertEqual(response.status_code, 502)
        failed = self.store.list_recent_for_account("owner")[0]
        self.assertEqual(failed.status, JobStatus.FAILED)
        self.assertEqual(failed.brief, BRIEF)
        with patch("app.webapp.draft_storyboard", return_value=plan()):
            retried = await self.client.post(f"/api/jobs/{failed.id}/draft", json={"expected_updated_at": failed.updated_at})
        self.assertEqual(retried.status_code, 200, retried.text)
        self.assertEqual(retried.json()["job"]["status"], "script_review")
        self.assertEqual(retried.json()["job"]["id"], failed.id)
        self.runtime.start_job.assert_not_called()
        duplicate = await self.client.post(f"/api/jobs/{failed.id}/draft", json={"expected_updated_at": failed.updated_at})
        self.assertEqual(duplicate.status_code, 409)


if __name__ == "__main__":
    unittest.main()
