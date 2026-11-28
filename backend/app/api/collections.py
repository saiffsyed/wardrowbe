"""Collections: named groups of a person's clothes and outfits, such as "Sister's wedding".

A collection belongs to the person who made it and is seen by no one else. Each entry is one
clothing item or one outfit; deleting either takes it out of every collection.
"""

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database import DbSession
from app.models.collection import Collection, CollectionEntry
from app.models.item import ClothingItem
from app.models.outfit import Outfit, OutfitItem
from app.models.user import User
from app.schemas.text import SingleLineName
from app.utils.auth import get_current_user
from app.utils.signed_urls import sign_optional

router = APIRouter(prefix="/collections", tags=["Collections"])

MAX_COLLECTIONS = 100
MAX_ENTRIES = 300
COVER_SIZE = 4


class CollectionCreate(BaseModel):
    name: SingleLineName = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def _tidy(cls, value: str) -> str:
        # Spaces typed twice or around the name are not part of it.
        return " ".join(value.split())


class CollectionUpdate(CollectionCreate):
    pass


class EntriesAdd(BaseModel):
    item_ids: list[UUID] = Field(default_factory=list, max_length=MAX_ENTRIES)
    outfit_ids: list[UUID] = Field(default_factory=list, max_length=MAX_ENTRIES)


class CollectionSummary(BaseModel):
    id: UUID
    name: str
    entry_count: int
    # Up to four pictures for the card: an item's own, or an outfit's first piece.
    cover_urls: list[str]


class EntryItem(BaseModel):
    id: UUID
    name: str | None
    type: str
    thumbnail_url: str | None


class OutfitPiece(BaseModel):
    item_id: UUID
    type: str
    thumbnail_url: str


class EntryOutfit(BaseModel):
    id: UUID
    name: str | None
    occasion: str
    scheduled_for: date | None
    thumbnail_urls: list[str]
    # The same pictures with each piece's kind, so a look can be laid out as it is worn.
    pieces: list[OutfitPiece] = []


class EntryResponse(BaseModel):
    id: UUID
    kind: Literal["item", "outfit"]
    item: EntryItem | None = None
    outfit: EntryOutfit | None = None


class CollectionDetail(BaseModel):
    id: UUID
    name: str
    entries: list[EntryResponse]


class AddResult(BaseModel):
    # Already in the collection, or not the person's own: left out without failing the rest.
    added: int
    skipped: int


async def _owned(db: DbSession, user: User, collection_id: UUID) -> Collection:
    collection = await db.scalar(
        select(Collection).where(Collection.id == collection_id, Collection.user_id == user.id)
    )
    if collection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


async def _outfit_pieces(db: DbSession, outfit_ids: list[UUID]) -> dict[UUID, list[OutfitPiece]]:
    """Each outfit's pieces with their thumbnails, in the outfit's own order."""
    if not outfit_ids:
        return {}
    rows = (
        await db.execute(
            select(
                OutfitItem.outfit_id,
                ClothingItem.id,
                ClothingItem.type,
                ClothingItem.thumbnail_path,
                ClothingItem.image_path,
            )
            .join(ClothingItem, ClothingItem.id == OutfitItem.item_id)
            .where(OutfitItem.outfit_id.in_(outfit_ids))
            .order_by(OutfitItem.outfit_id, OutfitItem.position)
        )
    ).all()
    pieces: dict[UUID, list[OutfitPiece]] = {}
    for outfit_id, item_id, item_type, thumbnail_path, image_path in rows:
        url = sign_optional(thumbnail_path, fallback=image_path)
        if url:
            pieces.setdefault(outfit_id, []).append(
                OutfitPiece(item_id=item_id, type=item_type, thumbnail_url=url)
            )
    return pieces


async def _entries(db: DbSession, collection: Collection) -> list[EntryResponse]:
    entries = (
        (
            await db.execute(
                select(CollectionEntry)
                .where(CollectionEntry.collection_id == collection.id)
                .order_by(CollectionEntry.position, CollectionEntry.added_at)
            )
        )
        .scalars()
        .all()
    )
    item_ids = [e.item_id for e in entries if e.item_id]
    outfit_ids = [e.outfit_id for e in entries if e.outfit_id]
    items = {
        i.id: i
        for i in (
            await db.execute(select(ClothingItem).where(ClothingItem.id.in_(item_ids)))
        ).scalars()
    }
    outfits = {
        o.id: o
        for o in (await db.execute(select(Outfit).where(Outfit.id.in_(outfit_ids)))).scalars()
    }
    pieces = await _outfit_pieces(db, outfit_ids)

    result: list[EntryResponse] = []
    for entry in entries:
        if entry.item_id and entry.item_id in items:
            item = items[entry.item_id]
            result.append(
                EntryResponse(
                    id=entry.id,
                    kind="item",
                    item=EntryItem(
                        id=item.id,
                        name=item.name,
                        type=item.type,
                        thumbnail_url=sign_optional(item.thumbnail_path, fallback=item.image_path),
                    ),
                )
            )
        elif entry.outfit_id and entry.outfit_id in outfits:
            outfit = outfits[entry.outfit_id]
            result.append(
                EntryResponse(
                    id=entry.id,
                    kind="outfit",
                    outfit=EntryOutfit(
                        id=outfit.id,
                        name=outfit.name,
                        occasion=outfit.occasion,
                        scheduled_for=outfit.scheduled_for,
                        thumbnail_urls=[p.thumbnail_url for p in pieces.get(outfit.id, [])],
                        pieces=pieces.get(outfit.id, []),
                    ),
                )
            )
    return result


def _cover(entries: list[EntryResponse]) -> list[str]:
    urls: list[str] = []
    for entry in entries:
        url = (
            entry.item.thumbnail_url
            if entry.item
            else (
                entry.outfit.thumbnail_urls[0]
                if entry.outfit and entry.outfit.thumbnail_urls
                else None
            )
        )
        if url:
            urls.append(url)
        if len(urls) == COVER_SIZE:
            break
    return urls


@router.get("", response_model=list[CollectionSummary])
async def list_collections(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    item_id: UUID | None = None,
    outfit_id: UUID | None = None,
) -> list[CollectionSummary]:
    """The person's collections, newest first. With item_id or outfit_id, only those holding it
    (for ticking the boxes in "Add to collection")."""
    query = (
        select(Collection)
        .where(Collection.user_id == current_user.id)
        .options(selectinload(Collection.entries))
        .order_by(Collection.created_at.desc(), Collection.id)
    )
    if item_id is not None:
        query = query.where(Collection.entries.any(CollectionEntry.item_id == item_id))
    if outfit_id is not None:
        query = query.where(Collection.entries.any(CollectionEntry.outfit_id == outfit_id))
    collections = (await db.execute(query)).scalars().all()
    summaries = []
    for collection in collections:
        entries = await _entries(db, collection)
        summaries.append(
            CollectionSummary(
                id=collection.id,
                name=collection.name,
                entry_count=len(entries),
                cover_urls=_cover(entries),
            )
        )
    return summaries


@router.post("", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CollectionSummary:
    count = await db.scalar(
        select(func.count()).select_from(Collection).where(Collection.user_id == current_user.id)
    )
    if (count or 0) >= MAX_COLLECTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can have at most {MAX_COLLECTIONS} collections",
        )
    collection = Collection(user_id=current_user.id, name=body.name)
    db.add(collection)
    await db.flush()
    return CollectionSummary(id=collection.id, name=collection.name, entry_count=0, cover_urls=[])


@router.get("/{collection_id}", response_model=CollectionDetail)
async def get_collection(
    collection_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CollectionDetail:
    collection = await _owned(db, current_user, collection_id)
    return CollectionDetail(
        id=collection.id, name=collection.name, entries=await _entries(db, collection)
    )


@router.patch("/{collection_id}", response_model=CollectionSummary)
async def rename_collection(
    collection_id: UUID,
    body: CollectionUpdate,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CollectionSummary:
    collection = await _owned(db, current_user, collection_id)
    collection.name = body.name
    await db.flush()
    entries = await _entries(db, collection)
    return CollectionSummary(
        id=collection.id,
        name=collection.name,
        entry_count=len(entries),
        cover_urls=_cover(entries),
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete the collection. Its clothes and outfits are untouched."""
    collection = await _owned(db, current_user, collection_id)
    await db.delete(collection)
    await db.flush()


@router.post("/{collection_id}/entries", response_model=AddResult)
async def add_entries(
    collection_id: UUID,
    body: EntriesAdd,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> AddResult:
    collection = await _owned(db, current_user, collection_id)
    own_items = set(
        (
            await db.execute(
                select(ClothingItem.id).where(
                    ClothingItem.user_id == current_user.id, ClothingItem.id.in_(body.item_ids)
                )
            )
        ).scalars()
    )
    own_outfits = set(
        (
            await db.execute(
                select(Outfit.id).where(
                    Outfit.user_id == current_user.id, Outfit.id.in_(body.outfit_ids)
                )
            )
        ).scalars()
    )
    existing = (
        await db.execute(
            select(CollectionEntry.item_id, CollectionEntry.outfit_id).where(
                CollectionEntry.collection_id == collection.id
            )
        )
    ).all()
    have_items = {i for i, _ in existing if i}
    have_outfits = {o for _, o in existing if o}
    if len(existing) + len(own_items - have_items) + len(own_outfits - have_outfits) > MAX_ENTRIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A collection holds at most {MAX_ENTRIES} things",
        )

    position = len(existing)
    added = 0
    # In the order sent, each once.
    for item_id in dict.fromkeys(body.item_ids):
        if item_id in own_items and item_id not in have_items:
            db.add(CollectionEntry(collection_id=collection.id, item_id=item_id, position=position))
            position += 1
            added += 1
    for outfit_id in dict.fromkeys(body.outfit_ids):
        if outfit_id in own_outfits and outfit_id not in have_outfits:
            db.add(
                CollectionEntry(collection_id=collection.id, outfit_id=outfit_id, position=position)
            )
            position += 1
            added += 1
    await db.flush()
    sent = len(set(body.item_ids)) + len(set(body.outfit_ids))
    return AddResult(added=added, skipped=sent - added)


@router.delete("/{collection_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_entry(
    collection_id: UUID,
    entry_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Take one thing out of the collection. The item or outfit itself is untouched."""
    collection = await _owned(db, current_user, collection_id)
    entry = await db.scalar(
        select(CollectionEntry).where(
            CollectionEntry.id == entry_id, CollectionEntry.collection_id == collection.id
        )
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    await db.delete(entry)
    await db.flush()
