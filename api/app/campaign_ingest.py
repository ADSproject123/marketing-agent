"""One-click campaign draft extraction from a public website URL."""

from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import Settings
from app.llm import caption as llm

ALLOWED_KINDS = frozenset({"shop", "product", "service", "other"})
ALLOWED_GOALS = frozenset({"sales", "awareness", "launch"})
ALLOWED_CTAS = frozenset({"visit", "message", "buy", "learn"})


class CampaignIngestDraft(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    name: str = Field(default="", max_length=120)
    kind: str = Field(default="shop", max_length=40)
    description: str = Field(default="", max_length=1000)
    benefit: str = Field(default="", max_length=500)
    location: str = Field(default="", max_length=300)
    website: str = Field(default="", max_length=500)
    goal: str = Field(default="sales", max_length=40)
    cta: str = Field(default="visit", max_length=40)
    audience: str = Field(default="", max_length=500)

    @field_validator("kind")
    @classmethod
    def normalize_kind(cls, value: str) -> str:
        value = (value or "shop").lower().strip()
        return value if value in ALLOWED_KINDS else "shop"

    @field_validator("goal")
    @classmethod
    def normalize_goal(cls, value: str) -> str:
        value = (value or "sales").lower().strip()
        return value if value in ALLOWED_GOALS else "sales"

    @field_validator("cta")
    @classmethod
    def normalize_cta(cls, value: str) -> str:
        value = (value or "visit").lower().strip()
        return value if value in ALLOWED_CTAS else "visit"


def _normalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        raise ValueError("Paste a website URL to import.")
    if re.match(r"^[a-z][a-z0-9+.-]*://", raw, re.I) and not re.match(r"^https?://", raw, re.I):
        raise ValueError("Enter a complete http:// or https:// website address.")
    if not re.match(r"^https?://", raw, re.I):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a complete http:// or https:// website address.")
    host = parsed.hostname.lower()
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"} or host.endswith(".local"):
        raise ValueError("Local addresses cannot be imported.")
    return parsed.geturl()


def _page_excerpt(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    meta_desc = ""
    desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if desc_tag and desc_tag.get("content"):
        meta_desc = str(desc_tag["content"]).strip()
    og_image = ""
    og_tag = soup.find("meta", attrs={"property": re.compile(r"^og:image$", re.I)})
    if og_tag and og_tag.get("content"):
        og_image = str(og_tag["content"]).strip()
    chunks = [
        node.get_text(" ", strip=True)
        for node in soup.find_all(["h1", "h2", "h3", "p", "li"])
        if node.get_text(" ", strip=True)
    ]
    raw_content = " ".join(chunks[:20])[:3000]
    return {
        "title": title[:300],
        "meta_description": meta_desc[:500],
        "og_image": og_image[:1000],
        "raw_content": raw_content,
    }


async def fetch_page(url: str) -> tuple[str, dict[str, str]]:
    normalized = _normalize_url(url)
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; MarketingAgent/1.0; +https://localhost)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(normalized, headers=headers)
    except httpx.HTTPError as exc:
        raise ValueError("Could not retrieve that webpage. Check the link and try again.") from exc
    if response.status_code >= 400:
        raise ValueError("Could not retrieve that webpage. Check the link and try again.")
    content_type = (response.headers.get("content-type") or "").lower()
    if "html" not in content_type and "text/" not in content_type:
        raise ValueError("That link does not look like a webpage we can import.")
    return str(response.url), _page_excerpt(response.text)


def extract_campaign_draft(settings: Settings, *, url: str, page: dict[str, str]) -> dict[str, Any]:
    keys = settings.gemini_api_keys
    if not keys:
        raise ValueError("Connect a Gemini API key before importing from a link.")
    prompt = (
        "Analyze this business webpage and extract structured facts for a short-form video campaign.\n"
        "Respond ONLY with JSON using these exact keys:\n"
        '{"name":"","kind":"shop|product|service|other","description":"",'
        '"benefit":"","location":"","website":"","goal":"sales|awareness|launch",'
        '"cta":"visit|message|buy|learn","audience":""}\n'
        "Use only facts supported by the page. Leave unknown fields empty. "
        "Do not invent prices, discounts, or testimonials.\n\n"
        f"URL: {url}\n"
        f"Title: {page.get('title', '')}\n"
        f"Meta description: {page.get('meta_description', '')}\n"
        f"Text: {page.get('raw_content', '')}\n"
    )
    last_error: BaseException | None = None
    with llm._key_lock:
        start = llm._active_key_index % len(keys)
    for offset in range(len(keys)):
        index = (start + offset) % len(keys)
        try:
            raw = llm._generate_with_key(
                api_key=keys[index],
                model=settings.gemini_model,
                user_prompt=prompt,
                system_instruction=(
                    "You extract factual business campaign fields from webpage text. "
                    "Never invent offers or contact details. Return JSON only."
                ),
                temperature=0.2,
            )
            data = llm._parse_json(raw)
            draft = CampaignIngestDraft.model_validate(data).model_dump()
            if not draft["website"]:
                draft["website"] = url
            with llm._key_lock:
                llm._active_key_index = index
            return draft
        except Exception as exc:
            last_error = exc
            if not llm._is_rotatable_error(exc):
                break
    raise ValueError("Could not extract campaign details from that page. Try another link.") from last_error


async def ingest_campaign_url(settings: Settings, url: str) -> dict[str, Any]:
    final_url, page = await fetch_page(url)
    draft = await asyncio.to_thread(
        extract_campaign_draft, settings, url=final_url, page=page,
    )
    return {"draft": draft, "og_image": page.get("og_image", ""), "url": final_url}
