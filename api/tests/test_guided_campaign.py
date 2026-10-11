"""Business campaigns preserve user facts instead of substituting demo campaigns."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.jobs.store import JobSource
from app.llm.caption import (
    GUIDED_TEMPERATURE,
    SYSTEM_PROMPT,
    _sources_blob,
    draft_caption_package,
)


def generation_settings(keys=()):
    return SimpleNamespace(
        gemini_api_keys=keys,
        gemini_model="test-model",
        video_language="en",
        video_format="short",
    )


class GuidedCampaignTests(unittest.TestCase):
    def test_unavailable_generator_never_substitutes_a_different_shop_or_offer(self):
        for heading, language in (
            ("BUSINESS CAMPAIGN BRIEF", "en"),
            ("សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម", "km"),
        ):
            with self.subTest(language=language), self.assertRaisesRegex(ValueError, "Please try again"):
                draft_caption_package(
                    generation_settings(),
                    f"{heading}\nName: Lotus Bakery\nBenefit: Fresh bread daily",
                    language=language,
                )

    def test_incomplete_generator_response_fails_instead_of_inventing_missing_copy(self):
        with patch("app.llm.caption._generate_with_key", return_value="{}"), self.assertRaisesRegex(
            ValueError, "Please try again"
        ):
            draft_caption_package(
                generation_settings(("test-key",)),
                "BUSINESS CAMPAIGN BRIEF\nName: Lotus Bakery\nNo special offer supplied.",
            )

    def test_valid_business_generation_keeps_fact_constraints_and_contact_notes(self):
        generated = {
            "brief": "Introduce Lotus Bakery and its fresh daily bread.",
            "title": "Meet Lotus Bakery",
            "caption": "Fresh bread, baked daily. Visit Lotus Bakery in Phnom Penh.",
            "steering_prompt": "Create a vertical short video of freshly baked bread.",
            "source_text": "Lotus Bakery offers fresh daily bread for families in Phnom Penh. " * 4,
        }
        sources = [JobSource(
            kind="text",
            title="Extra notes",
            value="Use only the supplied facts. " + "Creative direction. " * 55 + "Contact: https://lotus.example",
        )]
        with patch("app.llm.caption._generate_with_key", return_value=json.dumps(generated)) as generate:
            package = draft_caption_package(
                generation_settings(("test-key",)),
                "BUSINESS CAMPAIGN BRIEF\nName: Lotus Bakery\nNo special offer supplied.",
                sources,
            )

        prompt = generate.call_args.kwargs["user_prompt"]
        self.assertIn("Lotus Bakery", prompt)
        self.assertIn("No special offer supplied", prompt)
        self.assertIn("Contact: https://lotus.example", prompt)
        self.assertEqual(package.caption, generated["caption"])
        self.assertNotIn("20%", package.caption)
        self.assertIn("Never invent prices", SYSTEM_PROMPT)
        self.assertIn("selected customer action", SYSTEM_PROMPT)

    def test_quota_rotation_still_completes_the_same_business_campaign(self):
        generated = json.dumps({
            "brief": "Promote Lotus Bakery.", "title": "Lotus Bakery", "caption": "Fresh bread daily.",
            "steering_prompt": "Create a vertical short video.", "source_text": "Fresh bread daily. " * 10,
        })
        with patch("app.llm.caption._active_key_index", 0), patch(
            "app.llm.caption._generate_with_key", side_effect=[RuntimeError("429 quota exceeded"), generated]
        ) as generate:
            package = draft_caption_package(
                generation_settings(("first-key", "second-key")),
                "BUSINESS CAMPAIGN BRIEF\nName: Lotus Bakery",
            )

        self.assertEqual(generate.call_count, 2)
        self.assertEqual(package.title, "Lotus Bakery")

    def test_text_source_limit_retains_complete_api_notes(self):
        content = "x" * 3970 + "Final customer constraint"
        self.assertIn("Final customer constraint", _sources_blob([JobSource(kind="text", value=content)]))

    def test_guided_generation_rejects_invented_discount_when_no_offer(self):
        generated = {
            "brief": "Introduce Lotus Bakery.",
            "title": "Lotus Bakery",
            "caption": "Fresh bread daily with 20% off this weekend!",
            "steering_prompt": "Create a vertical short video.",
            "source_text": "HOOK (0-3s): Bread\nBEAT 1: Shop\nBEAT 2: Benefit\nBEAT 3: Visit\nCTA: Visit Lotus\n",
        }
        with patch("app.llm.caption._generate_with_key", return_value=json.dumps(generated)):
            with self.assertRaisesRegex(ValueError, "invented offers"):
                draft_caption_package(
                    generation_settings(("test-key",)),
                    "BUSINESS CAMPAIGN BRIEF\nName: Lotus Bakery\nNo special offer supplied.",
                )

    def test_guided_mode_uses_lower_temperature(self):
        generated = {
            "brief": "Introduce Lotus Bakery.",
            "title": "Lotus Bakery",
            "caption": "Fresh bread, baked daily.",
            "steering_prompt": "Create a vertical short video.",
            "source_text": "HOOK (0-3s): Bread\nBEAT 1: Shop\nBEAT 2: Benefit\nBEAT 3: Visit\nCTA: Visit Lotus\n",
        }
        with patch("app.llm.caption._generate_with_key", return_value=json.dumps(generated)) as generate:
            draft_caption_package(
                generation_settings(("test-key",)),
                "BUSINESS CAMPAIGN BRIEF\nName: Lotus Bakery\nNo special offer supplied.",
            )
        self.assertEqual(generate.call_args.kwargs["temperature"], GUIDED_TEMPERATURE)


if __name__ == "__main__":
    unittest.main()
