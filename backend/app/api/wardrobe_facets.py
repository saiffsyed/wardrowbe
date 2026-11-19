"""What a person's own wardrobe can be filtered by: the brands, occasions and materials in it."""

from collections import Counter
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.database import DbSession
from app.models.item import ClothingItem
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/wardrobe", tags=["Wardrobe"])


class FacetValue(BaseModel):
    value: str
    count: int


class WardrobeFacets(BaseModel):
    brands: list[FacetValue]
    occasions: list[FacetValue]
    materials: list[FacetValue]
    # The main colour of each item, for the colour filter.
    colors: list[FacetValue]


def _ranked(counts: Counter[str]) -> list[FacetValue]:
    # Most common first, then alphabetical, so the list does not reshuffle between visits.
    return [
        FacetValue(value=value, count=count)
        for value, count in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    ]


@router.get("/facets", response_model=WardrobeFacets)
async def wardrobe_facets(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    home_id: UUID | None = None,
) -> WardrobeFacets:
    """Filter options drawn from the items themselves, so no option ever leads to nothing.

    A wardrobe is a few hundred rows at most, so the three columns are read once and counted
    here rather than with three aggregate queries over JSONB.
    """
    query = select(
        ClothingItem.brand, ClothingItem.material, ClothingItem.tags, ClothingItem.primary_color
    ).where(ClothingItem.user_id == current_user.id, ClothingItem.is_archived.is_(False))
    if home_id is not None:
        query = query.where(ClothingItem.home_id == home_id)

    brands: Counter[str] = Counter()
    brand_spelling: dict[str, str] = {}
    occasions: Counter[str] = Counter()
    materials: Counter[str] = Counter()
    colors: Counter[str] = Counter()
    for brand, material, tags, primary_color in (await db.execute(query)).all():
        if primary_color:
            colors[primary_color] += 1
        tags = tags if isinstance(tags, dict) else {}
        if brand and brand.strip():
            # The filter matches brands case-insensitively, so "Zara" and "ZARA" are one option,
            # shown the way it was first typed.
            key = brand.strip().lower()
            brand_spelling.setdefault(key, brand.strip())
            brands[key] += 1
        occasions.update({o for o in tags.get("occasions") or [] if isinstance(o, str) and o})
        in_item = {material.strip().lower()} if material and material.strip() else set()
        for share in tags.get("composition") or []:
            if isinstance(share, dict) and isinstance(share.get("material"), str):
                in_item.add(share["material"])
        materials.update(m for m in in_item if m)

    return WardrobeFacets(
        brands=[FacetValue(value=brand_spelling[f.value], count=f.count) for f in _ranked(brands)],
        occasions=_ranked(occasions),
        materials=_ranked(materials),
        colors=_ranked(colors),
    )
