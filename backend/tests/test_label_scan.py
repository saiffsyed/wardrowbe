"""Scanning an item's care label: the photos that are kept and the details that are suggested."""

from io import BytesIO
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import create_access_token
from app.config import get_settings
from app.models.item import ClothingItem, ItemStatus
from app.models.label_photo import ItemLabelPhoto
from app.models.user import User
from app.services.ai_service import AIService
from app.services.image_service import ImageService
from app.services.label_reader import LabelReading, MaterialReading, parse_label_reading
from tests.identity_helpers import add_users_with_identities

ITEMS = "/api/v1/items"


def _jpeg(size: tuple[int, int] = (3000, 2000)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (240, 240, 235)).save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _files(count: int = 1) -> list:
    return [("images", (f"label{i}.jpg", _jpeg(), "image/jpeg")) for i in range(count)]


async def _item(db: AsyncSession, user: User, **fields) -> ClothingItem:
    item = ClothingItem(
        id=uuid4(),
        user_id=user.id,
        image_path="x.jpg",
        type="shirt",
        status=ItemStatus.ready,
        tags=fields.pop("tags", {}),
        **fields,
    )
    db.add(item)
    await db.commit()
    return item


async def _photos(db: AsyncSession, item: ClothingItem) -> list[ItemLabelPhoto]:
    result = await db.execute(select(ItemLabelPhoto).where(ItemLabelPhoto.item_id == item.id))
    return list(result.scalars().all())


def _ai_answers(content: str | None = None, error: Exception | None = None):
    return patch.object(
        AIService, "_call_with_fallback", AsyncMock(return_value=(content, error, None))
    )


@pytest.fixture
def vision_on(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "ai_internal_enabled", True)
    monkeypatch.setattr(settings, "ai_vision_enabled", True)
    assert settings.effective_ai_vision_enabled


@pytest.fixture
def vision_off(monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_internal_enabled", False)


GOOD_ANSWER = """```json
{"brand": "Fabindia", "size": "42", "size_system": "eu",
 "composition": [{"material": "Cotton", "percent": "70%"}, {"material": "linen", "percent": 30}],
 "care_instructions": "Machine wash at 30°C, do not tumble dry"}
```"""


class TestParseLabelReading:
    def test_reads_an_answer_wrapped_in_a_code_fence(self):
        reading = parse_label_reading(GOOD_ANSWER)

        assert reading == LabelReading(
            brand="Fabindia",
            size="42",
            size_system="EU",
            composition=[
                MaterialReading(material="cotton", percent=70),
                MaterialReading(material="linen", percent=30),
            ],
            care_instructions="Machine wash at 30°C, do not tumble dry",
        )

    def test_placeholders_for_nothing_are_dropped(self):
        reading = parse_label_reading(
            '{"brand": "unknown", "size": "N/A", "size_system": "European", '
            '"composition": [], "care_instructions": null}'
        )

        assert not reading.has_content()

    def test_a_numeric_size_is_kept_as_text(self):
        assert parse_label_reading('{"size": 40}').size == "40"

    def test_a_composition_over_100_percent_is_left_for_the_person(self):
        reading = parse_label_reading(
            '{"brand": "X", "composition": [{"material": "cotton", "percent": 100}, '
            '{"material": "polyester", "percent": 100}]}'
        )

        assert reading.brand == "X"
        assert reading.composition == []

    def test_unusable_material_lines_are_skipped(self):
        reading = parse_label_reading(
            '{"composition": [{"material": "wool", "percent": 80}, {"material": "", "percent": 20},'
            ' {"material": "nylon", "percent": "some"}, "silk", {"material": "wool", "percent": 5}]}'
        )

        assert reading.composition == [MaterialReading(material="wool", percent=80)]

    def test_text_that_is_not_json_reads_as_nothing(self):
        assert not parse_label_reading("I cannot read this label.").has_content()

    def test_overlong_text_is_cut_to_what_an_item_can_hold(self):
        reading = parse_label_reading('{"care_instructions": "' + "wash, " * 80 + '"}')

        assert len(reading.care_instructions) <= 255
        assert not reading.care_instructions.endswith(",")


class TestLabelScan:
    @pytest.mark.asyncio
    async def test_keeps_the_photos_and_suggests_details_without_changing_the_item(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_on
    ):
        item = await _item(db_session, test_user, brand="Old brand", tags={"size": "M"})

        with _ai_answers(GOOD_ANSWER) as call:
            response = await client.post(
                f"{ITEMS}/{item.id}/label-scan", files=_files(2), headers=auth_headers
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "read"
        assert body["reading"]["brand"] == "Fabindia"
        assert body["reading"]["composition"][0] == {"material": "cotton", "percent": 70}
        assert len(body["photos"]) == 2
        assert "sig=" in body["photos"][0]["image_url"]

        # Both photos went to the model in one question.
        messages = call.await_args.args[0]
        assert len(messages[1]["content"]) == 2

        await db_session.refresh(item)
        assert item.brand == "Old brand"
        assert item.tags == {"size": "M"}

    @pytest.mark.asyncio
    async def test_stored_photos_are_compressed_copies_with_a_thumbnail(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_on
    ):
        item = await _item(db_session, test_user)

        with _ai_answers(GOOD_ANSWER):
            await client.post(f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=auth_headers)

        (photo,) = await _photos(db_session, item)
        storage = ImageService().storage_path
        with Image.open(storage / photo.image_path) as full:
            assert max(full.size) == 1600
        with Image.open(storage / photo.thumbnail_path) as thumb:
            assert max(thumb.size) == 400

    @pytest.mark.asyncio
    async def test_care_text_is_asked_for_in_the_persons_language(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_on
    ):
        test_user.locale = "de"
        item = await _item(db_session, test_user)

        with _ai_answers(GOOD_ANSWER) as call:
            await client.post(f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=auth_headers)

        assert "in German" in call.await_args.args[0][0]["content"]

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("content", "error", "expected"),
        [
            ('{"brand": null, "composition": []}', None, "nothing_read"),
            (None, RuntimeError("connection refused"), "ai_unreachable"),
        ],
    )
    async def test_photos_are_kept_when_nothing_could_be_read(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user,
        auth_headers,
        vision_on,
        content,
        error,
        expected,
    ):
        item = await _item(db_session, test_user)

        with _ai_answers(content, error):
            response = await client.post(
                f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=auth_headers
            )

        assert response.status_code == 200
        assert response.json()["status"] == expected
        assert response.json()["reading"] is None
        assert len(response.json()["photos"]) == 1

    @pytest.mark.asyncio
    async def test_with_ai_off_the_photos_are_kept_and_no_model_is_called(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_off
    ):
        item = await _item(db_session, test_user)

        with _ai_answers(GOOD_ANSWER) as call:
            response = await client.post(
                f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=auth_headers
            )

        assert response.json()["status"] == "ai_disabled"
        assert len(response.json()["photos"]) == 1
        call.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_more_than_three_photos_in_one_scan_is_refused(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers
    ):
        item = await _item(db_session, test_user)

        response = await client.post(
            f"{ITEMS}/{item.id}/label-scan", files=_files(4), headers=auth_headers
        )

        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "LABEL_PHOTO_COUNT"
        assert await _photos(db_session, item) == []

    @pytest.mark.asyncio
    async def test_an_item_keeps_at_most_six_label_photos(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_off
    ):
        item = await _item(db_session, test_user)
        for _ in range(2):
            ok = await client.post(
                f"{ITEMS}/{item.id}/label-scan", files=_files(3), headers=auth_headers
            )
            assert ok.status_code == 200

        response = await client.post(
            f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=auth_headers
        )

        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "LABEL_PHOTO_LIMIT"
        assert len(await _photos(db_session, item)) == 6

    @pytest.mark.asyncio
    async def test_one_unusable_file_keeps_none_of_the_scan(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_off
    ):
        item = await _item(db_session, test_user)
        files = [*_files(), ("images", ("notes.jpg", b"not an image", "image/jpeg"))]

        response = await client.post(
            f"{ITEMS}/{item.id}/label-scan", files=files, headers=auth_headers
        )

        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "INVALID_IMAGE"
        assert await _photos(db_session, item) == []

    @pytest.mark.asyncio
    async def test_someone_elses_item_is_not_found(
        self, client: AsyncClient, db_session: AsyncSession, test_user, vision_off
    ):
        item = await _item(db_session, test_user)
        other = User(
            external_id=f"other-{uuid4()}", email=f"other-{uuid4()}@example.com", display_name="O"
        )
        (identity,) = await add_users_with_identities(db_session, other)
        await db_session.commit()
        headers = {"Authorization": f"Bearer {create_access_token(other.id, identity.id)}"}

        scan = await client.post(f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=headers)
        listing = await client.get(f"{ITEMS}/{item.id}/label-photos", headers=headers)

        assert scan.status_code == 404
        assert listing.status_code == 404
        assert await _photos(db_session, item) == []


class TestLabelPhotos:
    @pytest.mark.asyncio
    async def test_lists_and_deletes_a_photo_with_its_files(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_off
    ):
        item = await _item(db_session, test_user)
        await client.post(f"{ITEMS}/{item.id}/label-scan", files=_files(2), headers=auth_headers)
        first, second = sorted(await _photos(db_session, item), key=lambda p: p.created_at)
        storage = ImageService().storage_path

        listing = await client.get(f"{ITEMS}/{item.id}/label-photos", headers=auth_headers)
        assert [p["id"] for p in listing.json()] == [str(first.id), str(second.id)]

        response = await client.delete(
            f"{ITEMS}/{item.id}/label-photos/{first.id}", headers=auth_headers
        )

        assert response.status_code == 204
        assert not (storage / first.image_path).exists()
        assert not (storage / first.thumbnail_path).exists()
        assert (storage / second.image_path).exists()
        listing = await client.get(f"{ITEMS}/{item.id}/label-photos", headers=auth_headers)
        assert [p["id"] for p in listing.json()] == [str(second.id)]

    @pytest.mark.asyncio
    async def test_deleting_the_item_removes_its_label_photo_files(
        self, client: AsyncClient, db_session: AsyncSession, test_user, auth_headers, vision_off
    ):
        item = await _item(db_session, test_user)
        await client.post(f"{ITEMS}/{item.id}/label-scan", files=_files(), headers=auth_headers)
        (photo,) = await _photos(db_session, item)
        storage = ImageService().storage_path
        assert (storage / photo.image_path).exists()

        response = await client.delete(f"{ITEMS}/{item.id}", headers=auth_headers)

        assert response.status_code == 204
        assert not (storage / photo.image_path).exists()
        assert not (storage / photo.thumbnail_path).exists()
