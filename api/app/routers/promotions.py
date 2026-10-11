from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import promotions, require_user
from app.schemas import CreatePromotionRequest

router = APIRouter(tags=["promotions"])


@router.get("/api/promotions")
def list_promotions(user: dict = Depends(require_user)) -> dict:
    items = promotions().list_for_account(user["id"])
    return {"promotions": [item.public() for item in items]}


@router.post("/api/promotions", status_code=201)
def create_promotion(
    body: CreatePromotionRequest,
    user: dict = Depends(require_user),
) -> dict:
    item = promotions().create(
        account_id=user["id"],
        kind=body.kind,
        name=body.name,
        description=body.description,
        benefit=body.benefit,
        location=body.location,
        website=body.website,
    )
    return {"promotion": item.public()}
