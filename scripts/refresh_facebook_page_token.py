#!/usr/bin/env python3
"""Refresh FACEBOOK_PAGE_ACCESS_TOKEN via Facebook Login OAuth and write .env."""

from __future__ import annotations

import os
import sqlite3
import sys
import time
import webbrowser
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
load_dotenv(ROOT / ".env")

from app.auth.security import create_token  # noqa: E402
from app.integrations.store import IntegrationStore  # noqa: E402


def _env_page_id() -> str:
    return (os.getenv("FACEBOOK_PAGE_ID") or "").strip()


def _pick_user() -> tuple[str, str, str]:
    con = sqlite3.connect(ROOT / "data" / "users.db")
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT id, email, name FROM users ORDER BY created_at DESC").fetchall()
    con.close()
    if not rows:
        raise SystemExit("No dashboard users found. Register once in the web app first.")
    # Prefer non-demo account when present
    for row in rows:
        if "demo" not in (row["email"] or "").lower():
            return row["id"], row["email"], row["name"] or ""
    row = rows[0]
    return row["id"], row["email"], row["name"] or ""


def _write_env(page_id: str, token: str) -> None:
    path = ROOT / ".env"
    lines = path.read_text().splitlines()
    out: list[str] = []
    seen_page = seen_tok = False
    for line in lines:
        if line.startswith("FACEBOOK_PAGE_ID="):
            out.append(f"FACEBOOK_PAGE_ID={page_id}")
            seen_page = True
        elif line.startswith("FACEBOOK_PAGE_ACCESS_TOKEN="):
            out.append(f"FACEBOOK_PAGE_ACCESS_TOKEN={token}")
            seen_tok = True
        else:
            out.append(line)
    if not seen_page:
        out.append(f"FACEBOOK_PAGE_ID={page_id}")
    if not seen_tok:
        out.append(f"FACEBOOK_PAGE_ACCESS_TOKEN={token}")
    path.write_text("\n".join(out) + "\n")


def main() -> None:
    api = (os.getenv("PUBLIC_API_URL") or "http://127.0.0.1:8787").rstrip("/")
    uid, email, name = _pick_user()
    jwt = create_token(uid, email, name)
    headers = {"Authorization": f"Bearer {jwt}"}
    wanted = _env_page_id()

    with httpx.Client(timeout=30, follow_redirects=False) as client:
        res = client.get(f"{api}/api/integrations/facebook/connect", headers=headers)
        data = res.json()
        if res.status_code >= 400:
            raise SystemExit(f"Connect failed: {data}")
        url = data["url"]
        print("Opening Facebook Login in your browser…")
        print("Approve the permissions, then return here.")
        print(f"Redirect URI that must be allowed in Meta:\n  {data.get('redirect_uri')}")
        webbrowser.open(url)

        deadline = time.time() + 300
        while time.time() < deadline:
            # Auto-pick preferred page if OAuth left multiple pages pending
            pages_res = client.get(f"{api}/api/integrations/facebook/pages", headers=headers)
            if pages_res.status_code == 200:
                pages = pages_res.json().get("pages") or []
                if pages:
                    page_id = wanted or pages[0]["id"]
                    if wanted and not any(p["id"] == wanted for p in pages):
                        print("Available pages:", [(p["id"], p["name"]) for p in pages])
                        raise SystemExit(
                            f"Configured FACEBOOK_PAGE_ID={wanted} not in connected pages."
                        )
                    sel = client.post(
                        f"{api}/api/integrations/facebook/select",
                        headers=headers,
                        json={"page_id": page_id},
                    )
                    if sel.status_code >= 400:
                        raise SystemExit(f"Page select failed: {sel.text}")

            integ = IntegrationStore().get(uid)
            if (
                integ
                and integ.facebook_page_id
                and integ.facebook_page_access_token
            ):
                if wanted and integ.facebook_page_id != wanted:
                    # Keep waiting / or accept first connected page
                    pass
                page_id = integ.facebook_page_id
                token = integ.facebook_page_access_token
                _write_env(page_id, token)
                print(f"Updated .env with page {page_id} (token length {len(token)}).")
                print("Restart the API process to load the new token.")
                return
            time.sleep(2)

    raise SystemExit("Timed out waiting for Facebook Login. Run again and finish the browser step.")


if __name__ == "__main__":
    main()
