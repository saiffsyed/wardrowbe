"""The wardrobe's categories, with how many items each holds, and changing them."""

from collections import Counter
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.database import DbSession
from app.models.item import ClothingItem
from app.models.user import User
from app.services.wardrobe_category_service import (
    reset_tree,
    save_tree,
    stored_tree,
    tree_for,
)
from app.utils.auth import get_current_user
from app.utils.wardrobe_categories import CategoryTree, default_tree, unplaced_types

router = APIRouter(prefix="/wardrobe", tags=["Wardrobe"])


class SubGroupResponse(BaseModel):
    id: str
    key: str | None = None
    name: str | None = None
    types: list[str]
    item_count: int


class GroupResponse(BaseModel):
    id: str
    key: str | None = None
    name: str | None = None
    item_count: int
    children: list[SubGroupResponse]


class CategoriesResponse(BaseModel):
    # False while the person still has the built-in categories.
    customised: bool
    groups: list[GroupResponse]
    # Item types that are in no category; their items show only under "All".
    unplaced_types: list[str]


async def _response(
    db: DbSession, user: User, tree: CategoryTree, customised: bool, home_id: UUID | None
) -> CategoriesResponse:
    query = (
        select(ClothingItem.type, func.count())
        .where(ClothingItem.user_id == user.id, ClothingItem.is_archived.is_(False))
        .group_by(ClothingItem.type)
    )
    if home_id is not None:
        query = query.where(ClothingItem.home_id == home_id)
    per_type: Counter[str] = Counter(dict((await db.execute(query)).all()))

    groups = []
    for group in tree.groups:
        children = [
            SubGroupResponse(
                id=child.id,
                key=child.key,
                name=child.name,
                types=child.types,
                item_count=sum(per_type[t] for t in child.types),
            )
            for child in group.children
        ]
        groups.append(
            GroupResponse(
                id=group.id,
                key=group.key,
                name=group.name,
                item_count=sum(child.item_count for child in children),
                children=children,
            )
        )
    return CategoriesResponse(
        customised=customised, groups=groups, unplaced_types=unplaced_types(tree)
    )


@router.get("/categories", response_model=CategoriesResponse)
async def get_categories(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    home_id: UUID | None = None,
) -> CategoriesResponse:
    """The person's categories and how many of their items are in each. With home_id, the
    counts are of the items kept in that home."""
    own = await stored_tree(db, current_user.id)
    return await _response(db, current_user, own or default_tree(), own is not None, home_id)


@router.put("/categories", response_model=CategoriesResponse)
async def replace_categories(
    tree: CategoryTree,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CategoriesResponse:
    """Save the person's own arrangement of categories, whole."""
    await save_tree(db, current_user.id, tree)
    await db.commit()
    return await _response(db, current_user, tree, True, None)


@router.delete("/categories", status_code=status.HTTP_204_NO_CONTENT)
async def reset_categories(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Go back to the built-in categories."""
    await reset_tree(db, current_user.id)
    await db.commit()


__all__ = ["router", "tree_for"]
