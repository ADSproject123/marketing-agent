"""Shared API constants (templates, URL patterns, storyboard limits)."""

from __future__ import annotations

import re

# Keep in sync with web/src/templates.js labels
TEMPLATE_LABELS = {
    "weekend_sale": "Weekend sale",
    "product_launch": "Product launch",
    "local_cafe": "Local cafe / F&B",
    "app_feature": "App / feature highlight",
    "seasonal": "Seasonal / holiday",
    "auto_gemini": "Let Gemini invent everything",
}

URL_RE = re.compile(r"https?://[^\s<>\"']+")

MIN_STORYBOARD_DURATION = 10.0
MAX_STORYBOARD_DURATION = 60.0
DURATION_EPSILON = 1e-6

# Khmer promotional phrases rejected when the brief supplies no offer.
PROMOTIONAL_TERMS_KM = (
    "បញ្ចុះតម្លៃ",
    "ឥតគិតថ្លៃ",
    "ទិញមួយថែមមួយ",
)

# Filename hints used only as a soft default for end-card QR selection.
QR_ASSET_FILENAME_HINTS = ("khqr", "bakong")
