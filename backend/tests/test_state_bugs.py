"""Each bug found in the review of the app's state handling, reproduced through the public API
only, so the same test runs on the code before and after the fix (our fork)."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.models.item import ClothingItem, ItemStatus

LAUNDRY = "/api/v1/laundry"


async def _items(db_session, user_id, needs_wash=False, count=3):
    items = [
        ClothingItem(
            id=uuid4(),
            user_id=user_id,
            type=item_type,
            image_path=f"test/{item_type}.jpg",
            status=ItemStatus.ready,
            needs_wash=needs_wash,
            wears_since_wash=3 if needs_wash else 0,
        )
        for item_type in ("t-shirt", "jeans", "sneakers")[:count]
    ]
    db_session.add_all(items)
    await db_session.commit()
    return [str(item.id) for item in items]


async def _states(client, auth_headers):
    return (await client.get(f"{LAUNDRY}/states", headers=auth_headers)).json()


@pytest.mark.asyncio
async def test_bug_archiving_a_piece_in_the_wash_leaves_it_in_the_wash(
    client: AsyncClient, db_session, test_user, auth_headers
):
    [item_id] = await _items(db_session, test_user.id, needs_wash=True, count=1)
    await client.post(
        f"{LAUNDRY}/move", json={"item_ids": [item_id], "to": "wash"}, headers=auth_headers
    )
    archived = await client.post(f"/api/v1/items/{item_id}/archive", json={}, headers=auth_headers)
    assert archived.status_code == 200
    assert await _states(client, auth_headers) == []


@pytest.mark.asyncio
async def test_bug_wearing_a_piece_marked_in_the_wash_leaves_it_in_the_wash(
    client: AsyncClient, db_session, test_user, auth_headers
):
    item_ids = await _items(db_session, test_user.id)
    await client.post(
        f"{LAUNDRY}/move", json={"item_ids": item_ids[:1], "to": "wash"}, headers=auth_headers
    )
    created = await client.post(
        "/api/v1/outfits/studio",
        json={"items": item_ids, "occasion": "casual", "scheduled_for": "2026-11-21"},
        headers=auth_headers,
    )
    worn = await client.post(
        f"/api/v1/outfits/{created.json()['id']}/feedback",
        json={"worn": True},
        headers=auth_headers,
    )
    assert worn.status_code == 200
    assert await _states(client, auth_headers) == []


@pytest.mark.asyncio
async def test_bug_mark_washed_refuses_a_clean_piece_that_was_sent_to_the_wash(
    client: AsyncClient, db_session, test_user, auth_headers
):
    [item_id] = await _items(db_session, test_user.id, count=1)
    await client.post(
        f"{LAUNDRY}/move", json={"item_ids": [item_id], "to": "wash"}, headers=auth_headers
    )
    washed = await client.post(f"/api/v1/items/{item_id}/wash", json={}, headers=auth_headers)
    assert washed.status_code == 200
    assert await _states(client, auth_headers) == []


@pytest.mark.asyncio
async def test_bug_back_counts_a_piece_that_never_left(
    client: AsyncClient, db_session, test_user, auth_headers
):
    [item_id] = await _items(db_session, test_user.id, needs_wash=True, count=1)
    back = await client.post(
        f"{LAUNDRY}/move", json={"item_ids": [item_id], "to": "back"}, headers=auth_headers
    )
    assert back.json() == {"moved": 0}


@pytest.mark.asyncio
async def test_bug_a_lookbook_look_marked_worn_gets_locked(
    client: AsyncClient, db_session, test_user, auth_headers
):
    item_ids = await _items(db_session, test_user.id)
    look = await client.post(
        "/api/v1/outfits/studio",
        json={"items": item_ids, "occasion": "casual"},
        headers=auth_headers,
    )
    look_id = look.json()["id"]
    await client.post(
        f"/api/v1/outfits/{look_id}/feedback", json={"worn": True}, headers=auth_headers
    )
    # The saved look must stay editable.
    edited = await client.patch(
        f"/api/v1/outfits/{look_id}", json={"items": item_ids[:2]}, headers=auth_headers
    )
    assert edited.status_code == 200


@pytest.mark.asyncio
async def test_bug_changing_the_occasion_while_editing_is_not_saved(
    client: AsyncClient, db_session, test_user, auth_headers
):
    item_ids = await _items(db_session, test_user.id)
    look = await client.post(
        "/api/v1/outfits/studio",
        json={"items": item_ids, "occasion": "casual"},
        headers=auth_headers,
    )
    edited = await client.patch(
        f"/api/v1/outfits/{look.json()['id']}", json={"occasion": "wedding"}, headers=auth_headers
    )
    assert edited.status_code == 200
    assert edited.json()["occasion"] == "wedding"
