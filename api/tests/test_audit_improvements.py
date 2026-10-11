"""Tests for improvements identified in the audit report."""

from __future__ import annotations

import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx
import pytest

from app import config, webapp
from app.jobs.store import Job, JobSource, JobStatus, JobStore
from app.runtime import Runtime, reconcile_interrupted_jobs


class JobStoreWALAndPaginationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.db_path = Path(self.temp_dir.name) / "jobs.db"
        self.store = JobStore(self.db_path)

    def test_wal_mode_enabled(self):
        with self.store._connect() as conn:
            mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
            self.assertEqual(mode.lower(), "wal")

    def test_pagination_and_count(self):
        account = "test-user-123"
        for i in range(5):
            self.store.create_job(
                chat_id=1,
                user_id=1,
                brief=f"Campaign {i}",
                owner_account_id=account,
            )
        self.assertEqual(self.store.count_for_account(account), 5)
        page1 = self.store.list_recent_for_account(account, limit=2, offset=0)
        self.assertEqual(len(page1), 2)
        page2 = self.store.list_recent_for_account(account, limit=2, offset=2)
        self.assertEqual(len(page2), 2)
        page3 = self.store.list_recent_for_account(account, limit=2, offset=4)
        self.assertEqual(len(page3), 1)

    def test_reconcile_interrupted_jobs(self):
        # Create jobs in stuck statuses
        j1 = self.store.create_job(chat_id=1, user_id=1, brief="B1", status=JobStatus.GENERATING)
        j2 = self.store.create_job(chat_id=1, user_id=1, brief="B2", status=JobStatus.QUEUED)
        j3 = self.store.create_job(chat_id=1, user_id=1, brief="B3", status=JobStatus.POSTING)
        j4 = self.store.create_job(chat_id=1, user_id=1, brief="B4", status=JobStatus.AWAITING_APPROVAL)

        count = reconcile_interrupted_jobs(self.store)
        self.assertEqual(count, 3)

        self.assertEqual(self.store.get(j1.id).status, JobStatus.FAILED)
        self.assertIn("restarted", self.store.get(j1.id).error)
        self.assertEqual(self.store.get(j2.id).status, JobStatus.FAILED)
        self.assertEqual(self.store.get(j3.id).status, JobStatus.FAILED)
        # awaiting_approval is not interrupted/lost; it survives reboot
        self.assertEqual(self.store.get(j4.id).status, JobStatus.AWAITING_APPROVAL)


class ProductionSecretValidationTests(unittest.TestCase):
    def test_production_fails_without_secret(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "AUTH_SECRET": ""}):
            with self.assertRaises(RuntimeError):
                config.validate_production_secrets()

    def test_production_fails_with_dev_secret(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "AUTH_SECRET": config.DEV_AUTH_SECRET}):
            with self.assertRaises(RuntimeError):
                config.validate_production_secrets()

    def test_production_succeeds_with_secure_secret(self):
        secure = "a" * 32
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "AUTH_SECRET": secure}):
            config.validate_production_secrets()  # Should not raise


class WebApiAuditEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.store = JobStore(Path(temp.name) / "jobs.db")
        self.pipeline = Mock()
        self.pipeline.approve = AsyncMock()
        self.pipeline.deny = AsyncMock()
        self.runtime = Runtime(
            settings=Mock(),
            store=self.store,
            bot=Mock(),
            pipeline=self.pipeline,
            bot_hub=None,
            _running=set(),
            _tasks={},
        )
        self.account_id = "test-account"
        webapp.app.dependency_overrides[webapp._require_user] = lambda: {"id": self.account_id}
        self.addCleanup(webapp.app.dependency_overrides.pop, webapp._require_user)

        runtime_patch = patch("app.webapp.get_runtime", return_value=self.runtime)
        store_patch = patch("app.webapp._store", return_value=self.store)
        runtime_patch.start()
        store_patch.start()
        self.addCleanup(runtime_patch.stop)
        self.addCleanup(store_patch.stop)

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=webapp.app), base_url="http://test"
        )
        self.addAsyncCleanup(self.client.aclose)

    async def test_approve_job_endpoint(self):
        job = self.store.create_job(
            chat_id=1,
            user_id=1,
            brief="Approve me",
            status=JobStatus.AWAITING_APPROVAL,
            owner_account_id=self.account_id,
        )
        response = await self.client.post(f"/api/jobs/{job.id}/approve")
        self.assertEqual(response.status_code, 200)
        self.pipeline.approve.assert_awaited_once_with(job.id)

    async def test_deny_job_endpoint(self):
        job = self.store.create_job(
            chat_id=1,
            user_id=1,
            brief="Deny me",
            status=JobStatus.AWAITING_APPROVAL,
            owner_account_id=self.account_id,
        )
        response = await self.client.post(f"/api/jobs/{job.id}/deny")
        self.assertEqual(response.status_code, 200)
        self.pipeline.deny.assert_awaited_once_with(job.id)

    async def test_cancel_job_endpoint(self):
        job = self.store.create_job(
            chat_id=1,
            user_id=1,
            brief="Cancel me",
            status=JobStatus.QUEUED,
            owner_account_id=self.account_id,
        )
        response = await self.client.post(f"/api/jobs/{job.id}/cancel")
        self.assertEqual(response.status_code, 200)
        updated = self.store.get(job.id)
        self.assertEqual(updated.status, JobStatus.CANCELLED)

    async def test_paginated_list_jobs_endpoint(self):
        for i in range(7):
            self.store.create_job(
                chat_id=1,
                user_id=1,
                brief=f"Job {i}",
                owner_account_id=self.account_id,
            )
        response = await self.client.get("/api/jobs?limit=3&offset=0")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["jobs"]), 3)
        self.assertEqual(data["total"], 7)
        self.assertEqual(data["offset"], 0)
        self.assertEqual(data["limit"], 3)
