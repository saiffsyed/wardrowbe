"""Catalogue photo (our fork): make a clean shop-style picture of an item, then use or drop it.

Making one costs money and changes nothing; it stays a draft until "Use the new photo", which
makes it the main photo and keeps the own photo as an extra one.
"""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import DbSession
from app.models.user import User
from app.schemas.item import ItemResponse
from app.services import ai_spend, catalogue_photo
from app.services.ai_service import AIDisabledError, require_internal_ai
from app.services.image_service import ImageService
from app.services.item_service import ItemService
from app.services.photo_swap import TooManyPhotos, replace_main_photo
from app.utils.auth import get_current_user
from app.utils.rate_limit import rate_limit_by_user

router = APIRouter(prefix="/items", tags=["Items"])

MakeStatus = Literal["ready", "ai_disabled", "over_limit", "failed"]


class CatalogueDraft(BaseModel):
    status: MakeStatus
    draft_id: str | None = None
    preview: str | None = None
    spent_cents: int
    limit_cents: int


async def _owned_item(db: DbSession, item_id: UUID, user: User):
    item = await ItemService(db).get_by_id(item_id, user.id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.post("/{item_id}/catalogue-photo", response_model=CatalogueDraft)
async def make_catalogue_photo(
    item_id: UUID, db: DbSession, current_user: Annotated[User, Depends(get_current_user)]
) -> CatalogueDraft:
    item = await _owned_item(db, item_id, current_user)
    user_id = current_user.id
    limit = ai_spend.monthly_limit_cents()
    spent = await ai_spend.spent_this_month(db)

    def answer(state: MakeStatus, **extra) -> CatalogueDraft:
        return CatalogueDraft(status=state, spent_cents=spent, limit_cents=limit, **extra)

    try:
        require_internal_ai("vision")
    except AIDisabledError:
        return answer("ai_disabled")
    if not catalogue_photo.available():
        return answer("ai_disabled")
    if not await ai_spend.can_spend(db, ai_spend.CATALOGUE_PHOTO_CENTS):
        return answer("over_limit")
    await rate_limit_by_user(user_id, "catalogue-photo", max_requests=4, window_seconds=60)

    photo = ImageService().get_image_path(item.image_path)
    if not photo.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item has no photo")
    try:
        picture = await catalogue_photo.generate(photo)
    except catalogue_photo.CatalogueError:
        return answer("failed")
    await ai_spend.record(db, ai_spend.CATALOGUE_PHOTO_CENTS)
    await db.commit()
    spent += ai_spend.CATALOGUE_PHOTO_CENTS
    draft_id, preview = catalogue_photo.save_draft(user_id, item_id, picture)
    return answer("ready", draft_id=draft_id, preview=preview)


@router.post("/{item_id}/catalogue-photo/{draft_id}/use", response_model=ItemResponse)
async def use_catalogue_photo(
    item_id: UUID,
    draft_id: str,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ItemResponse:
    item = await _owned_item(db, item_id, current_user)
    path = catalogue_photo.draft_path(current_user.id, item_id, draft_id)
    if path is None or not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    try:
        await replace_main_photo(db, item, path.read_bytes(), filename="catalogue.jpg")
    except TooManyPhotos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="TOO_MANY_PHOTOS"
        ) from None
    await db.commit()
    path.unlink(missing_ok=True)
    db.expire(item)
    return ItemResponse.model_validate(await _owned_item(db, item_id, current_user))


@router.delete("/{item_id}/catalogue-photo/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def drop_catalogue_photo(
    item_id: UUID,
    draft_id: str,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await _owned_item(db, item_id, current_user)
    path = catalogue_photo.draft_path(current_user.id, item_id, draft_id)
    if path is not None:
        path.unlink(missing_ok=True)
