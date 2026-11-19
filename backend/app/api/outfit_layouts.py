"""How looks are arranged on the outfit board (our fork).

The board saves where each piece sits; the Lookbook, Collections and Planner then show the
look exactly so. A look without a saved arrangement is shown with the automatic layout.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import DbSession
from app.models.outfit import Outfit, OutfitItem
from app.models.outfit_layout import OutfitLayout
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/outfit-layouts", tags=["Outfit layouts"])

# The colours offered under Background.
BACKGROUNDS = ("#ffffff", "#f6f1e7", "#e9ecea", "#111316")
MAX_IDS = 100


class Piece(BaseModel):
    item_id: UUID
    # Percent of the board; a piece may stick out a little past an edge.
    x: float = Field(ge=-50, le=150)
    y: float = Field(ge=-50, le=150)
    w: float = Field(gt=0, le=150)
    z: int = Field(ge=-1000, le=1000)


class LayoutBody(BaseModel):
    background: str = Field(default="#ffffff", pattern="^#[0-9a-f]{6}$")
    pieces: list[Piece] = Field(min_length=1, max_length=20)


class LayoutResponse(LayoutBody):
    outfit_id: UUID


def _response(layout: OutfitLayout) -> LayoutResponse:
    return LayoutResponse(
        outfit_id=layout.outfit_id,
        background=layout.background,
        pieces=[Piece(**piece) for piece in layout.pieces],
    )


@router.get("", response_model=list[LayoutResponse])
async def get_layouts(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    ids: str = Query(..., description="Comma-separated outfit ids"),
) -> list[LayoutResponse]:
    """The saved arrangements of the person's own outfits among `ids` (those without one are
    left out)."""
    try:
        wanted = [UUID(part) for part in ids.split(",") if part.strip()][:MAX_IDS]
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Bad outfit id") from None
    if not wanted:
        return []
    rows = (
        await db.execute(
            select(OutfitLayout)
            .join(Outfit, Outfit.id == OutfitLayout.outfit_id)
            .where(Outfit.user_id == current_user.id, OutfitLayout.outfit_id.in_(wanted))
        )
    ).scalars()
    return [_response(row) for row in rows]


@router.put("/{outfit_id}", response_model=LayoutResponse)
async def save_layout(
    outfit_id: UUID,
    body: LayoutBody,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> LayoutResponse:
    outfit = (
        await db.execute(
            select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if outfit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Outfit not found")
    if body.background not in BACKGROUNDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown background")
    in_outfit = set(
        (
            await db.execute(select(OutfitItem.item_id).where(OutfitItem.outfit_id == outfit_id))
        ).scalars()
    )
    # Only pieces that are in the outfit; one place each.
    seen: set[UUID] = set()
    pieces = []
    for piece in body.pieces:
        if piece.item_id in in_outfit and piece.item_id not in seen:
            seen.add(piece.item_id)
            pieces.append(piece.model_dump(mode="json"))
    if not pieces:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No piece of this outfit")

    layout = await db.get(OutfitLayout, outfit_id)
    if layout is None:
        layout = OutfitLayout(outfit_id=outfit_id)
        db.add(layout)
    layout.background = body.background
    layout.pieces = pieces
    await db.flush()
    return _response(layout)
