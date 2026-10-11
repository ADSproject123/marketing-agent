"""Placeholder demo URLs must not be crawled by NotebookLM."""

from __future__ import annotations

import unittest

from app.notebooklm.client import _is_placeholder_url


class PlaceholderUrlTests(unittest.TestCase):
    def test_example_hosts_are_placeholders(self):
        self.assertTrue(_is_placeholder_url("https://example.com/soriya-coffee"))
        self.assertTrue(_is_placeholder_url("https://www.example.org/path"))
        self.assertTrue(_is_placeholder_url("http://localhost:3000"))

    def test_real_hosts_are_not_placeholders(self):
        self.assertFalse(_is_placeholder_url("https://soriya.coffee"))
        self.assertFalse(_is_placeholder_url("https://youtube.com/watch?v=abc"))


if __name__ == "__main__":
    unittest.main()
