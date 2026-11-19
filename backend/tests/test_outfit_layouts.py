"""Saving how a look is arranged on the outfit board."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import ClothingItem, ItemStatus
from app.models.outfit import Outfit, OutfitItem, OutfitSource, OutfitStatus
from app.models.user import User

LAYOUTS = "/api/v1/outfit-layouts"


async def _outfit(
    db: AsyncSession, user: User, count: int = 2
) -> tuple[Outfit, list[ClothingItem]]:
    items = []
    for i in range(count):
        item = ClothingItem(
            user_id=user.id,
            type="shirt",
            name=f"piece {i}",
            image_path=f"{user.id}/p{i}.jpg",
            status=ItemStatus.ready,
        )
        db.add(item)
        items.append(item)
    await db.flush()
    outfit = Outfit(
        user_id=user.id, occasion="casual", source=OutfitSource.manual, status=OutfitStatus.accepted
    )
    db.add(outfit)
    await db.flush()
    for i, item in enumerate(items):
        db.add(OutfitItem(outfit_id=outfit.id, item_id=item.id, position=i))
    await db.flush()
    return outfit, items


class TestOutfitLayouts:
    @pytest.mark.asyncio
    async def test_a_saved_arrangement_comes_back_as_it_was(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        outfit, items = await _outfit(db_session, test_user)
        body = {
            "background": "#f6f1e7",
            "pieces": [
                {"item_id": str(items[0].id), "x": 20, "y": 10, "w": 46, "z": 2},
                {"item_id": str(items[1].id), "x": 25, "y": 45, "w": 40, "z": 1},
                # Not in the outfit, so left out.
                {"item_id": str(uuid4()), "x": 0, "y": 0, "w": 10, "z": 3},
            ],
        }
        saved = await client.put(f"{LAYOUTS}/{outfit.id}", json=body, headers=auth_headers)
        assert saved.status_code == 200, saved.text
        assert len(saved.json()["pieces"]) == 2

        listed = await client.get(
            LAYOUTS, params={"ids": f"{outfit.id},{uuid4()}"}, headers=auth_headers
        )
        assert listed.status_code == 200
        [layout] = listed.json()
        assert layout["background"] == "#f6f1e7"
        assert layout["pieces"][0]["x"] == 20

        moved = {**body, "pieces": [{**body["pieces"][0], "x": 30}]}
        again = await client.put(f"{LAYOUTS}/{outfit.id}", json=moved, headers=auth_headers)
        assert again.json()["pieces"] == [
            {"item_id": str(items[0].id), "x": 30, "y": 10, "w": 46, "z": 2}
        ]

    @pytest.mark.asyncio
    async def test_only_offered_backgrounds_and_own_outfits(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        outfit, items = await _outfit(db_session, test_user, 1)
        piece = {"item_id": str(items[0].id), "x": 1, "y": 1, "w": 20, "z": 1}
        odd = await client.put(
            f"{LAYOUTS}/{outfit.id}",
            json={"background": "#123456", "pieces": [piece]},
            headers=auth_headers,
        )
        assert odd.status_code == 422
        missing = await client.put(
            f"{LAYOUTS}/{uuid4()}", json={"pieces": [piece]}, headers=auth_headers
        )
        assert missing.status_code == 404
