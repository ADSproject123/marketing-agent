"""Merge platform .env settings with per-account overrides."""

from __future__ import annotations

from dataclasses import replace

from app.config import Settings, get_settings
from app.integrations.store import IntegrationStore, UserIntegrations


def _parse_keys(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    keys: list[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        key = part.strip()
        if key and key not in seen:
            seen.add(key)
            keys.append(key)
    return tuple(keys)


def apply_integrations(base: Settings, integ: UserIntegrations | None) -> Settings:
    if not integ:
        return base
    updates: dict = {}
    keys = _parse_keys(integ.gemini_api_keys)
    if keys:
        updates["gemini_api_keys"] = keys
    if integ.gemini_model:
        updates["gemini_model"] = integ.gemini_model
    if integ.telegram_bot_token:
        updates["telegram_bot_token"] = integ.telegram_bot_token
    if integ.telegram_user_id is not None:
        updates["allowed_telegram_user_id"] = int(integ.telegram_user_id)
    if integ.facebook_app_id:
        updates["facebook_app_id"] = integ.facebook_app_id
    if integ.facebook_page_id:
        updates["facebook_page_id"] = integ.facebook_page_id
    if integ.facebook_page_access_token:
        updates["facebook_page_access_token"] = integ.facebook_page_access_token
    if integ.skip_notebooklm is not None:
        updates["skip_notebooklm"] = bool(integ.skip_notebooklm)
    return replace(base, **updates) if updates else base


def resolve_settings_for_account(
    account_id: str | None,
    *,
    base: Settings | None = None,
) -> Settings:
    base = base or get_settings()
    if not account_id:
        return base
    integ = IntegrationStore().get(account_id)
    return apply_integrations(base, integ)
