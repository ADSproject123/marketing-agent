"""Validate and store brand image uploads for NotebookLM video sources."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import HTTPException
from PIL import Image
from starlette.datastructures import UploadFile

from app.jobs.store import JobSource

ALLOWED_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".webp"})
ALLOWED_MIME_TYPES = frozenset({"image/png", "image/jpeg", "image/jpg", "image/webp"})
MAX_ASSETS = 5
MAX_ASSET_BYTES = 5 * 1024 * 1024

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str, index: int) -> str:
    raw = Path(name or "").name.strip() or f"asset-{index + 1}.png"
    stem = _SAFE_NAME.sub("-", Path(raw).stem).strip(".-") or f"asset-{index + 1}"
    suffix = Path(raw).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        suffix = ".png"
    return f"{index + 1:02d}-{stem[:80]}{suffix}"


def validate_asset_file(upload: UploadFile, *, index: int, size: int) -> None:
    filename = upload.filename or f"asset-{index + 1}"
    suffix = Path(filename).suffix.lower()
    content_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
    if suffix not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type for {filename}. Use PNG, JPG, or WEBP.",
        )
    if size <= 0:
        raise HTTPException(status_code=400, detail=f"{filename} is empty.")
    if size > MAX_ASSET_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"{filename} is too large. Each image must be 5 MB or smaller.",
        )


async def save_job_assets(
    uploads_dir: Path,
    job_id: str,
    uploads: list[UploadFile],
) -> list[JobSource]:
    """Persist uploaded brand images and return file JobSources."""
    if not uploads:
        return []
    if len(uploads) > MAX_ASSETS:
        raise HTTPException(
            status_code=400,
            detail=f"Add up to {MAX_ASSETS} logo or product photos.",
        )

    job_dir = uploads_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    sources: list[JobSource] = []

    for index, upload in enumerate(uploads):
        try:
            data = await upload.read()
            validate_asset_file(upload, index=index, size=len(data))
            filename = _safe_filename(upload.filename or "", index)
            path = job_dir / filename
            path.write_bytes(data)
            title = Path(upload.filename or filename).name[:120] or filename
            sources.append(
                JobSource(kind="file", value=str(path.resolve()), title=title)
            )
        finally:
            await upload.close()
    return sources


def build_brand_assets_pdf(image_paths: list[Path], destination: Path) -> Path:
    """Pack brand images into a multi-page PDF NotebookLM can ingest."""
    pages: list[Image.Image] = []
    try:
        for path in image_paths:
            with Image.open(path) as image:
                pages.append(image.convert("RGB"))
        if not pages:
            raise ValueError("No images available for brand assets PDF")
        destination.parent.mkdir(parents=True, exist_ok=True)
        first, *rest = pages
        first.save(destination, "PDF", save_all=bool(rest), append_images=rest)
        return destination
    finally:
        for page in pages:
            page.close()
