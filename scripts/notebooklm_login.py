#!/usr/bin/env python3
"""Login to NotebookLM using real Google Chrome (avoids 'browser not secure')."""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from playwright.async_api import async_playwright
from pynotebooklm.auth import ESSENTIAL_COOKIES, NOTEBOOKLM_URL, AuthManager
from pynotebooklm.exceptions import AuthenticationError

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("notebooklm_login")

PROFILE_DIR = Path.home() / ".pynotebooklm" / "chrome_profile"


async def wait_for_login(page, timeout: int = 300) -> None:
    logger.info(
        "Chrome opened. Sign in to Google / NotebookLM in that window.\n"
        "Waiting up to %s seconds…",
        timeout,
    )
    start = datetime.now()
    while (datetime.now() - start).seconds < timeout:
        if page.is_closed():
            raise AuthenticationError("Browser closed before login completed")

        url = page.url
        on_app = (
            "accounts.google.com" not in url
            and (
                NOTEBOOKLM_URL in url
                or "notebooklm.google.com" in url
                or "notebook.google.com" in url
            )
        )
        if on_app:
            cookies = await page.context.cookies()
            names = {c["name"] for c in cookies}
            if ESSENTIAL_COOKIES.issubset(names):
                logger.info("Authentication detected.")
                return

        await page.wait_for_timeout(2000)

    raise AuthenticationError(f"Login timed out after {timeout} seconds")


async def main(timeout: int = 300) -> None:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    auth = AuthManager(headless=False)

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            channel="chrome",
            headless=False,
            viewport={"width": 1280, "height": 900},
            ignore_default_args=["--enable-automation"],
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )
        try:
            page = context.pages[0] if context.pages else await context.new_page()
            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )
            await page.goto(NOTEBOOKLM_URL, wait_until="domcontentloaded")
            await wait_for_login(page, timeout=timeout)
            cookies = await context.cookies()
            await auth._store_cookies(cookies, page)
            logger.info("Saved auth to %s", auth.auth_path)
        finally:
            await context.close()

    if AuthManager().is_authenticated():
        logger.info("NotebookLM login OK. You can start jobs from the dashboard.")
    else:
        raise SystemExit("Login finished but auth check failed.")


if __name__ == "__main__":
    timeout = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    asyncio.run(main(timeout=timeout))
