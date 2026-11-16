"""See-through cut-outs: made when a background is removed, and sent to screens in place of the
photo on white."""

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
from app.utils.cutouts import cutout_paths, display_path

WALL = (120, 60, 40)
SHIRT = (20, 60, 160)


def _photo(size=(400, 600)) -> bytes:
    image = Image.new("RGB", size, WALL)
    w, h = size
    ImageDraw.Draw(image).rectangle([w * 0.3, h * 0.3, w * 0.7, h * 0.7], fill=SHIRT)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()


class _KeepsTheMiddle:
    def remove(self, image: Image.Image) -> Image.Image:
        result = image.convert("RGBA")
        mask = Image.new("L", image.size, 0)
        w, h = image.size
        ImageDraw.Draw(mask).rectangle([w * 0.3, h * 0.3, w * 0.7, h * 0.7], fill=255)
        result.putalpha(mask)
        return result


def _redis_pool():
    job = AsyncMock()
    job.job_id = str(uuid4())
    pool = AsyncMock()
    pool.enqueue_job.return_value = job
    return pool


@pytest.fixture
def auto_removal_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "auto_remove_background", True)


async def _upload(client: AsyncClient, auth_headers: dict) -> dict:
    with (
        patch("app.services.background_removal.get_provider", return_value=_KeepsTheMiddle()),
        patch("app.api.items.create_pool", new_callable=AsyncMock, return_value=_redis_pool()),
    ):
        response = await client.post(
            "/api/v1/items",
            files={"image": ("shirt.jpg", _photo(), "image/jpeg")},
            headers=auth_headers,
        )
    assert response.status_code == 201, response.text
    return response.json()


async def _stored(db: AsyncSession, item_id: str) -> ClothingItem:
    return (await db.execute(select(ClothingItem).where(ClothingItem.id == item_id))).scalar_one()


def _cutout_files(item: ClothingItem) -> list:
    storage = ImageService().storage_path
    return [storage / path for path in cutout_paths(item.image_path)]


class TestCutoutsAreMade:
    @pytest.mark.asyncio
    async def test_removing_a_background_leaves_a_see_through_copy_in_three_sizes(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers)

        item = await _stored(db_session, created["id"])
        longest_sides = []
        for file in _cutout_files(item):
            with Image.open(file) as image:
                assert image.format == "WEBP"
                rgba = image.convert("RGBA")
                w, h = rgba.size
                longest_sides.append(max(w, h))
                assert rgba.getpixel((3, 3))[3] == 0, "the wall is see-through"
                centre = rgba.getpixel((w // 2, h // 2))
                assert centre[3] == 255, "the garment is solid"
                assert all(abs(a - b) < 25 for a, b in zip(centre[:3], SHIRT, strict=True))
        assert longest_sides == [600, 600, 400]
        # The photo on white is still there for the tagger and the image tools.
        with Image.open(ImageService().storage_path / item.image_path) as flat:
            assert flat.mode == "RGB"

    @pytest.mark.asyncio
    async def test_screens_are_sent_the_cutout_and_it_can_be_fetched(
        self, client: AsyncClient, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers)

        assert "_cut.webp?" in created["image_url"]
        assert "_cut_medium.webp?" in created["medium_url"]
        assert "_cut_thumb.webp?" in created["thumbnail_url"]
        # The stored paths still name the photo on white.
        assert created["image_path"].endswith(".jpg")

        response = await client.get(created["thumbnail_url"])
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/webp"

    @pytest.mark.asyncio
    async def test_a_photo_without_a_cutout_is_sent_as_it_is(
        self, client: AsyncClient, auth_headers
    ):
        created = await _upload(client, auth_headers)

        assert ".jpg?" in created["image_url"]
        assert ".jpg?" in created["thumbnail_url"]


class TestCutoutsStayInStep:
    @pytest.mark.asyncio
    async def test_rotating_the_photo_turns_the_cutout_too(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers)
        item = await _stored(db_session, created["id"])

        ImageService().rotate_image(item.image_path, "cw")

        with Image.open(_cutout_files(item)[0]) as cutout:
            assert cutout.size == (600, 400)
            assert cutout.convert("RGBA").getpixel((3, 3))[3] == 0
        with Image.open(ImageService().storage_path / item.image_path) as flat:
            assert flat.size == (600, 400)

    @pytest.mark.asyncio
    async def test_undoing_the_removal_takes_the_cutout_away(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers)
        item = await _stored(db_session, created["id"])

        ImageService().restore_original(item.image_path, item.original_image_path)

        assert not any(file.exists() for file in _cutout_files(item))
        assert display_path(item.thumbnail_path) == item.thumbnail_path

    @pytest.mark.asyncio
    async def test_deleting_the_item_deletes_its_cutouts(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers, auto_removal_on
    ):
        created = await _upload(client, auth_headers)
        files = _cutout_files(await _stored(db_session, created["id"]))
        assert all(file.exists() for file in files)

        response = await client.delete(f"/api/v1/items/{created['id']}", headers=auth_headers)

        assert response.status_code == 204
        assert not any(file.exists() for file in files)


class TestDisplayPath:
    def test_only_an_items_own_photo_sizes_have_a_cutout_name(self, tmp_path):
        for name in ("a_cut.webp", "a_cut_medium.webp", "a_cut_thumb.webp", "b_label_cut.webp"):
            (tmp_path / name).write_bytes(b"x")

        assert display_path("a.jpg", tmp_path) == "a_cut.webp"
        assert display_path("a_medium.jpg", tmp_path) == "a_cut_medium.webp"
        assert display_path("a_thumb.jpg", tmp_path) == "a_cut_thumb.webp"
        assert display_path("c.jpg", tmp_path) == "c.jpg"
        assert display_path("a_cut.webp", tmp_path) == "a_cut.webp"
