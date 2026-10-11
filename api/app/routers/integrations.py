from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.dependencies import integrations, require_user
from app.integrations import facebook_oauth
from app import runtime as runtime_mod
from app.schemas import FacebookSelectPageRequest, IntegrationsUpdateRequest
from app.notebooklm.client import check_auth

router = APIRouter(tags=['integrations'])

@router.get("/api/integrations")
def get_integrations(user: dict = Depends(require_user)) -> dict:
    integ = integrations().get(user["id"])
    status = (
        integ.public_status()
        if integ
        else {
            "telegram_bot_token_set": False,
            "telegram_user_id": None,
            "gemini_api_keys_set": False,
            "gemini_model": "",
            "facebook_app_id": "",
            "facebook_page_id": "",
            "facebook_page_name": "",
            "facebook_page_access_token_set": False,
            "facebook_connected": False,
            "skip_notebooklm": False,
            "updated_at": None,
            "ready": {
                "telegram": False,
                "gemini": False,
                "facebook": False,
                "notebooklm": "server",
            },
        }
    )
    return {
        "ok": True,
        "integrations": status,
        "facebook_oauth": {
            "configured": facebook_oauth.facebook_oauth_configured(),
            "pending_pages": facebook_oauth.get_pending_pages(user["id"]),
        },
        "notebooklm": {
            "server_authenticated": check_auth(),
            "note": (
                "NotebookLM uses Google browser login on the server host. "
                "Ask the operator to run: notebooklm login --browser-cookies chrome"
            ),
        },
    }


@router.put("/api/integrations")
async def update_integrations(
    body: IntegrationsUpdateRequest,
    user: dict = Depends(require_user),
) -> dict:
    try:
        integ = integrations().upsert(
            user["id"],
            telegram_bot_token=body.telegram_bot_token,
            telegram_user_id=body.telegram_user_id,
            gemini_api_keys=body.gemini_api_keys,
            gemini_model=body.gemini_model,
            skip_notebooklm=body.skip_notebooklm,
            clear_telegram_bot_token=body.clear_telegram_bot_token,
            clear_gemini_api_keys=body.clear_gemini_api_keys,
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Start polling the user's Telegram bot if they provided one.
    try:
        runtime = runtime_mod.get_runtime()
        if runtime.bot_hub and integ.telegram_bot_token:
            await runtime.bot_hub.ensure_token(integ.telegram_bot_token)
    except RuntimeError:
        pass
    except Exception:
        # Settings still saved; bot polling can retry on next job/start.
        pass

    return {
        "ok": True,
        "integrations": integ.public_status(),
        "message": "Integrations saved.",
    }


@router.get("/api/integrations/facebook/connect")
def facebook_connect(user: dict = Depends(require_user)) -> dict:
    if not facebook_oauth.facebook_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Facebook Login is not configured on the server. "
                "Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env, and add the OAuth "
                f"redirect URI: {facebook_oauth.oauth_redirect_uri()}"
            ),
        )
    try:
        url = facebook_oauth.build_oauth_url(user["id"])
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "ok": True,
        "url": url,
        "redirect_uri": facebook_oauth.oauth_redirect_uri(),
    }


@router.get("/api/integrations/facebook/callback")
async def facebook_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    from urllib.parse import quote

    front = facebook_oauth.frontend_base()

    def fail(msg: str) -> RedirectResponse:
        return RedirectResponse(
            f"{front}/dashboard/settings?facebook=error&message={quote(msg[:180])}"
        )

    if error:
        return fail(error_description or error)
    if not code or not state:
        return fail("missing_code")
    account_id = facebook_oauth.verify_state(state)
    if not account_id:
        return fail("invalid_state")
    try:
        user_token = await facebook_oauth.exchange_code_for_user_token(code)
        pages = await facebook_oauth.fetch_managed_pages(user_token)
    except Exception as exc:
        return fail(str(exc))
    if not pages:
        return fail("No Facebook Pages found for this account.")
    if len(pages) == 1:
        facebook_oauth.save_page_connection(account_id, pages[0])
        return RedirectResponse(f"{front}/dashboard/settings?facebook=connected")
    facebook_oauth.stash_pending_pages(account_id, pages)
    return RedirectResponse(f"{front}/dashboard/settings?facebook=pick")


@router.get("/api/integrations/facebook/pages")
def facebook_pending_pages(user: dict = Depends(require_user)) -> dict:
    return {
        "ok": True,
        "pages": facebook_oauth.get_pending_pages(user["id"]),
        "oauth_configured": facebook_oauth.facebook_oauth_configured(),
    }


@router.post("/api/integrations/facebook/select")
def facebook_select_page(
    body: FacebookSelectPageRequest,
    user: dict = Depends(require_user),
) -> dict:
    try:
        page = facebook_oauth.select_pending_page(user["id"], body.page_id)
        facebook_oauth.save_page_connection(user["id"], page)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    integ = integrations().get(user["id"])
    return {
        "ok": True,
        "integrations": integ.public_status() if integ else {},
        "message": f"Connected to {page['name']}.",
    }


@router.delete("/api/integrations/facebook")
def facebook_disconnect(user: dict = Depends(require_user)) -> dict:
    facebook_oauth.clear_page_connection(user["id"])
    integ = integrations().get(user["id"])
    return {
        "ok": True,
        "integrations": integ.public_status()
        if integ
        else {
            "facebook_connected": False,
            "facebook_page_name": "",
            "facebook_page_id": "",
            "ready": {"facebook": False},
        },
        "message": "Facebook disconnected.",
    }
