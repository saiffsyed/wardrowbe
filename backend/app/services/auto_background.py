"""Removes the background of a clothes photo as the item is added.

The wardrobe shows clothes on a plain page, so a photo's own background (a bed, a door, a
grey wall) reads as a tile around the garment. Doing the removal before the item exists means
the tagger and every screen only ever see the cleaned photo, and nothing races the tagging job
for the file. The untouched photo is kept, so "undo background removal" still works.
"""

import asyncio
import logging

from app.config import get_settings
from app.services.image_service import ImageService

logger = logging.getLogger(__name__)


async def remove_background_on_add(image_paths: dict[str, str]) -> None:
    """Replace a just-stored photo with its background-removed version, in place.

    Adds "original_backup_path" to image_paths when it worked. A failure (the removal tool is
    not installed, or it could not handle this photo) leaves the photo as it was uploaded:
    adding an item must never fail over a cosmetic step.
    """
    if not get_settings().auto_remove_background:
        return
    try:
        out = await asyncio.to_thread(ImageService().remove_background, image_paths["image_path"])
    except Exception as e:
        logger.warning(f"Background not removed for {image_paths.get('image_path')}: {e}")
        return
    image_paths.update(out)
