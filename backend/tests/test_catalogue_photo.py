"""The catalogue photo: a draft that costs money, then used or dropped."""

import base64
from io import BytesIO
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_spend import AISpend
from app.models.item import ClothingItem, ItemImage, ItemStatus
from app.models.user import User
from app.services import catalogue_photo
from app.services.image_service import ImageService

ITEMS = "/api/v1/items"


def _jpeg(colour=(90, 92, 90)) -> bytes:
    out = BytesIO()
    Image.new("RGB", (300, 400), colour).save(out, format="JPEG")
    return out.getvalue()


@pytest.fixture(autouse=True)
async def _no_spend_yet(db_session: AsyncSession):
    await db_session.execute(delete(AISpend))
    await db_session.commit()


async def _item(db: AsyncSession, user: User) -> ClothingItem:
    paths = await ImageService().process_and_store(user.id, _jpeg(), "own.jpg")
    item = ClothingItem(
        id=uuid4(),
        user_id=user.id,
        image_path=paths["image_path"],
        thumbnail_path=paths["thumbnail_path"],
        medium_path=paths["medium_path"],
        type="pants",
        status=ItemStatus.ready,
        tags={},
    )
    db.add(item)
    await db.commit()
    return item


def _ai_on():
    return (
        patch("app.api.catalogue_photo.require_internal_ai"),
        patch.object(catalogue_photo, "available", return_value=True),
    )


def test_the_picture_is_taken_from_the_answer():
    data = base64.b64encode(b"jpeg-bytes").decode()
    answer = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "here"},
                        {"inlineData": {"mimeType": "image/png", "data": data}},
                    ]
                }
            }
        ]
    }
    assert catalogue_photo.picture_from_answer(answer) == b"jpeg-bytes"
    with pytest.raises(catalogue_photo.CatalogueError):
        catalogue_photo.picture_from_answer(
            {"candidates": [{"content": {"parts": [{"text": "sorry"}]}}]}
        )


async def test_a_draft_is_made_counted_and_then_used(
    client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
):
    item = await _item(db_session, test_user)
    own = item.image_path
    first, second = _ai_on()
    with (
        first,
        second,
        patch.object(catalogue_photo, "generate", AsyncMock(return_value=_jpeg((120, 120, 125)))),
    ):
        made = await client.post(f"{ITEMS}/{item.id}/catalogue-photo", headers=auth_headers)
    body = made.json()
    assert body["status"] == "ready"
    assert body["preview"].startswith("data:image/jpeg;base64,")
    assert body["spent_cents"] == 7
    # Still a draft: nothing changed on the item.
    assert (
        await db_session.scalar(select(ClothingItem.image_path).where(ClothingItem.id == item.id))
        == own
    )

    used = await client.post(
        f"{ITEMS}/{item.id}/catalogue-photo/{body['draft_id']}/use", headers=auth_headers
    )
    assert used.status_code == 200, used.text
    assert (
        await db_session.scalar(select(ClothingItem.image_path).where(ClothingItem.id == item.id))
        != own
    )
    kept = (
        (await db_session.execute(select(ItemImage.image_path).where(ItemImage.item_id == item.id)))
        .scalars()
        .all()
    )
    assert kept == [own]
    # A draft is used once.
    again = await client.post(
        f"{ITEMS}/{item.id}/catalogue-photo/{body['draft_id']}/use", headers=auth_headers
    )
    assert again.status_code == 404


async def test_a_dropped_draft_cannot_be_used(
    client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
):
    item = await _item(db_session, test_user)
    first, second = _ai_on()
    with first, second, patch.object(catalogue_photo, "generate", AsyncMock(return_value=_jpeg())):
        draft = (
            await client.post(f"{ITEMS}/{item.id}/catalogue-photo", headers=auth_headers)
        ).json()["draft_id"]
    assert (
        await client.delete(f"{ITEMS}/{item.id}/catalogue-photo/{draft}", headers=auth_headers)
    ).status_code == 204
    used = await client.post(f"{ITEMS}/{item.id}/catalogue-photo/{draft}/use", headers=auth_headers)
    assert used.status_code == 404


async def test_a_failed_picture_is_not_charged(
    client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
):
    item = await _item(db_session, test_user)
    first, second = _ai_on()
    failing = AsyncMock(side_effect=catalogue_photo.CatalogueError("no"))
    with first, second, patch.object(catalogue_photo, "generate", failing):
        body = (
            await client.post(f"{ITEMS}/{item.id}/catalogue-photo", headers=auth_headers)
        ).json()
    assert body["status"] == "failed"
    assert body["spent_cents"] == 0


async def test_without_the_picture_model_nothing_is_made(
    client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
):
    item = await _item(db_session, test_user)
    body = (await client.post(f"{ITEMS}/{item.id}/catalogue-photo", headers=auth_headers)).json()
    assert body["status"] == "ai_disabled"


async def test_a_draft_id_from_elsewhere_is_refused(
    client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
):
    item = await _item(db_session, test_user)
    used = await client.post(
        f"{ITEMS}/{item.id}/catalogue-photo/..%2F..%2Fetc/use", headers=auth_headers
    )
    assert used.status_code == 404
