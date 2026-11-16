"""A clothes photo has its background removed as the item is added."""

from io import BytesIO
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.item import ClothingItem
from app.services.image_service import ImageService

WALL = (120, 60, 40)
SHIRT = (20, 60, 160)


def _photo() -> bytes:
    """A blue garment in the middle of a brown wall."""
    image = Image.new("RGB", (400, 400), WALL)
    ImageDraw.Draw(image).rectangle([120, 120, 280, 280], fill=SHIRT)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()


class _KeepsTheMiddle:
    """Stands in for the removal model: everything outside the middle square is background."""

    def remove(self, image: Image.Image) -> Image.Image:
        result = image.convert("RGBA")
        mask = Image.new("L", image.size, 0)
        w, h = image.size
        ImageDraw.Draw(mask).rectangle([w * 0.3, h * 0.3, w * 0.7, h * 0.7], fill=255)
        result.putalpha(mask)
        return result


class _Broken:
    def remove(self, image: Image.Image) -> Image.Image:
        raise RuntimeError("model missing")


def _redis_pool():
    job = AsyncMock()
    job.job_id = str(uuid4())
    pool = AsyncMock()
    pool.enqueue_job.return_value = job
    return pool


async def _upload(client: AsyncClient, auth_headers: dict, provider) -> dict:
    with (
        patch("app.services.background_removal.get_provider", return_value=provider),
        patch("app.api.items.create_pool", new_callable=AsyncMock, return_value=_redis_pool()),
    ):
        response = await client.post(
            "/api/v1/items",
            files={"image": ("shirt.jpg", _photo(), "image/jpeg")},
            headers=auth_headers,
        )
    assert response.status_code == 201, response.text
    return response.json()


def _close_to(pixel: tuple, colour: tuple) -> bool:
    return all(abs(a - b) < 25 for a, b in zip(pixel[:3], colour, strict=True))


async def _stored(db: AsyncSession, item_id: str) -> ClothingItem:
    return (await db.execute(select(ClothingItem).where(ClothingItem.id == item_id))).scalar_one()


@pytest.fixture
def auto_removal_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "auto_remove_background", True)


class TestBackgroundRemovedOnAdd:
    @pytest.mark.asyncio
    async def test_new_item_is_stored_on_white_and_keeps_its_original(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers, _KeepsTheMiddle())

        item = await _stored(db_session, created["id"])
        storage = ImageService().storage_path
        for path in (item.image_path, item.medium_path, item.thumbnail_path):
            with Image.open(storage / path) as image:
                w, h = image.size
                assert _close_to(image.getpixel((5, 5)), (255, 255, 255)), path
                assert _close_to(image.getpixel((w // 2, h // 2)), SHIRT), path
        # The untouched photo is kept, which is what "undo background removal" restores.
        assert item.original_image_path
        with Image.open(storage / item.original_image_path) as original:
            assert _close_to(original.getpixel((5, 5)), WALL)

    @pytest.mark.asyncio
    async def test_item_is_still_added_when_removal_fails(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers, _Broken())

        item = await _stored(db_session, created["id"])
        assert item.original_image_path is None
        with Image.open(ImageService().storage_path / item.image_path) as image:
            assert _close_to(image.getpixel((5, 5)), WALL)

    @pytest.mark.asyncio
    async def test_photo_is_left_alone_when_the_setting_is_off(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, monkeypatch
    ):
        monkeypatch.setattr(get_settings(), "auto_remove_background", False)
        provider = _KeepsTheMiddle()

        with patch.object(provider, "remove", wraps=provider.remove) as remove:
            created = await _upload(client, auth_headers, provider)

        remove.assert_not_called()
        item = await _stored(db_session, created["id"])
        assert item.original_image_path is None
