"""Homes: the places a person keeps their wardrobe, and which one they are in now."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.database import DbSession
from app.models.home import Home
from app.models.item import ClothingItem
from app.models.user import User
from app.schemas.text import SingleLineName
from app.schemas.user import Latitude, Longitude
from app.utils.auth import get_current_user

router = APIRouter(prefix="/homes", tags=["Homes"])

MAX_HOMES_PER_USER = 12
MAX_ITEMS_PER_MOVE = 500

HomeName = Annotated[SingleLineName, Field(max_length=60)]
CityName = Annotated[SingleLineName, Field(max_length=100)]


class HomeCreate(BaseModel):
    name: HomeName
    city: CityName
    lat: Latitude | None = None
    lon: Longitude | None = None


class HomeUpdate(BaseModel):
    name: HomeName | None = None
    city: CityName | None = None
    lat: Latitude | None = None
    lon: Longitude | None = None


class HomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    city: str
    lat: float | None = None
    lon: float | None = None
    is_current: bool = False
    item_count: int = 0


class MoveItemsRequest(BaseModel):
    item_ids: list[UUID] = Field(min_length=1, max_length=MAX_ITEMS_PER_MOVE)


class MoveItemsResponse(BaseModel):
    moved: int


def _response(home: Home, user: User, item_count: int = 0) -> HomeResponse:
    return HomeResponse(
        id=home.id,
        name=home.name,
        city=home.city,
        lat=float(home.lat) if home.lat is not None else None,
        lon=float(home.lon) if home.lon is not None else None,
        is_current=user.current_home_id == home.id,
        item_count=item_count,
    )


async def _owned_home(db: DbSession, user: User, home_id: UUID) -> Home:
    home = await db.scalar(select(Home).where(Home.id == home_id, Home.user_id == user.id))
    if home is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home not found")
    return home


async def _item_count(db: DbSession, home: Home) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(ClothingItem)
        .where(ClothingItem.home_id == home.id, ClothingItem.is_archived.is_(False))
    )
    return count or 0


def _point_weather_at(user: User, home: Home) -> None:
    # Weather reads the user's saved location; with no coordinates it geocodes the name.
    user.location_name = home.city
    user.location_lat = home.lat
    user.location_lon = home.lon


def _duplicate_name() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail="You already have a home with that name"
    )


async def _name_taken(db: DbSession, user: User, name: str, except_id: UUID | None = None) -> bool:
    query = select(Home.id).where(Home.user_id == user.id, Home.name == name)
    if except_id is not None:
        query = query.where(Home.id != except_id)
    return await db.scalar(query) is not None


@router.get("", response_model=list[HomeResponse])
async def list_homes(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[HomeResponse]:
    counts = (
        select(ClothingItem.home_id, func.count().label("n"))
        .where(ClothingItem.user_id == current_user.id, ClothingItem.is_archived.is_(False))
        .group_by(ClothingItem.home_id)
        .subquery()
    )
    rows = await db.execute(
        select(Home, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.home_id == Home.id)
        .where(Home.user_id == current_user.id)
        .order_by(Home.created_at, Home.id)
    )
    return [_response(home, current_user, count) for home, count in rows.all()]


@router.post("", response_model=HomeResponse, status_code=status.HTTP_201_CREATED)
async def create_home(
    data: HomeCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> HomeResponse:
    existing = await db.scalar(
        select(func.count()).select_from(Home).where(Home.user_id == current_user.id)
    )
    if (existing or 0) >= MAX_HOMES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"You can have at most {MAX_HOMES_PER_USER} homes",
        )
    if await _name_taken(db, current_user, data.name):
        raise _duplicate_name()

    home = Home(user_id=current_user.id, **data.model_dump())
    db.add(home)
    try:
        await db.flush()
    except IntegrityError as e:
        # Two requests adding the same name at once: the unique constraint settles it.
        await db.rollback()
        raise _duplicate_name() from e

    # The first home is where the user is, and where the wardrobe they already have lives.
    if not existing:
        current_user.current_home_id = home.id
        _point_weather_at(current_user, home)
        await db.execute(
            update(ClothingItem)
            .where(ClothingItem.user_id == current_user.id, ClothingItem.home_id.is_(None))
            .values(home_id=home.id)
        )
        await db.flush()

    return _response(home, current_user, await _item_count(db, home))


@router.patch("/{home_id}", response_model=HomeResponse)
async def update_home(
    home_id: UUID,
    data: HomeUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> HomeResponse:
    home = await _owned_home(db, current_user, home_id)
    changes = data.model_dump(exclude_unset=True)
    for required in ("name", "city"):
        if required in changes and changes[required] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{required} cannot be empty",
            )
    if "name" in changes and await _name_taken(db, current_user, changes["name"], home.id):
        raise _duplicate_name()
    # A new city without new coordinates must not keep pointing at the old place.
    if "city" in changes and changes["city"] != home.city:
        changes.setdefault("lat", None)
        changes.setdefault("lon", None)
    for field, value in changes.items():
        setattr(home, field, value)
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise _duplicate_name() from e

    if current_user.current_home_id == home.id:
        _point_weather_at(current_user, home)
        await db.flush()
    return _response(home, current_user, await _item_count(db, home))


@router.delete("/{home_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_home(
    home_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    # Items kept there are not deleted: the foreign key leaves them without a home.
    home = await _owned_home(db, current_user, home_id)
    if current_user.current_home_id == home.id:
        current_user.current_home_id = None
        await db.flush()
    await db.delete(home)
    await db.flush()


@router.post("/{home_id}/current", response_model=HomeResponse)
async def set_current_home(
    home_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> HomeResponse:
    home = await _owned_home(db, current_user, home_id)
    current_user.current_home_id = home.id
    _point_weather_at(current_user, home)
    await db.flush()
    return _response(home, current_user, await _item_count(db, home))


@router.post("/{home_id}/items", response_model=MoveItemsResponse)
async def move_items_to_home(
    home_id: UUID,
    data: MoveItemsRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> MoveItemsResponse:
    home = await _owned_home(db, current_user, home_id)
    result = await db.execute(
        update(ClothingItem)
        .where(ClothingItem.user_id == current_user.id, ClothingItem.id.in_(data.item_ids))
        .values(home_id=home.id)
    )
    await db.flush()
    return MoveItemsResponse(moved=result.rowcount or 0)
