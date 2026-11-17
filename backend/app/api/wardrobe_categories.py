"""The wardrobe's categories, with how many items each holds, and changing them. Also the kinds
of item a person adds themselves."""

from collections import Counter
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select

from app.database import DbSession
from app.models.item import ClothingItem
from app.models.user import User
from app.models.wardrobe_kind import WardrobeCustomKind
from app.services.wardrobe_category_service import (
    kinds_of,
    pairs_by_id,
    reset_tree,
    save_tree,
    stored_tree,
    tree_for,
)
from app.utils.auth import get_current_user
from app.utils.garment_vocabulary import TYPES
from app.utils.wardrobe_categories import (
    CategoryTree,
    KindPair,
    default_tree,
    filter_for,
    kind_pair,
    subtype_as_kind,
    unplaced_types,
)

router = APIRouter(prefix="/wardrobe", tags=["Wardrobe"])

MAX_KINDS = 60
_VALID_TYPES = frozenset(TYPES)


class SubGroupResponse(BaseModel):
    id: str
    key: str | None = None
    name: str | None = None
    types: list[str]
    kinds: list[str]
    item_count: int


class GroupResponse(BaseModel):
    id: str
    key: str | None = None
    name: str | None = None
    item_count: int
    children: list[SubGroupResponse]


class KindResponse(BaseModel):
    id: str
    name: str
    # The built-in garment type this is a kind of.
    base_type: str
    item_count: int


class CategoriesResponse(BaseModel):
    # False while the person still has the built-in categories.
    customised: bool
    groups: list[GroupResponse]
    # Item types that are in no category; their items show only under "All".
    unplaced_types: list[str]
    # The kinds of item the person added themselves.
    kinds: list[KindResponse]


class KindCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    base_type: str

    @field_validator("name")
    @classmethod
    def _tidy_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("a kind of item needs a name")
        return cleaned

    @field_validator("base_type")
    @classmethod
    def _built_in_type(cls, value: str) -> str:
        if value not in _VALID_TYPES:
            raise ValueError(f"not an item type: {value}")
        return value


async def _counts(db: DbSession, user: User, home_id: UUID | None) -> Counter[KindPair]:
    """How many of the person's items there are of each (type, lower-cased subtype)."""
    kind = subtype_as_kind(ClothingItem.subtype)
    query = (
        select(ClothingItem.type, kind, func.count())
        .where(ClothingItem.user_id == user.id, ClothingItem.is_archived.is_(False))
        .group_by(ClothingItem.type, kind)
    )
    if home_id is not None:
        query = query.where(ClothingItem.home_id == home_id)
    return Counter({(t, k): n for t, k, n in (await db.execute(query)).all()})


async def _response(
    db: DbSession, user: User, tree: CategoryTree, customised: bool, home_id: UUID | None
) -> CategoriesResponse:
    counts = await _counts(db, user, home_id)
    kinds = await kinds_of(db, user.id)
    pairs = pairs_by_id(kinds)

    def held(category_id: str) -> int:
        category = filter_for(tree, category_id, pairs)
        return sum(n for (type_, sub), n in counts.items() if category.holds(type_, sub))

    groups = [
        GroupResponse(
            id=group.id,
            key=group.key,
            name=group.name,
            item_count=held(group.id),
            children=[
                SubGroupResponse(
                    id=child.id,
                    key=child.key,
                    name=child.name,
                    types=child.types,
                    # A kind the person has since deleted is simply no longer listed.
                    kinds=[k for k in child.kinds if k in pairs],
                    item_count=held(child.id),
                )
                for child in group.children
            ],
        )
        for group in tree.groups
    ]
    return CategoriesResponse(
        customised=customised,
        groups=groups,
        unplaced_types=unplaced_types(tree),
        kinds=[
            KindResponse(
                id=str(kind.id),
                name=kind.name,
                base_type=kind.base_type,
                item_count=counts[pairs[str(kind.id)]],
            )
            for kind in kinds
        ],
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
    own_kinds = set(pairs_by_id(await kinds_of(db, current_user.id)))
    for group in tree.groups:
        for child in group.children:
            if any(kind not in own_kinds for kind in child.kinds):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="A category holds a kind of item that is not one of yours",
                )
    await save_tree(db, current_user.id, tree)
    await db.commit()
    return await _response(db, current_user, tree, True, None)


@router.delete("/categories", status_code=status.HTTP_204_NO_CONTENT)
async def reset_categories(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Go back to the built-in categories. The person's own kinds of item are kept."""
    await reset_tree(db, current_user.id)
    await db.commit()


@router.post("/kinds", response_model=KindResponse, status_code=status.HTTP_201_CREATED)
async def add_kind(
    body: KindCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> KindResponse:
    """Add a kind of item of the person's own, as a kind of one built-in type.

    It sits wherever that built-in type sits until it is ticked into another category.
    """
    kinds = await kinds_of(db, current_user.id)
    if len(kinds) >= MAX_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can add at most {MAX_KINDS} kinds of item",
        )
    wanted = kind_pair(body.base_type, body.name)[1]
    # A built-in type's own name would make "saree" mean two things in one wardrobe.
    if wanted in _VALID_TYPES or wanted.replace(" ", "-") in _VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That is already a kind of item"
        )
    if any(kind_pair(kind.base_type, kind.name)[1] == wanted for kind in kinds):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You already have a kind with that name"
        )
    kind = WardrobeCustomKind(user_id=current_user.id, name=body.name, base_type=body.base_type)
    db.add(kind)
    await db.commit()
    counts = await _counts(db, current_user, None)
    return KindResponse(
        id=str(kind.id),
        name=kind.name,
        base_type=kind.base_type,
        item_count=counts[kind_pair(kind.base_type, kind.name)],
    )


@router.delete("/kinds/{kind_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kind(
    kind_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Remove one of the person's own kinds of item. Items of that kind are untouched: they
    keep its name and go back to sitting with the built-in type it was a kind of."""
    kind = await db.scalar(
        select(WardrobeCustomKind).where(
            WardrobeCustomKind.id == kind_id, WardrobeCustomKind.user_id == current_user.id
        )
    )
    if kind is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kind not found")
    await db.delete(kind)
    own = await stored_tree(db, current_user.id)
    if own is not None:
        for group in own.groups:
            for child in group.children:
                child.kinds = [k for k in child.kinds if k != str(kind_id)]
        await save_tree(db, current_user.id, own)
    await db.commit()


__all__ = ["router", "tree_for"]
