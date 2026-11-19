"""Laundry (our fork): clothes to wash, in the wash and at the dry cleaner.

Tick clothes and move them: "To wash" → in the wash or to the dry cleaner, and from there
back into the wardrobe, which also counts as a wash in the item's history.
"""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.database import DbSession
from app.models.item import ClothingItem, ItemStatus
from app.models.laundry import ItemLaundry
from app.models.user import User
from app.schemas.item import ItemResponse
from app.services.item_service import ItemService
from app.utils.auth import get_current_user
from app.utils.timezone import get_user_today

router = APIRouter(prefix="/laundry", tags=["Laundry"])

MAX_MOVE = 500


class LaundryLists(BaseModel):
    to_wash: list[ItemResponse]
    wash: list[ItemResponse]
    dry: list[ItemResponse]


class LaundryState(BaseModel):
    item_id: UUID
    state: Literal["wash", "dry"]


class MoveBody(BaseModel):
    item_ids: list[UUID] = Field(min_length=1, max_length=MAX_MOVE)
    # "back" means clean and in the wardrobe again.
    to: Literal["wash", "dry", "back"]


class MoveResult(BaseModel):
    moved: int


@router.get("", response_model=LaundryLists)
async def get_laundry(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    home_id: UUID | None = Query(None, description="Only clothes kept in this home"),
) -> LaundryLists:
    query = (
        select(ClothingItem, ItemLaundry.state)
        .outerjoin(ItemLaundry, ItemLaundry.item_id == ClothingItem.id)
        .where(
            ClothingItem.user_id == current_user.id,
            ClothingItem.is_archived.is_(False),
            ClothingItem.status == ItemStatus.ready,
        )
        .where((ClothingItem.needs_wash.is_(True)) | (ItemLaundry.state.is_not(None)))
        .options(selectinload(ClothingItem.additional_images))
        .order_by(ClothingItem.updated_at.desc())
    )
    if home_id is not None:
        query = query.where(ClothingItem.home_id == home_id)
    lists: dict[str, list[ItemResponse]] = {"to_wash": [], "wash": [], "dry": []}
    for item, state in (await db.execute(query)).all():
        lists[state or "to_wash"].append(ItemResponse.model_validate(item))
    return LaundryLists(**lists)


@router.get("/states", response_model=list[LaundryState])
async def get_states(
    db: DbSession, current_user: Annotated[User, Depends(get_current_user)]
) -> list[LaundryState]:
    """Which of the person's clothes are away, for the badges on the wardrobe."""
    rows = (
        await db.execute(
            select(ItemLaundry.item_id, ItemLaundry.state).where(
                ItemLaundry.user_id == current_user.id
            )
        )
    ).all()
    return [LaundryState(item_id=item_id, state=state) for item_id, state in rows]


@router.post("/move", response_model=MoveResult)
async def move(
    body: MoveBody,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> MoveResult:
    wanted = list(dict.fromkeys(body.item_ids))
    items = (
        (
            await db.execute(
                select(ClothingItem).where(
                    ClothingItem.user_id == current_user.id, ClothingItem.id.in_(wanted)
                )
            )
        )
        .scalars()
        .all()
    )
    if len(items) != len(wanted):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    ids = [item.id for item in items]
    current = {
        row.item_id: row
        for row in (
            await db.execute(select(ItemLaundry).where(ItemLaundry.item_id.in_(ids)))
        ).scalars()
    }

    if body.to == "back":
        service = ItemService(db)
        today = get_user_today(current_user)
        for item in items:
            row = current.get(item.id)
            if row is None:
                continue
            await service.log_wash(
                item=item, washed_at=today, method="dry_clean" if row.state == "dry" else None
            )
        await db.execute(delete(ItemLaundry).where(ItemLaundry.item_id.in_(ids)))
        await db.flush()
        return MoveResult(moved=sum(1 for item_id in ids if item_id in current))

    now = datetime.now(UTC)
    for item in items:
        row = current.get(item.id)
        if row is None:
            db.add(ItemLaundry(item_id=item.id, user_id=current_user.id, state=body.to, since=now))
        elif row.state != body.to:
            row.state = body.to
            row.since = now
    await db.flush()
    return MoveResult(moved=len(items))
