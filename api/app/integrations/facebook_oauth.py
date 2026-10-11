"""Facebook Login OAuth — connect a Page without pasting tokens."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.integrations.store import IntegrationStore

logger = logging.getLogger(__name__)

FB_SCOPES = ",".join(
    [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_manage_engagement",
        "business_management",
    ]
)

# account_id -> {pages, exp}
_pending_pages: dict[str, dict[str, Any]] = {}


def _auth_secret() -> str:
    from app.config import DEV_AUTH_SECRET

    return os.getenv("AUTH_SECRET", "").strip() or DEV_AUTH_SECRET


def facebook_oauth_configured() -> bool:
    app_id = os.getenv("FACEBOOK_APP_ID", "").strip()
    secret = os.getenv("FACEBOOK_APP_SECRET", "").strip()
    return bool(app_id and secret)


def public_api_base() -> str:
    return (
        os.getenv("PUBLIC_API_URL", "").strip()
        or "http://127.0.0.1:8787"
    ).rstrip("/")


def frontend_base() -> str:
    return (
        os.getenv("FRONTEND_URL", "").strip()
        or "http://127.0.0.1:5173"
    ).rstrip("/")


def oauth_redirect_uri() -> str:
    return f"{public_api_base()}/api/integrations/facebook/callback"


def sign_state(account_id: str) -> str:
    payload = {"uid": account_id, "exp": int(time.time()) + 600}
    body = json.dumps(payload, separators=(",", ":"))
    sig = hmac.new(_auth_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def verify_state(state: str) -> str | None:
    try:
        body, sig = state.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(_auth_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    uid = payload.get("uid")
    return str(uid) if uid else None


def build_oauth_url(account_id: str) -> str:
    if not facebook_oauth_configured():
        raise RuntimeError(
            "Facebook OAuth is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env"
        )
    app_id = os.getenv("FACEBOOK_APP_ID", "").strip()
    settings = get_settings()
    version = settings.facebook_graph_version
    params = {
        "client_id": app_id,
        "redirect_uri": oauth_redirect_uri(),
        "state": sign_state(account_id),
        "scope": FB_SCOPES,
        "response_type": "code",
    }
    return f"https://www.facebook.com/{version}/dialog/oauth?{urlencode(params)}"


async def exchange_code_for_user_token(code: str) -> str:
    app_id = os.getenv("FACEBOOK_APP_ID", "").strip()
    secret = os.getenv("FACEBOOK_APP_SECRET", "").strip()
    version = get_settings().facebook_graph_version
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"https://graph.facebook.com/{version}/oauth/access_token",
            params={
                "client_id": app_id,
                "client_secret": secret,
                "redirect_uri": oauth_redirect_uri(),
                "code": code,
            },
        )
        data = res.json()
        if res.status_code >= 400 or "access_token" not in data:
            raise RuntimeError(f"Token exchange failed: {data}")
        short_token = data["access_token"]

        # Long-lived user token (~60 days)
        res2 = await client.get(
            f"https://graph.facebook.com/{version}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": secret,
                "fb_exchange_token": short_token,
            },
        )
        data2 = res2.json()
        if res2.status_code < 400 and data2.get("access_token"):
            return data2["access_token"]
        return short_token


async def fetch_managed_pages(user_token: str) -> list[dict[str, str]]:
    version = get_settings().facebook_graph_version
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"https://graph.facebook.com/{version}/me/accounts",
            params={
                "access_token": user_token,
                "fields": "id,name,access_token,tasks",
            },
        )
        data = res.json()
        if res.status_code >= 400:
            raise RuntimeError(f"Could not list Pages: {data}")
        pages = []
        for item in data.get("data") or []:
            if not item.get("access_token") or not item.get("id"):
                continue
            pages.append(
                {
                    "id": str(item["id"]),
                    "name": str(item.get("name") or "Untitled Page"),
                    "access_token": str(item["access_token"]),
                }
            )
        return pages


def stash_pending_pages(account_id: str, pages: list[dict[str, str]]) -> None:
    _pending_pages[account_id] = {
        "pages": pages,
        "exp": int(time.time()) + 900,
    }


def get_pending_pages(account_id: str) -> list[dict[str, str]]:
    entry = _pending_pages.get(account_id)
    if not entry:
        return []
    if int(entry.get("exp", 0)) < int(time.time()):
        _pending_pages.pop(account_id, None)
        return []
    # Never send access tokens to the browser — only id/name
    return [{"id": p["id"], "name": p["name"]} for p in entry["pages"]]


def select_pending_page(account_id: str, page_id: str) -> dict[str, str]:
    entry = _pending_pages.get(account_id)
    if not entry or int(entry.get("exp", 0)) < int(time.time()):
        _pending_pages.pop(account_id, None)
        raise RuntimeError("Facebook Page selection expired. Connect again.")
    match = next((p for p in entry["pages"] if p["id"] == page_id), None)
    if not match:
        raise RuntimeError("Page not found in your Facebook connection.")
    _pending_pages.pop(account_id, None)
    return match


def save_page_connection(account_id: str, page: dict[str, str]) -> None:
    app_id = os.getenv("FACEBOOK_APP_ID", "").strip()
    IntegrationStore().upsert(
        account_id,
        facebook_app_id=app_id,
        facebook_page_id=page["id"],
        facebook_page_access_token=page["access_token"],
        facebook_page_name=page.get("name"),
    )


def clear_page_connection(account_id: str) -> None:
    IntegrationStore().upsert(
        account_id,
        facebook_app_id=None,
        facebook_page_id=None,
        facebook_page_name=None,
        clear_facebook_page_access_token=True,
    )
    _pending_pages.pop(account_id, None)
