"""A Lookbook look is worn through a dated copy, never marked worn itself (our fork)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.outfit import Outfit, OutfitSource, OutfitStatus
from app.models.user import User


@pytest.mark.asyncio
async def test_a_lookbook_look_cannot_be_marked_worn(
    client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
):
    template = Outfit(
        user_id=test_user.id,
        occasion="casual",
        source=OutfitSource.manual,
        status=OutfitStatus.pending,
        scheduled_for=None,
    )
    db_session.add(template)
    await db_session.flush()
    response = await client.post(
        f"/api/v1/outfits/{template.id}/feedback", json={"worn": True}, headers=auth_headers
    )
    assert response.status_code == 409
    assert response.json()["detail"]["error_code"] == "OUTFIT_IS_TEMPLATE"
    # Other feedback on it is still fine.
    rated = await client.post(
        f"/api/v1/outfits/{template.id}/feedback", json={"rating": 4}, headers=auth_headers
    )
    assert rated.status_code == 200, rated.text


@pytest.mark.asyncio
async def test_editing_a_look_can_change_its_occasion(
    client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
):
    look = Outfit(
        user_id=test_user.id,
        occasion="casual",
        source=OutfitSource.manual,
        status=OutfitStatus.pending,
        scheduled_for=None,
    )
    db_session.add(look)
    await db_session.flush()
    response = await client.patch(
        f"/api/v1/outfits/{look.id}", json={"occasion": "wedding"}, headers=auth_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["occasion"] == "wedding"
    bad = await client.patch(
        f"/api/v1/outfits/{look.id}", json={"occasion": "space"}, headers=auth_headers
    )
    assert bad.status_code == 422
