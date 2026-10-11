from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.auth.security import create_token
from app.dependencies import require_user, users
from app.schemas import LoginRequest, RegisterRequest

router = APIRouter(tags=["auth"])


@router.post("/api/auth/register")
def register(body: RegisterRequest) -> dict:
    try:
        user = users().create(
            email=body.email,
            name=body.name,
            password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_token(user.id, user.email, user.name)
    return {"ok": True, "token": token, "user": user.public()}


@router.post("/api/auth/login")
def login(body: LoginRequest) -> dict:
    user = users().authenticate(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_token(user.id, user.email, user.name)
    return {"ok": True, "token": token, "user": user.public()}


@router.get("/api/auth/me")
def me(user: dict = Depends(require_user)) -> dict:
    return {"ok": True, "user": user}
