"""Campaign language is validated, persisted, and isolated per job."""

import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx

from app import webapp
from app.jobs.store import JobStatus, JobStore
from app.runtime import Runtime


class JobLanguageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "jobs.db"
        self.store = JobStore(self.path)

    def test_language_survives_reopening_and_other_job_updates(self):
        khmer = self.store.create_job(chat_id=1, user_id=1, brief="Coffee", language="km")
        english = self.store.create_job(chat_id=1, user_id=1, brief="Launch")
        self.store.update(khmer.id, status=JobStatus.GENERATING, caption="សួស្តី")

        reopened = JobStore(self.path)
        self.assertEqual(reopened.get(khmer.id).language, "km")
        self.assertEqual(reopened.get(english.id).language, "en")

    def test_existing_database_migrates_without_losing_campaigns(self):
        old = self.store.create_job(chat_id=1, user_id=1, brief="Existing campaign")
        with sqlite3.connect(self.path) as conn:
            # Recreate the pre-language schema, retaining its existing records.
            columns = [row[1] for row in conn.execute("PRAGMA table_info(jobs)") if row[1] != "language"]
            conn.execute(f"CREATE TABLE legacy_jobs AS SELECT {', '.join(columns)} FROM jobs")
            conn.execute("DROP TABLE jobs")
            conn.execute("ALTER TABLE legacy_jobs RENAME TO jobs")

        migrated = JobStore(self.path)
        self.assertEqual(migrated.get(old.id).language, "en")
        self.assertEqual(migrated.get(old.id).brief, "Existing campaign")
        khmer = migrated.create_job(chat_id=1, user_id=1, brief="New campaign", language="km")
        self.assertEqual(migrated.get(khmer.id).language, "km")

    def test_unsupported_language_cannot_be_stored(self):
        with self.assertRaises(ValueError):
            self.store.create_job(chat_id=1, user_id=1, brief="Coffee", language="fr")
        self.assertEqual(self.store.list_recent_all(), [])

    def test_runtime_forwards_language_without_changing_shared_settings(self):
        settings = SimpleNamespace(allowed_telegram_user_id=1, video_language="en")
        runtime = Runtime(settings, self.store, Mock(), Mock(), None, set())
        with patch("app.runtime.resolve_settings_for_account", return_value=settings), patch.object(runtime, "start_job") as start:
            job = runtime.create_and_start(brief="Coffee", language="km", owner_account_id="account")

        self.assertEqual(self.store.get(job.id).language, "km")
        self.assertEqual(settings.video_language, "en")
        start.assert_called_once_with(job.id)


class CampaignLanguageApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.store = JobStore(Path(temp.name) / "jobs.db")
        self.runtime = SimpleNamespace(settings=SimpleNamespace(), create_and_start=Mock(side_effect=self._create))
        webapp.app.dependency_overrides[webapp._require_user] = lambda: {"id": "account"}
        self.addCleanup(webapp.app.dependency_overrides.pop, webapp._require_user)
        runtime_patch = patch("app.webapp.get_runtime", return_value=self.runtime)
        settings_patch = patch("app.webapp.resolve_settings_for_account", return_value=SimpleNamespace(allowed_telegram_user_id=1, gemini_api_keys=("test-key",)))
        runtime_patch.start()
        settings_patch.start()
        self.addCleanup(runtime_patch.stop)
        self.addCleanup(settings_patch.stop)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=webapp.app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)

    def _create(self, **fields):
        fields.pop("start", None)
        return self.store.create_job(chat_id=1, user_id=1, status=JobStatus.QUEUED, **fields)

    async def test_each_supported_language_reaches_the_job_and_response(self):
        for language in ("km", "en"):
            with self.subTest(language=language):
                response = await self.client.post("/api/jobs", json={"brief": "Coffee", "language": language})
                self.assertEqual(response.status_code, 200)
                job = response.json()["job"]
                self.assertEqual(job["language"], language)
                self.assertEqual(self.store.get(job["id"]).language, language)

    async def test_omitting_language_keeps_english_default(self):
        response = await self.client.post("/api/jobs", json={"brief": "Coffee"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["job"]["language"], "en")

    async def test_unsupported_language_rejected_before_generation(self):
        response = await self.client.post("/api/jobs", json={"brief": "Coffee", "language": "fr"})
        self.assertEqual(response.status_code, 422)
        self.runtime.create_and_start.assert_not_called()
        self.assertEqual(self.store.list_recent_all(), [])


if __name__ == "__main__":
    unittest.main()
