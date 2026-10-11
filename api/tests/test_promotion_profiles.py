"""Promotion profiles survive reloads and remain private to their owner."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from app import webapp
from app.dependencies import require_user
from app.jobs.store import JobStore
from app.promotions.store import PromotionStore


class PromotionStoreTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "jobs.db"
        self.store = PromotionStore(self.path)

    def test_profiles_persist_alongside_existing_campaigns(self):
        jobs = JobStore(self.path)
        job = jobs.create_job(chat_id=1, user_id=1, brief="Existing campaign")
        promotion = self.store.create(
            account_id="owner", kind="shop", name=" ហាងកាហ្វេ ",
            description=" កាហ្វេស្រស់ និងនំ ", benefit=" Fresh every day ",
            location=" Phnom Penh ", website=" https://example.com/shop ",
        )

        reopened = PromotionStore(self.path)
        restored = reopened.get(promotion.id, account_id="owner")
        self.assertEqual(restored.name, "ហាងកាហ្វេ")
        self.assertEqual(restored.description, "កាហ្វេស្រស់ និងនំ")
        self.assertEqual(restored.website, "https://example.com/shop")
        self.assertEqual(restored.created_at, promotion.created_at)
        self.assertEqual(reopened.list_for_account("owner")[0].id, promotion.id)
        self.assertEqual(JobStore(self.path).get(job.id).brief, "Existing campaign")

    def test_store_lookup_requires_the_owning_account(self):
        promotion = self.store.create(
            account_id="alice", kind="product", name="Tea", description="Local tea",
        )
        self.assertIsNone(self.store.get(promotion.id, account_id="bob"))
        self.assertEqual(self.store.list_for_account("bob"), [])
        self.assertNotIn("account_id", promotion.public())


class PromotionApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "jobs.db"
        store_patch = patch("app.dependencies.DB_PATH", self.path)
        store_patch.start()
        self.addCleanup(store_patch.stop)
        self.user = {"id": "alice"}
        webapp.app.dependency_overrides[require_user] = lambda: self.user
        self.addCleanup(webapp.app.dependency_overrides.pop, require_user, None)
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=webapp.app), base_url="http://test",
        )
        self.addAsyncCleanup(self.client.aclose)

    async def test_saved_profiles_reuse_details_and_are_scoped_to_each_account(self):
        response = await self.client.post("/api/promotions", json={
            "kind": "shop", "name": " My cafe ", "description": " Fresh coffee ",
            "benefit": " Local beans ", "location": " Phnom Penh ",
            "website": " https://example.com ",
        })
        self.assertEqual(response.status_code, 201)
        saved = response.json()["promotion"]
        self.assertEqual(saved["name"], "My cafe")
        self.assertEqual(saved["benefit"], "Local beans")
        self.assertNotIn("account_id", saved)
        self.assertTrue(saved["created_at"])

        own = await self.client.get("/api/promotions")
        self.assertEqual(own.status_code, 200)
        self.assertEqual(own.json()["promotions"], [saved])
        self.user = {"id": "bob"}
        other = await self.client.get("/api/promotions")
        self.assertEqual(other.json()["promotions"], [])
        second = await self.client.post("/api/promotions", json={
            "kind": "service", "name": "Delivery", "description": "Fast local delivery",
        })
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["promotion"]["website"], "")
        self.user = {"id": "alice"}
        own_again = await self.client.get("/api/promotions")
        self.assertEqual(own_again.json()["promotions"], [saved])

    async def test_missing_or_invalid_details_are_rejected_before_persistence(self):
        valid = {"kind": "product", "name": "Tea", "description": "Fresh local tea"}
        invalid_fields = [
            {"kind": "unsupported"}, {"name": "  "}, {"description": "\n "},
            {"name": "x" * 121}, {"description": "x" * 1501},
            {"benefit": "x" * 1001}, {"location": "x" * 301},
            {"website": "x" * 501}, {"website": "javascript:alert(1)"},
            {"website": "example.com"}, {"website": "https://"},
            {"website": "https://example.com:not-a-port"},
            {"website": "https://example.com/white space"},
            {"account_id": "another-account"},
        ]
        for fields in invalid_fields:
            with self.subTest(fields=fields):
                response = await self.client.post("/api/promotions", json=valid | fields)
                self.assertEqual(response.status_code, 422)
        response = await self.client.post("/api/promotions", json={"name": "Incomplete"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(PromotionStore(self.path).list_for_account("alice"), [])

    async def test_routes_require_sign_in(self):
        webapp.app.dependency_overrides.pop(require_user, None)
        get_response = await self.client.get("/api/promotions")
        post_response = await self.client.post("/api/promotions", json={
            "kind": "other", "name": "Community", "description": "Local event",
        })
        self.assertEqual(get_response.status_code, 401)
        self.assertEqual(post_response.status_code, 401)
        self.assertFalse(self.path.exists())


if __name__ == "__main__":
    unittest.main()
