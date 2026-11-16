"""Make see-through cut-outs for items whose background was removed before cut-outs existed.

Those items have a photo on white and a kept original, but nothing see-through. This re-runs
the removal on each kept original and saves only the cut-outs; the photo on white is left as
it is. Safe to run again: items that already have cut-outs are skipped.

    python -m scripts.make_cutouts            # do it
    python -m scripts.make_cutouts --dry-run  # only count
"""

import argparse
import asyncio

from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.item import ClothingItem
from app.services import background_removal
from app.services.image_service import ImageService
from app.utils.cutouts import cutout_paths, write_cutouts


async def main(dry_run: bool) -> None:
    engine = create_async_engine(str(get_settings().database_url))
    storage = ImageService().storage_path
    made = skipped = missing = 0
    async with async_sessionmaker(engine)() as db:
        rows = (
            await db.execute(
                select(ClothingItem.image_path, ClothingItem.original_image_path).where(
                    ClothingItem.original_image_path.is_not(None)
                )
            )
        ).all()
    for image_path, original_path in rows:
        if (storage / cutout_paths(image_path)[0]).is_file():
            skipped += 1
            continue
        original = storage / original_path
        if not original.is_file():
            missing += 1
            continue
        if not dry_run:
            with Image.open(original) as image:
                cutout = background_removal.get_provider().remove(image.convert("RGB"))
            write_cutouts(storage, image_path, cutout)
        made += 1
    await engine.dispose()
    verb = "would make" if dry_run else "made"
    print(f"{verb} {made}, already had {skipped}, original missing {missing}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(main(parser.parse_args().dry_run))
