"""Collections of clothes and outfits."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import create_access_token
from app.models.collection import CollectionEntry
from app.models.item import ClothingItem, ItemStatus
from app.models.outfit import Outfit, OutfitItem, OutfitSource, OutfitStatus
from app.models.user import User
from tests.identity_helpers import add_users_with_identities

COLLECTIONS = "/api/v1/collections"


async def _item(db: AsyncSession, user: User, name: str) -> ClothingItem:
    item = ClothingItem(
        id=uuid4(),
        user_id=user.id,
        image_path=f"{user.id}/{name}.jpg",
        thumbnail_path=f"{user.id}/{name}_thumb.jpg",
        type="shirt",
        name=name,
        status=ItemStatus.ready,
        tags={},
    )
    db.add(item)
    await db.commit()
    return item


async def _outfit(db: AsyncSession, user: User, *items: ClothingItem) -> Outfit:
    outfit = Outfit(
        user_id=user.id,
        occasion="wedding",
        scheduled_for=None,
        source=OutfitSource.manual,
        status=OutfitStatus.accepted,
        name="Wedding look",
    )
    db.add(outfit)
    await db.flush()
    for position, item in enumerate(items):
        db.add(OutfitItem(outfit_id=outfit.id, item_id=item.id, position=position))
    await db.commit()
    return outfit


async def _create(client: AsyncClient, headers: dict, name: str) -> dict:
    response = await client.post(COLLECTIONS, json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


class TestCollections:
    @pytest.mark.asyncio
    async def test_holds_clothes_and_outfits_in_the_order_added(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        sherwani = await _item(db_session, test_user, "sherwani")
        mojari = await _item(db_session, test_user, "mojari")
        look = await _outfit(db_session, test_user, mojari, sherwani)
        wedding = await _create(client, auth_headers, "  Sister's   wedding ")

        added = await client.post(
            f"{COLLECTIONS}/{wedding['id']}/entries",
            json={"item_ids": [str(sherwani.id), str(sherwani.id)], "outfit_ids": [str(look.id)]},
            headers=auth_headers,
        )
        again = await client.post(
            f"{COLLECTIONS}/{wedding['id']}/entries",
            json={"item_ids": [str(sherwani.id)]},
            headers=auth_headers,
        )

        assert added.json() == {"added": 2, "skipped": 0}
        assert again.json() == {"added": 0, "skipped": 1}
        detail = (await client.get(f"{COLLECTIONS}/{wedding['id']}", headers=auth_headers)).json()
        assert detail["name"] == "Sister's wedding"
        assert [e["kind"] for e in detail["entries"]] == ["item", "outfit"]
        assert detail["entries"][0]["item"]["name"] == "sherwani"
        outfit = detail["entries"][1]["outfit"]
        assert outfit["name"] == "Wedding look"
        assert "mojari_thumb.jpg" in outfit["thumbnail_urls"][0]
        assert outfit["pieces"][0]["type"] == "shirt"

        listing = (await client.get(COLLECTIONS, headers=auth_headers)).json()
        assert listing[0]["entry_count"] == 2
        assert len(listing[0]["cover_urls"]) == 2
        assert "sherwani_thumb.jpg" in listing[0]["cover_urls"][0]

    @pytest.mark.asyncio
    async def test_rename_remove_and_delete_leave_the_clothes_alone(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        shirt = await _item(db_session, test_user, "shirt")
        office = await _create(client, auth_headers, "Office")
        await client.post(
            f"{COLLECTIONS}/{office['id']}/entries",
            json={"item_ids": [str(shirt.id)]},
            headers=auth_headers,
        )
        entry_id = (await client.get(f"{COLLECTIONS}/{office['id']}", headers=auth_headers)).json()[
            "entries"
        ][0]["id"]

        renamed = await client.patch(
            f"{COLLECTIONS}/{office['id']}", json={"name": "Office in Europe"}, headers=auth_headers
        )
        removed = await client.delete(
            f"{COLLECTIONS}/{office['id']}/entries/{entry_id}", headers=auth_headers
        )
        deleted = await client.delete(f"{COLLECTIONS}/{office['id']}", headers=auth_headers)

        assert renamed.json()["name"] == "Office in Europe"
        assert removed.status_code == 204
        assert deleted.status_code == 204
        assert (await client.get(COLLECTIONS, headers=auth_headers)).json() == []
        assert await db_session.get(ClothingItem, shirt.id) is not None

    @pytest.mark.asyncio
    async def test_deleting_an_item_takes_it_out_of_its_collections(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        shirt = await _item(db_session, test_user, "shirt")
        office = await _create(client, auth_headers, "Office")
        await client.post(
            f"{COLLECTIONS}/{office['id']}/entries",
            json={"item_ids": [str(shirt.id)]},
            headers=auth_headers,
        )

        await client.delete(f"/api/v1/items/{shirt.id}", headers=auth_headers)

        left = (await db_session.execute(select(CollectionEntry))).scalars().all()
        assert left == []

    @pytest.mark.asyncio
    async def test_lists_only_the_collections_holding_an_item(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        shirt = await _item(db_session, test_user, "shirt")
        office = await _create(client, auth_headers, "Office")
        await _create(client, auth_headers, "Goa trip")
        await client.post(
            f"{COLLECTIONS}/{office['id']}/entries",
            json={"item_ids": [str(shirt.id)]},
            headers=auth_headers,
        )

        holding = (
            await client.get(f"{COLLECTIONS}?item_id={shirt.id}", headers=auth_headers)
        ).json()

        assert [c["name"] for c in holding] == ["Office"]

    @pytest.mark.asyncio
    async def test_collections_are_private(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        mine = await _create(client, auth_headers, "Mine")
        other = User(
            external_id=f"other-{uuid4()}", email=f"other-{uuid4()}@example.com", display_name="O"
        )
        (identity,) = await add_users_with_identities(db_session, other)
        await db_session.commit()
        headers = {"Authorization": f"Bearer {create_access_token(other.id, identity.id)}"}
        theirs = await _item(db_session, other, "theirs")

        assert (await client.get(COLLECTIONS, headers=headers)).json() == []
        assert (await client.get(f"{COLLECTIONS}/{mine['id']}", headers=headers)).status_code == 404
        # Their item cannot be slipped into my collection.
        result = await client.post(
            f"{COLLECTIONS}/{mine['id']}/entries",
            json={"item_ids": [str(theirs.id)]},
            headers=auth_headers,
        )
        assert result.json() == {"added": 0, "skipped": 1}

    @pytest.mark.asyncio
    async def test_a_collection_needs_a_name(self, client: AsyncClient, auth_headers: dict):
        response = await client.post(COLLECTIONS, json={"name": "   "}, headers=auth_headers)

        assert response.status_code == 422
