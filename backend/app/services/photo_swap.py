"""Gives an item a better main photo while keeping the person's own (our fork).

Used by "Find the exact product" (the shop's picture) and the catalogue photo. The new picture
is stored and cleaned like any upload; the old main photo moves to the item's extra photos, so
it can be made the main photo again at any time.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import ClothingItem, ItemImage
from app.services.auto_background import remove_background_on_add
from app.services.image_service import ImageService

MAX_EXTRA_PHOTOS = 4


class TooManyPhotos(Exception):
    """The item already keeps as many extra photos as it can."""


async def replace_main_photo(
    db: AsyncSession, item: ClothingItem, image_bytes: bytes, *, filename: str = "photo.jpg"
) -> None:
    count = (
        await db.execute(select(func.count()).where(ItemImage.item_id == item.id))
    ).scalar() or 0
    if count >= MAX_EXTRA_PHOTOS:
        raise TooManyPhotos

    images = ImageService()
    paths = await images.process_and_store(
        user_id=item.user_id, image_data=image_bytes, original_filename=filename
    )
    await remove_background_on_add(paths)

    # The own photo is kept as it is shown now (cleaned, with its cut-out beside it). Its
    # untouched copy goes: the extra photos have no place for it.
    db.add(
        ItemImage(
            item_id=item.id,
            image_path=item.image_path,
            thumbnail_path=item.thumbnail_path,
            medium_path=item.medium_path,
            position=count,
        )
    )
    old_backup = item.original_image_path
    item.image_path = paths["image_path"]
    item.medium_path = paths["medium_path"]
    item.thumbnail_path = paths["thumbnail_path"]
    item.image_hash = paths["image_hash"]
    item.original_image_path = paths.get("original_backup_path")
    await db.flush()
    if old_backup and old_backup != item.original_image_path:
        full = images.get_image_path(old_backup)
        if full.exists():
            full.unlink()
