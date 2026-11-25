"""Your partner's planned looks beside yours (our fork)."""

from datetime import date
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.family import Family
from app.models.item import ClothingItem, ItemStatus
from app.models.outfit import Outfit, OutfitItem, OutfitSource, OutfitStatus
from app.models.user import User

URL = "/api/v1/couple"


async def _member(db: AsyncSession, family: Family | None, name: str) -> User:
    user = User(
        id=uuid4(),
        external_id=f"m-{uuid4()}",
        email=f"{uuid4()}@example.com",
        display_name=name,
        timezone="UTC",
        is_active=True,
        family_id=family.id if family else None,
    )
    db.add(user)
    await db.flush()
    return user


async def _family(db: AsyncSession, owner: User) -> Family:
    family = Family(name="Home", created_by=owner.id, invite_code=str(uuid4())[:10])
    db.add(family)
    await db.flush()
    owner.family_id = family.id
    await db.flush()
    return family


async def _planned(db: AsyncSession, user: User, day: date) -> Outfit:
    item = ClothingItem(user_id=user.id, type="saree", image_path="x.jpg", status=ItemStatus.ready)
    db.add(item)
    await db.flush()
    outfit = Outfit(
        user_id=user.id,
        occasion="wedding",
        source=OutfitSource.manual,
        status=OutfitStatus.pending,
        scheduled_for=day,
    )
    db.add(outfit)
    await db.flush()
    db.add(OutfitItem(outfit_id=outfit.id, item_id=item.id, position=0))
    await db.flush()
    return outfit


class TestCouple:
    @pytest.mark.asyncio
    async def test_no_partner_without_a_family(self, client: AsyncClient, auth_headers):
        body = (await client.get(URL, headers=auth_headers)).json()
        assert body["partner"] is None and body["share_plans"] is True
        plans = await client.get(
            f"{URL}/plans",
            params={"date_from": "2026-11-28", "date_to": "2026-11-28"},
            headers=auth_headers,
        )
        assert plans.json() == []

    @pytest.mark.asyncio
    async def test_the_other_member_of_two_is_the_partner_and_their_plans_show(
        self, client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
    ):
        family = await _family(db_session, test_user)
        partner = await _member(db_session, family, "Partner")
        look = await _planned(db_session, partner, date(2026, 11, 28))
        await db_session.commit()

        body = (await client.get(URL, headers=auth_headers)).json()
        assert body["partner"]["display_name"] == "Partner"
        assert body["partner_shares"] is True
        plans = (
            await client.get(
                f"{URL}/plans",
                params={"date_from": "2026-11-22", "date_to": "2026-11-28"},
                headers=auth_headers,
            )
        ).json()
        assert [p["id"] for p in plans] == [str(look.id)]
        assert list(plans[0]["item_patterns"].values()) == ["solid"]

    @pytest.mark.asyncio
    async def test_a_partner_who_stops_sharing_shows_nothing(
        self, client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
    ):
        from app.models.couple import CoupleSettings

        family = await _family(db_session, test_user)
        partner = await _member(db_session, family, "Partner")
        await _planned(db_session, partner, date(2026, 11, 28))
        db_session.add(CoupleSettings(user_id=partner.id, share_plans=False))
        await db_session.commit()

        assert (await client.get(URL, headers=auth_headers)).json()["partner_shares"] is False
        plans = await client.get(
            f"{URL}/plans",
            params={"date_from": "2026-11-28", "date_to": "2026-11-28"},
            headers=auth_headers,
        )
        assert plans.json() == []

    @pytest.mark.asyncio
    async def test_with_more_members_you_choose_the_partner(
        self, client: AsyncClient, auth_headers, db_session: AsyncSession, test_user: User
    ):
        family = await _family(db_session, test_user)
        first = await _member(db_session, family, "First")
        await _member(db_session, family, "Second")
        stranger = await _member(db_session, None, "Stranger")
        await db_session.commit()

        body = (await client.get(URL, headers=auth_headers)).json()
        assert body["partner"] is None and len(body["choices"]) == 2
        chosen = await client.patch(URL, json={"partner_id": str(first.id)}, headers=auth_headers)
        assert chosen.json()["partner"]["display_name"] == "First"
        refused = await client.patch(
            URL, json={"partner_id": str(stranger.id)}, headers=auth_headers
        )
        assert refused.status_code == 422

    @pytest.mark.asyncio
    async def test_turning_off_sharing(self, client: AsyncClient, auth_headers):
        off = await client.patch(URL, json={"share_plans": False}, headers=auth_headers)
        assert off.json()["share_plans"] is False
