"""Unit coverage for URL campaign ingestion helpers."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from app.campaign_ingest import CampaignIngestDraft, _normalize_url, _page_excerpt, extract_campaign_draft


class CampaignIngestTests(unittest.TestCase):
    def test_normalize_url_adds_https_and_rejects_localhost(self):
        self.assertEqual(_normalize_url("example.com/menu"), "https://example.com/menu")
        with self.assertRaises(ValueError):
            _normalize_url("http://localhost/secret")
        with self.assertRaises(ValueError):
            _normalize_url("ftp://example.com")

    def test_page_excerpt_reads_title_meta_and_text(self):
        html = """
        <html><head>
          <title>Soriya Coffee</title>
          <meta name="description" content="Fresh beans in Phnom Penh" />
          <meta property="og:image" content="https://cdn.example/coffee.jpg" />
        </head><body>
          <h1>Neighborhood cafe</h1>
          <p>Quiet workspace and local roast.</p>
          <script>evil()</script>
        </body></html>
        """
        page = _page_excerpt(html)
        self.assertEqual(page["title"], "Soriya Coffee")
        self.assertIn("Fresh beans", page["meta_description"])
        self.assertIn("Quiet workspace", page["raw_content"])
        self.assertNotIn("evil", page["raw_content"])
        self.assertEqual(page["og_image"], "https://cdn.example/coffee.jpg")

    def test_extract_campaign_draft_normalizes_enums(self):
        settings = type("S", (), {"gemini_api_keys": ("key",), "gemini_model": "model"})()
        payload = {
            "name": "Soriya Coffee",
            "kind": "cafe",
            "description": "Local roast cafe",
            "benefit": "Quiet workspace",
            "location": "Phnom Penh",
            "website": "",
            "goal": "grow",
            "cta": "order",
            "audience": "Students",
        }
        with patch("app.campaign_ingest.llm._generate_with_key", return_value=__import__("json").dumps(payload)):
            draft = extract_campaign_draft(
                settings,
                url="https://example.com",
                page={"title": "Soriya", "meta_description": "", "raw_content": "Coffee"},
            )
        self.assertEqual(draft["kind"], "shop")
        self.assertEqual(draft["goal"], "sales")
        self.assertEqual(draft["cta"], "visit")
        self.assertEqual(draft["website"], "https://example.com")
        self.assertEqual(CampaignIngestDraft.model_validate(draft).name, "Soriya Coffee")


if __name__ == "__main__":
    unittest.main()
