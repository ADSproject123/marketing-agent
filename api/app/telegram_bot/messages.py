"""Telegram message helpers and inline keyboards."""

from __future__ import annotations

import html

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def approval_keyboard(job_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("Approve", callback_data=f"approve:{job_id}"),
                InlineKeyboardButton("Deny", callback_data=f"deny:{job_id}"),
            ]
        ]
    )


def format_preview_caption(*, job_id: str, title: str, caption: str) -> str:
    safe_title = html.escape(title)
    safe_caption = html.escape(caption)
    short_id = html.escape(job_id[:8])
    return (
        f"<b>Review before posting</b> (job <code>{short_id}</code>)\n\n"
        f"<b>Title</b>: {safe_title}\n\n"
        f"{safe_caption}"
    )


HELP_TEXT = """Rachana AI — approval gate

Jobs are started from the web dashboard (or the system), not from Telegram.

Here you only:
• Approve — allow the post (Facebook when configured)
• Deny — stop, nothing is posted

Commands:
/status — recent jobs
/login_notebook — NotebookLM auth recovery
/help — this message
"""
