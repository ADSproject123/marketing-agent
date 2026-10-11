"""Weekly 3-in-1 campaign planner unit tests."""

from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.llm.caption import _normalize_weekly_posts, draft_weekly_plan
from app.routers import campaign as campaign_router
from app.schemas import WeeklyPlanRequest


def _settings(**overrides):
    values = {
        "gemini_api_keys": ("test-key",),
        "gemini_model": "test-model",
        "video_language": "en",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


SAMPLE_POSTS = [
    {
        "day": "monday",
        "role": "awareness",
        "title": "Tired of burnt coffee?",
        "angle": "Open on the everyday pain of rushed mornings.",
        "cta": "Visit this week",
        "brief_delta": "Focus on the customer pain point of burnt office coffee.",
        "notes_delta": "Hook in 3 seconds; soft educational tone.",
    },
    {
        "day": "wednesday",
        "role": "product",
        "title": "Meet the daily roast",
        "angle": "Show why the product solves the Monday problem.",
        "cta": "Try a cup",
        "brief_delta": "Highlight taste, freshness, and neighborhood convenience.",
        "notes_delta": "Product demo beat; keep claims from the brief only.",
    },
    {
        "day": "friday",
        "role": "offer",
        "title": "Weekend café reset",
        "angle": "Create light urgency for a weekend visit.",
        "cta": "Come this weekend",
        "brief_delta": "Close with a clear visit CTA using only supplied offer details.",
        "notes_delta": "Urgency without inventing discounts.",
    },
]


class WeeklyPlanNormalizeTests(unittest.TestCase):
    def test_normalizes_exact_three_posts(self):
        posts = _normalize_weekly_posts({"posts": SAMPLE_POSTS}, language="en")
        self.assertEqual(len(posts), 3)
        self.assertEqual([p["day"] for p in posts], ["monday", "wednesday", "friday"])
        self.assertEqual([p["role"] for p in posts], ["awareness", "product", "offer"])

    def test_rejects_wrong_count(self):
        with self.assertRaises(ValueError):
            _normalize_weekly_posts({"posts": SAMPLE_POSTS[:2]}, language="en")

    def test_rejects_incomplete_post(self):
        bad = [{**SAMPLE_POSTS[0], "title": ""}, SAMPLE_POSTS[1], SAMPLE_POSTS[2]]
        with self.assertRaises(ValueError):
            _normalize_weekly_posts({"posts": bad}, language="en")


class WeeklyPlanDraftTests(unittest.TestCase):
    def test_draft_weekly_plan_returns_posts(self):
        with patch(
            "app.llm.caption._generate_with_key",
            return_value=json.dumps({"posts": SAMPLE_POSTS}),
        ):
            posts = draft_weekly_plan(
                _settings(),
                brief="BUSINESS CAMPAIGN BRIEF\nName: Soriya Coffee",
                notes="Keep it warm and local.",
                language="en",
            )
        self.assertEqual(posts[0]["title"], "Tired of burnt coffee?")
        self.assertEqual(posts[2]["role"], "offer")

    def test_missing_gemini_key_raises(self):
        with self.assertRaises(ValueError) as ctx:
            draft_weekly_plan(_settings(gemini_api_keys=()), brief="Cafe", language="en")
        self.assertIn("Gemini", str(ctx.exception))

    def test_invalid_json_raises(self):
        with patch("app.llm.caption._generate_with_key", return_value="not-json"):
            with self.assertRaises(ValueError):
                draft_weekly_plan(_settings(), brief="Cafe", language="en")


class WeeklyPlanRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_returns_posts(self):
        runtime = SimpleNamespace(settings=_settings())
        body = WeeklyPlanRequest(brief="Cafe brief", notes="Notes", language="en")
        with (
            patch.object(campaign_router.runtime_mod, "get_runtime", return_value=runtime),
            patch.object(
                campaign_router,
                "resolve_settings_for_account",
                return_value=_settings(),
            ),
            patch.object(
                campaign_router,
                "draft_weekly_plan",
                return_value=SAMPLE_POSTS,
            ) as draft,
        ):
            result = await campaign_router.campaign_weekly_plan(body, user={"id": "u1"})
        self.assertEqual(len(result["posts"]), 3)
        draft.assert_called_once()

    async def test_route_missing_key_is_400(self):
        runtime = SimpleNamespace(settings=_settings(gemini_api_keys=()))
        body = WeeklyPlanRequest(brief="Cafe", language="en")
        with (
            patch.object(campaign_router.runtime_mod, "get_runtime", return_value=runtime),
            patch.object(
                campaign_router,
                "resolve_settings_for_account",
                return_value=_settings(gemini_api_keys=()),
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await campaign_router.campaign_weekly_plan(body, user={"id": "u1"})
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_route_invalid_plan_is_400(self):
        runtime = SimpleNamespace(settings=_settings())
        body = WeeklyPlanRequest(brief="Cafe", language="en")
        with (
            patch.object(campaign_router.runtime_mod, "get_runtime", return_value=runtime),
            patch.object(
                campaign_router,
                "resolve_settings_for_account",
                return_value=_settings(),
            ),
            patch.object(
                campaign_router,
                "draft_weekly_plan",
                side_effect=ValueError("bad plan"),
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await campaign_router.campaign_weekly_plan(body, user={"id": "u1"})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "bad plan")


if __name__ == "__main__":
    unittest.main()
