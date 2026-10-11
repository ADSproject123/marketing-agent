from __future__ import annotations

from fastapi import APIRouter

from app import runtime as runtime_mod

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    runtime_ready = True
    try:
        runtime_mod.get_runtime()
    except RuntimeError:
        runtime_ready = False
    return {
        "ok": True,
        "service": "marketing-agent",
        "runtime_ready": runtime_ready,
        "frontend": "react",
    }
