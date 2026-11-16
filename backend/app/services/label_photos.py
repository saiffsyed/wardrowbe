"""Stores the photos of an item's labels: one copy large enough to read, and a thumbnail."""

import asyncio
import uuid
from pathlib import Path

from PIL import ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.label_photo import ItemLabelPhoto
from app.services.image_service import ALLOWED_EXTENSIONS, ImageService, ImageVariant

# A label is kept to be read again, not admired: 1600 px keeps small print legible at roughly a
# tenth of the bytes an item photo takes.
LABEL_VARIANTS = (
    ImageVariant("image_path", "_label", 1600, 80),
    ImageVariant("thumbnail_path", "_label_thumb", 400, 80),
)


def _store(
    image_service: ImageService, user_id: uuid.UUID, image_data: bytes, original_filename: str
) -> dict[str, str]:
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}")
    image = image_service._open_bounded(image_data, ext)
    # Phones store a sideways sensor image plus an orientation tag; sideways print reads badly.
    image = ImageOps.exif_transpose(image)

    base_name = image_service._generate_filename(".jpg").rsplit(".", 1)[0]
    user_path = image_service._get_user_path(user_id)
    paths: dict[str, str] = {}
    for variant in LABEL_VARIANTS:
        filename = f"{base_name}{variant.suffix}.jpg"
        (user_path / filename).write_bytes(image_service.encode_variant(image, variant))
        paths[variant.path_field] = f"{user_id}/{filename}"
    return paths


async def store_label_photo(
    image_service: ImageService, user_id: uuid.UUID, image_data: bytes, original_filename: str
) -> dict[str, str]:
    """Compress and store one label photo. Raises ValueError for a file that is not a usable
    image."""
    return await asyncio.to_thread(_store, image_service, user_id, image_data, original_filename)


def delete_label_photo_files(image_service: ImageService, photos: list[ItemLabelPhoto]) -> None:
    for photo in photos:
        image_service.delete_images(
            {"image_path": photo.image_path, "thumbnail_path": photo.thumbnail_path}
        )


async def delete_label_photo_files_of_item(db: AsyncSession, item_id: uuid.UUID) -> None:
    """Remove an item's label photos from disk. Their rows go with the item itself."""
    photos = (
        (await db.execute(select(ItemLabelPhoto).where(ItemLabelPhoto.item_id == item_id)))
        .scalars()
        .all()
    )
    delete_label_photo_files(ImageService(), list(photos))
