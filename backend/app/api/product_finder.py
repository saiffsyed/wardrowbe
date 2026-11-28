"""Find the exact product an item was sold as, and take the shop's photo and details (our fork).

Searching changes nothing. Using a match replaces the main photo (the own photo is kept as an
extra photo) and saves only the details the person ticked.
"""

import logging
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.database import DbSession
from app.models.user import User
from app.schemas.item import ItemResponse, ItemUpdate
from app.services import ai_spend, product_finder
from app.services.ai_service import AIDisabledError, require_internal_ai
from app.services.item_service import ItemService
from app.services.photo_swap import TooManyPhotos, replace_main_photo
from app.utils.auth import get_current_user
from app.utils.garment_vocabulary import normalize_color
from app.utils.rate_limit import rate_limit_by_user
from app.utils.safe_fetch import FetchRefused

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["Items"])

FindStatus = Literal["found", "nothing", "no_brand", "ai_disabled", "over_limit", "unreachable"]


class ProductMatch(BaseModel):
    page_url: str
    image_url: str
    thumb: str
    title: str | None = None
    price: float | None = None
    currency: str | None = None
    colour: str | None = None
    article_match: bool = False


class FindProductResponse(BaseModel):
    status: FindStatus
    matches: list[ProductMatch] = Field(default_factory=list)
    spent_cents: int
    limit_cents: int


class UseProductRequest(BaseModel):
    page_url: str = Field(max_length=2000)
    image_url: str = Field(max_length=2000)
    # Only the details the person ticked are sent.
    name: str | None = Field(None, max_length=100)
    colour: str | None = Field(None, max_length=40)
    price: Decimal | None = Field(None, ge=0, le=1_000_000)
    currency: str | None = Field(None, pattern=r"^[A-Z]{3}$")


async def _owned_item(db: DbSession, item_id: UUID, user: User):
    item = await ItemService(db).get_by_id(item_id, user.id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.post("/{item_id}/find-product", response_model=FindProductResponse)
async def find_product(
    item_id: UUID, db: DbSession, current_user: Annotated[User, Depends(get_current_user)]
) -> FindProductResponse:
    item = await _owned_item(db, item_id, current_user)
    limit = ai_spend.monthly_limit_cents()

    def answer(state: FindStatus, matches: list[ProductMatch] | None = None, spent: int = 0):
        return FindProductResponse(
            status=state, matches=matches or [], spent_cents=spent, limit_cents=limit
        )

    spent = await ai_spend.spent_this_month(db)
    if not item.brand:
        return answer("no_brand", spent=spent)
    try:
        require_internal_ai("text")
    except AIDisabledError:
        return answer("ai_disabled", spent=spent)
    if not product_finder.gemini_available():
        return answer("ai_disabled", spent=spent)
    if not await ai_spend.can_spend(db, ai_spend.PRODUCT_SEARCH_CENTS):
        return answer("over_limit", spent=spent)
    await rate_limit_by_user(current_user.id, "find-product", max_requests=6, window_seconds=60)

    tags = item.tags or {}
    result = await product_finder.search(
        brand=item.brand,
        article=tags.get("article_number"),
        kind=(item.subtype or item.type) if item.type != "unknown" else item.subtype,
        colour=item.primary_color,
        size=tags.get("size"),
    )
    if result.status == "unreachable":
        return answer("unreachable", spent=spent)
    await ai_spend.record(db, ai_spend.PRODUCT_SEARCH_CENTS)
    await db.commit()
    matches = [ProductMatch(**c.__dict__) for c in result.candidates if c.thumb]
    return answer("found" if matches else "nothing", matches, spent + ai_spend.PRODUCT_SEARCH_CENTS)


@router.post("/{item_id}/use-product", response_model=ItemResponse)
async def use_product(
    item_id: UUID,
    body: UseProductRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ItemResponse:
    item = await _owned_item(db, item_id, current_user)
    try:
        image_bytes = await product_finder.fetch_product_image(body.image_url)
    except FetchRefused as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="The shop's picture could not be loaded"
        ) from e
    try:
        await replace_main_photo(db, item, image_bytes, filename="shop.jpg")
    except TooManyPhotos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="TOO_MANY_PHOTOS"
        ) from None
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from None

    changes: dict = {"tags": {"source_url": body.page_url}}
    if body.name:
        changes["name"] = body.name
    if body.colour and normalize_color(body.colour):
        changes["primary_color"] = normalize_color(body.colour)
    if body.price is not None:
        changes["purchase_price"] = body.price
        if body.currency:
            changes["tags"]["currency"] = body.currency
    await ItemService(db).update(item, ItemUpdate(**changes))
    await db.commit()
    # Read it again, extra photos included: the own photo was just added to them.
    db.expire(item)
    return ItemResponse.model_validate(await _owned_item(db, item_id, current_user))
