"""Brand image uploads attach file sources for NotebookLM video generation."""

from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx
from PIL import Image

from app import webapp
from app.jobs.store import JobSource, JobStatus, JobStore
from app.notebooklm.client import generate_video_overview
from app.uploads import MAX_ASSETS, build_brand_assets_pdf


def _png_bytes(color=(40, 120, 200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(buffer, format="PNG")
    return buffer.getvalue()


class UploadHelpersTests(unittest.TestCase):
    def test_build_brand_assets_pdf_writes_multipage_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = []
            for index, color in enumerate([(10, 20, 30), (200, 100, 50)]):
                path = root / f"asset-{index}.png"
                path.write_bytes(_png_bytes(color))
                paths.append(path)
            pdf = build_brand_assets_pdf(paths, root / "brand-assets.pdf")
            self.assertTrue(pdf.is_file())
            self.assertGreater(pdf.stat().st_size, 100)


class BrandAssetApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.uploads_dir = Path(temp.name) / "uploads"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.store = JobStore(Path(temp.name) / "jobs.db")
        self.started: list[str] = []

        def create_and_start(**fields):
            start = fields.pop("start", True)
            job = self.store.create_job(
                chat_id=1, user_id=1, status=JobStatus.QUEUED, **fields
            )
            if start:
                self.started.append(job.id)
            return job

        self.runtime = SimpleNamespace(
            settings=SimpleNamespace(uploads_dir=self.uploads_dir),
            store=self.store,
            create_and_start=Mock(side_effect=create_and_start),
            start_job=Mock(side_effect=lambda job_id: self.started.append(job_id)),
        )
        webapp.app.dependency_overrides[webapp._require_user] = lambda: {"id": "account"}
        self.addCleanup(webapp.app.dependency_overrides.pop, webapp._require_user)
        runtime_patch = patch("app.webapp.get_runtime", return_value=self.runtime)
        settings_patch = patch(
            "app.webapp.resolve_settings_for_account",
            return_value=SimpleNamespace(
                allowed_telegram_user_id=1,
                gemini_api_keys=("test-key",),
                uploads_dir=self.uploads_dir,
            ),
        )
        runtime_patch.start()
        settings_patch.start()
        self.addCleanup(runtime_patch.stop)
        self.addCleanup(settings_patch.stop)
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=webapp.app), base_url="http://test"
        )
        self.addAsyncCleanup(self.client.aclose)

    async def test_multipart_create_saves_file_source_and_starts_job(self):
        response = await self.client.post(
            "/api/jobs",
            data={
                "brief": "Coffee shop launch",
                "notes": "Warm tone",
                "language": "en",
                "urls": "[]",
                "template": "",
            },
            files={
                "assets": ("logo.png", _png_bytes(), "image/png"),
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        job_id = response.json()["job"]["id"]
        job = self.store.get(job_id)
        file_sources = [source for source in job.sources if source.kind == "file"]
        self.assertEqual(len(file_sources), 1)
        self.assertTrue(Path(file_sources[0].value).is_file())
        self.assertEqual(file_sources[0].title, "logo.png")
        self.assertIn(job_id, self.started)

    async def test_rejects_too_many_assets(self):
        files = [
            ("assets", (f"logo-{index}.png", _png_bytes(), "image/png"))
            for index in range(MAX_ASSETS + 1)
        ]
        response = await self.client.post(
            "/api/jobs",
            data={"brief": "Coffee", "language": "en", "urls": "[]"},
            files=files,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("up to", response.json()["detail"].lower())

    async def test_rejects_unsupported_asset_type(self):
        response = await self.client.post(
            "/api/jobs",
            data={"brief": "Coffee", "language": "en", "urls": "[]"},
            files={"assets": ("notes.txt", b"hello", "text/plain")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported image type", response.json()["detail"])


class NotebookFileSourceTests(unittest.IsolatedAsyncioTestCase):
    async def test_file_sources_call_add_file_and_steer_brand_assets(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            image_path = root / "logo.png"
            image_path.write_bytes(_png_bytes())
            video_dir = root / "videos"
            video_dir.mkdir()
            uploads_dir = root / "uploads"
            uploads_dir.mkdir()

            async def download(_notebook_id, destination, **_kwargs):
                Path(destination).write_bytes(b"test video" * 150)

            client = SimpleNamespace(
                notebooks=SimpleNamespace(
                    create=AsyncMock(return_value=SimpleNamespace(id="notebook"))
                ),
                sources=SimpleNamespace(
                    add_text=AsyncMock(return_value=SimpleNamespace(id="text-source")),
                    add_file=AsyncMock(return_value=SimpleNamespace(id="file-source")),
                    add_url=AsyncMock(return_value=SimpleNamespace(id="url-source")),
                    wait_until_ready=AsyncMock(
                        return_value=SimpleNamespace(id="url-source")
                    ),
                ),
                artifacts=SimpleNamespace(
                    generate_video=AsyncMock(
                        return_value=SimpleNamespace(task_id="task")
                    ),
                    wait_for_completion=AsyncMock(
                        return_value=SimpleNamespace(status="completed", task_id="task")
                    ),
                    list_video=AsyncMock(return_value=[]),
                    download_video=AsyncMock(side_effect=download),
                ),
            )
            context = AsyncMock()
            context.__aenter__.return_value = client
            config = SimpleNamespace(
                gemini_api_keys=(),
                gemini_model="test-model",
                video_format="short",
                video_style="auto_select",
                video_language="en",
                video_timeout_minutes=1,
                video_poll_interval_seconds=10,
                skip_notebooklm=False,
                facebook_enabled=False,
                videos_dir=video_dir,
                uploads_dir=uploads_dir,
            )

            with patch("app.notebooklm.client.check_auth", return_value=True), patch(
                "app.notebooklm.client.NotebookLMClient.from_storage",
                return_value=context,
            ):
                await generate_video_overview(
                    config,
                    job_id="asset-job",
                    brief="Promote our coffee",
                    sources=[
                        JobSource(
                            kind="file",
                            value=str(image_path),
                            title="logo.png",
                        )
                    ],
                    steering_prompt="Keep it warm.",
                    video_format="short",
                    language="en",
                )

            client.sources.add_file.assert_awaited()
            self.assertEqual(
                Path(client.sources.add_file.await_args.args[1]), image_path
            )
            instructions = client.artifacts.generate_video.call_args.kwargs[
                "instructions"
            ]
            self.assertIn("logo.png", instructions)
            self.assertIn("do not invent a different logo", instructions.lower())


if __name__ == "__main__":
    unittest.main()
