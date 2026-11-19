"""Clothes to wash, in the wash and at the dry cleaner."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import ClothingItem, ItemStatus, WashHistory
from app.models.laundry import away_item_ids
from app.models.user import User

URL = "/api/v1/laundry"


async def _item(db: AsyncSession, user: User, name: str, needs_wash: bool = False) -> ClothingItem:
    item = ClothingItem(
        user_id=user.id,
        type="shirt",
        name=name,
        image_path=f"{user.id}/{name}.jpg",
        status=ItemStatus.ready,
        needs_wash=needs_wash,
        wears_since_wash=3 if needs_wash else 0,
    )
    db.add(item)
    await db.flush()
    return item


def _names(items: list[dict]) -> list[str]:
    return sorted(item["name"] for item in items)


class TestLaundry:
    @pytest.mark.asyncio
    async def test_to_wash_then_washing_then_back(
        self, client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
    ):
        worn = await _item(db_session, test_user, "worn", needs_wash=True)
        silk = await _item(db_session, test_user, "silk", needs_wash=True)
        await _item(db_session, test_user, "clean")

        response = await client.get(URL, headers=auth_headers)
        assert response.status_code == 200, response.text
        lists = response.json()
        assert _names(lists["to_wash"]) == ["silk", "worn"]
        assert lists["wash"] == [] and lists["dry"] == []

        moved = await client.post(
            f"{URL}/move", json={"item_ids": [str(worn.id)], "to": "wash"}, headers=auth_headers
        )
        assert moved.json() == {"moved": 1}
        await client.post(
            f"{URL}/move", json={"item_ids": [str(silk.id)], "to": "dry"}, headers=auth_headers
        )
        lists = (await client.get(URL, headers=auth_headers)).json()
        assert lists["to_wash"] == []
        assert _names(lists["wash"]) == ["worn"]
        assert _names(lists["dry"]) == ["silk"]
        states = (await client.get(f"{URL}/states", headers=auth_headers)).json()
        assert {s["state"] for s in states} == {"wash", "dry"}
        assert await away_item_ids(db_session, test_user.id) == {worn.id, silk.id}

        back = await client.post(
            f"{URL}/move",
            json={"item_ids": [str(worn.id), str(silk.id)], "to": "back"},
            headers=auth_headers,
        )
        assert back.json() == {"moved": 2}
        lists = (await client.get(URL, headers=auth_headers)).json()
        assert lists == {"to_wash": [], "wash": [], "dry": []}
        await db_session.refresh(worn)
        assert worn.needs_wash is False and worn.wears_since_wash == 0
        methods = (
            (
                await db_session.execute(
                    select(WashHistory.method).where(WashHistory.item_id == silk.id)
                )
            )
            .scalars()
            .all()
        )
        assert methods == ["dry_clean"]

    @pytest.mark.asyncio
    async def test_only_own_clothes(
        self, client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
    ):
        other = User(email="someone@example.com", display_name="Someone", timezone="UTC")
        db_session.add(other)
        await db_session.flush()
        theirs = await _item(db_session, other, "theirs")
        response = await client.post(
            f"{URL}/move", json={"item_ids": [str(theirs.id)], "to": "wash"}, headers=auth_headers
        )
        assert response.status_code == 404


class TestMarkWashed:
    @pytest.mark.asyncio
    async def test_marking_washed_brings_it_back(
        self, client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
    ):
        worn = await _item(db_session, test_user, "worn", needs_wash=True)
        await client.post(
            f"{URL}/move", json={"item_ids": [str(worn.id)], "to": "wash"}, headers=auth_headers
        )
        # As in the app, the endpoint reads the item afresh (with its extra photos).
        db_session.expunge(worn)
        response = await client.post(f"/api/v1/items/{worn.id}/wash", json={}, headers=auth_headers)
        assert response.status_code == 200, response.text
        assert (await client.get(f"{URL}/states", headers=auth_headers)).json() == []
