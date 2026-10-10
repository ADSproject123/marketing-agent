"""Facebook Page video upload + publish via Graph API."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class FacebookPostResult:
    video_id: str
    post_url: str


class FacebookPostError(RuntimeError):
    pass


async def _start_upload_session(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    file_name: str,
    file_length: int,
) -> str:
    url = (
        f"https://graph.facebook.com/{settings.facebook_graph_version}/"
        f"{settings.facebook_app_id}/uploads"
    )
    response = await client.post(
        url,
        params={
            "file_name": file_name,
            "file_length": file_length,
            "file_type": "video/mp4",
            "access_token": settings.facebook_page_access_token,
        },
    )
    data = response.json()
    if response.status_code >= 400 or "id" not in data:
        raise FacebookPostError(f"Failed to start upload session: {data}")
    return data["id"]


async def _upload_bytes(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    upload_session_id: str,
    file_path: Path,
) -> str:
    session_path = upload_session_id
    if not session_path.startswith("upload:"):
        session_path = f"upload:{session_path}"

    url = f"https://graph.facebook.com/{settings.facebook_graph_version}/{session_path}"
    content = file_path.read_bytes()
    response = await client.post(
        url,
        headers={
            "Authorization": f"OAuth {settings.facebook_page_access_token}",
            "file_offset": "0",
            "Content-Type": "application/octet-stream",
        },
        content=content,
    )
    data = response.json()
    handle = data.get("h")
    if response.status_code >= 400 or not handle:
        raise FacebookPostError(f"Failed to upload video bytes: {data}")
    return handle


async def _publish_with_handle(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    file_handle: str,
    title: str,
    description: str,
) -> str:
    url = (
        f"https://graph.facebook.com/{settings.facebook_graph_version}/"
        f"{settings.facebook_page_id}/videos"
    )
    response = await client.post(
        url,
        data={
            "access_token": settings.facebook_page_access_token,
            "title": title[:255],
            "description": description,
            "fbuploader_video_file_chunk": file_handle,
        },
    )
    data = response.json()
    video_id = data.get("id")
    if response.status_code >= 400 or not video_id:
        raise FacebookPostError(f"Handle publish failed: {data}")
    return str(video_id)


async def _publish_direct_file(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    file_path: Path,
    title: str,
    description: str,
) -> str:
    url = (
        f"https://graph.facebook.com/{settings.facebook_graph_version}/"
        f"{settings.facebook_page_id}/videos"
    )
    with file_path.open("rb") as fh:
        response = await client.post(
            url,
            data={
                "access_token": settings.facebook_page_access_token,
                "title": title[:255],
                "description": description,
            },
            files={"source": (file_path.name, fh, "video/mp4")},
            timeout=300.0,
        )
    data = response.json()
    video_id = data.get("id")
    if response.status_code >= 400 or not video_id:
        raise FacebookPostError(f"Direct video publish failed: {data}")
    return str(video_id)


async def post_page_video(
    settings: Settings,
    *,
    video_path: Path,
    title: str,
    description: str,
) -> FacebookPostResult:
    """Upload an MP4 and publish it to the configured Facebook Page."""
    if not settings.facebook_enabled:
        raise FacebookPostError(
            "Facebook is not configured. Set FACEBOOK_APP_ID, FACEBOOK_PAGE_ID, "
            "and FACEBOOK_PAGE_ACCESS_TOKEN."
        )
    if not video_path.exists():
        raise FacebookPostError(f"Video file not found: {video_path}")

    file_length = video_path.stat().st_size
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            session_id = await _start_upload_session(
                client,
                settings,
                file_name=video_path.name,
                file_length=file_length,
            )
            handle = await _upload_bytes(
                client,
                settings,
                upload_session_id=session_id,
                file_path=video_path,
            )
            video_id = await _publish_with_handle(
                client,
                settings,
                file_handle=handle,
                title=title,
                description=description,
            )
        except Exception:
            logger.exception("Resumable upload path failed; trying direct upload")
            video_id = await _publish_direct_file(
                client,
                settings,
                file_path=video_path,
                title=title,
                description=description,
            )

    post_url = f"https://www.facebook.com/{settings.facebook_page_id}/videos/{video_id}"
    return FacebookPostResult(video_id=video_id, post_url=post_url)
