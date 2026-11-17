"""Homes, the home an item is kept in, and the item details read from labels."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import create_access_token
from app.models.home import Home
from app.models.item import ClothingItem, ItemStatus
from app.models.user import User
from app.schemas.item import ItemCreate, ItemTags
from app.services.item_service import ItemService
from app.utils.garment_vocabulary import ITEM_ROLE
from tests.identity_helpers import add_users_with_identities

HOMES = "/api/v1/homes"
ITEMS = "/api/v1/items"


async def _item(db: AsyncSession, user: User, **fields) -> ClothingItem:
    item = ClothingItem(
        id=uuid4(),
        user_id=user.id,
        image_path="x.jpg",
        type=fields.pop("type", "shirt"),
        status=ItemStatus.ready,
        tags=fields.pop("tags", {}),
        **fields,
    )
    db.add(item)
    await db.commit()
    return item


async def _home(client: AsyncClient, headers: dict, name: str, city: str) -> dict:
    response = await client.post(HOMES, json={"name": name, "city": city}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _other_user_headers(db: AsyncSession) -> tuple[User, dict[str, str]]:
    other = User(
        external_id=f"other-{uuid4()}", email=f"other-{uuid4()}@example.com", display_name="Other"
    )
    (identity,) = await add_users_with_identities(db, other)
    await db.commit()
    return other, {"Authorization": f"Bearer {create_access_token(other.id, identity.id)}"}


class TestHomes:
    @pytest.mark.asyncio
    async def test_first_home_becomes_current_and_adopts_existing_items(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        item = await _item(db_session, test_user)

        home = await _home(client, auth_headers, "Chennai home", "Chennai")

        assert home["is_current"] is True
        assert home["item_count"] == 1
        await db_session.refresh(item)
        await db_session.refresh(test_user)
        assert str(item.home_id) == home["id"]
        assert test_user.location_name == "Chennai"

    @pytest.mark.asyncio
    async def test_second_home_does_not_take_over(self, client: AsyncClient, auth_headers: dict):
        first = await _home(client, auth_headers, "Chennai home", "Chennai")
        second = await _home(client, auth_headers, "Kadiri home", "Kadiri")

        assert second["is_current"] is False
        listed = (await client.get(HOMES, headers=auth_headers)).json()
        assert [h["name"] for h in listed] == ["Chennai home", "Kadiri home"]
        assert [h["is_current"] for h in listed] == [True, False]
        assert listed[0]["id"] == first["id"]

    @pytest.mark.asyncio
    async def test_duplicate_name_is_refused(self, client: AsyncClient, auth_headers: dict):
        await _home(client, auth_headers, "Chennai home", "Chennai")
        kadiri = await _home(client, auth_headers, "Kadiri home", "Kadiri")

        created = await client.post(
            HOMES, json={"name": "Chennai home", "city": "Chennai"}, headers=auth_headers
        )
        renamed = await client.patch(
            f"{HOMES}/{kadiri['id']}", json={"name": "Chennai home"}, headers=auth_headers
        )

        assert created.status_code == 409
        assert renamed.status_code == 409
        assert len((await client.get(HOMES, headers=auth_headers)).json()) == 2

    @pytest.mark.asyncio
    async def test_blank_name_is_refused(self, client: AsyncClient, auth_headers: dict):
        response = await client.post(
            HOMES, json={"name": "   ", "city": "Chennai"}, headers=auth_headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_switching_home_moves_the_weather_location(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        await _home(client, auth_headers, "Chennai home", "Chennai")
        kadiri = await _home(client, auth_headers, "Kadiri home", "Kadiri")

        response = await client.post(f"{HOMES}/{kadiri['id']}/current", headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["is_current"] is True
        await db_session.refresh(test_user)
        assert str(test_user.current_home_id) == kadiri["id"]
        assert test_user.location_name == "Kadiri"
        assert test_user.location_lat is None

    @pytest.mark.asyncio
    async def test_renaming_the_city_of_the_current_home_updates_weather_and_drops_coordinates(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        created = await client.post(
            HOMES,
            json={"name": "Europe home", "city": "Milan", "lat": 45.46, "lon": 9.19},
            headers=auth_headers,
        )
        home_id = created.json()["id"]

        response = await client.patch(
            f"{HOMES}/{home_id}", json={"city": "Frankfurt"}, headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["city"] == "Frankfurt"
        assert response.json()["lat"] is None
        await db_session.refresh(test_user)
        assert test_user.location_name == "Frankfurt"
        assert test_user.location_lat is None

    @pytest.mark.asyncio
    async def test_deleting_a_home_keeps_its_items(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        item = await _item(db_session, test_user)
        home = await _home(client, auth_headers, "Chennai home", "Chennai")

        response = await client.delete(f"{HOMES}/{home['id']}", headers=auth_headers)

        assert response.status_code == 204
        await db_session.refresh(item)
        await db_session.refresh(test_user)
        assert item.home_id is None
        assert test_user.current_home_id is None
        assert (await client.get(HOMES, headers=auth_headers)).json() == []

    @pytest.mark.asyncio
    async def test_another_users_home_is_not_found(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        home = await _home(client, auth_headers, "Chennai home", "Chennai")
        _, other_headers = await _other_user_headers(db_session)

        for method, path in (
            ("patch", f"{HOMES}/{home['id']}"),
            ("delete", f"{HOMES}/{home['id']}"),
            ("post", f"{HOMES}/{home['id']}/current"),
        ):
            response = await client.request(method, path, json={}, headers=other_headers)
            assert response.status_code == 404, (method, path)
        assert (await client.get(HOMES, headers=other_headers)).json() == []


class TestItemsAndHomes:
    @pytest.mark.asyncio
    async def test_new_items_go_to_the_current_home(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        home = await _home(client, auth_headers, "Chennai home", "Chennai")
        await db_session.refresh(test_user)

        item = await ItemService(db_session).create(
            test_user.id, ItemCreate(type="shirt"), {"image_path": "new.jpg"}
        )

        assert str(item.home_id) == home["id"]

    @pytest.mark.asyncio
    async def test_move_items_only_moves_your_own(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        mine = await _item(db_session, test_user)
        other, _ = await _other_user_headers(db_session)
        theirs = await _item(db_session, other)
        await _home(client, auth_headers, "Chennai home", "Chennai")
        kadiri = await _home(client, auth_headers, "Kadiri home", "Kadiri")

        response = await client.post(
            f"{HOMES}/{kadiri['id']}/items",
            json={"item_ids": [str(mine.id), str(theirs.id)]},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json() == {"moved": 1}
        await db_session.refresh(mine)
        await db_session.refresh(theirs)
        assert str(mine.home_id) == kadiri["id"]
        assert theirs.home_id is None

    @pytest.mark.asyncio
    async def test_item_list_filters_by_home(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        here = await _item(db_session, test_user, name="Here")
        chennai = await _home(client, auth_headers, "Chennai home", "Chennai")
        kadiri = await _home(client, auth_headers, "Kadiri home", "Kadiri")
        away = await _item(db_session, test_user, name="Away")
        await client.post(
            f"{HOMES}/{kadiri['id']}/items", json={"item_ids": [str(away.id)]}, headers=auth_headers
        )

        in_chennai = await client.get(
            ITEMS, params={"home_id": chennai["id"]}, headers=auth_headers
        )
        everywhere = await client.get(ITEMS, headers=auth_headers)

        assert [i["id"] for i in in_chennai.json()["items"]] == [str(here.id)]
        assert in_chennai.json()["items"][0]["home_id"] == chennai["id"]
        assert everywhere.json()["total"] == 2

    @pytest.mark.asyncio
    async def test_item_can_be_moved_by_editing_it_but_not_to_someone_elses_home(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        item = await _item(db_session, test_user)
        await _home(client, auth_headers, "Chennai home", "Chennai")
        kadiri = await _home(client, auth_headers, "Kadiri home", "Kadiri")
        other, _ = await _other_user_headers(db_session)
        foreign = Home(user_id=other.id, name="Theirs", city="Rome")
        db_session.add(foreign)
        await db_session.commit()

        moved = await client.patch(
            f"{ITEMS}/{item.id}", json={"home_id": kadiri["id"]}, headers=auth_headers
        )
        refused = await client.patch(
            f"{ITEMS}/{item.id}", json={"home_id": str(foreign.id)}, headers=auth_headers
        )

        assert moved.status_code == 200
        assert moved.json()["home_id"] == kadiri["id"]
        assert refused.status_code == 404


class TestItemDetails:
    @pytest.mark.asyncio
    async def test_label_details_are_saved_and_survive_a_partial_edit(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        item = await _item(db_session, test_user, tags={"pattern": "solid"})

        saved = await client.patch(
            f"{ITEMS}/{item.id}",
            json={
                "brand": "Tailor-made",
                "tags": {
                    "size": "40",
                    "size_system": "IN",
                    "fit_note": "Slim at the shoulders",
                    "purchase_place": "Chennai, India",
                    "care_instructions": "Dry clean only",
                    "composition": [
                        {"material": " Silk ", "percent": 70},
                        {"material": "cotton", "percent": 30},
                    ],
                    "occasions": ["Wedding", "festive", "wedding"],
                },
            },
            headers=auth_headers,
        )
        assert saved.status_code == 200, saved.text
        later = await client.patch(
            f"{ITEMS}/{item.id}", json={"tags": {"fit_note": "Fits well"}}, headers=auth_headers
        )

        tags = later.json()["tags"]
        assert tags["composition"] == [
            {"material": "silk", "percent": 70},
            {"material": "cotton", "percent": 30},
        ]
        assert tags["occasions"] == ["wedding", "festive"]
        assert tags["purchase_place"] == "Chennai, India"
        assert tags["size"] == "40"
        assert tags["fit_note"] == "Fits well"
        assert tags["pattern"] == "solid"
        # Details the person owns never count as edits to what the AI tagged.
        assert not tags.get("user_edited_keys")

    def test_composition_over_100_percent_is_refused(self):
        with pytest.raises(ValidationError):
            ItemTags(
                composition=[
                    {"material": "silk", "percent": 70},
                    {"material": "cotton", "percent": 40},
                ]
            )

    def test_too_many_occasions_are_refused(self):
        with pytest.raises(ValidationError):
            ItemTags(occasions=[f"tag {n}" for n in range(21)])

    @pytest.mark.asyncio
    async def test_filters_by_occasion_brand_material_and_season(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        sherwani = await _item(
            db_session,
            test_user,
            type="sherwani",
            brand="Tailor-made",
            season=["winter"],
            tags={
                "occasions": ["wedding", "festive"],
                "composition": [{"material": "silk", "percent": 70}],
            },
        )
        shirt = await _item(
            db_session,
            test_user,
            brand="Other",
            material="cotton",
            season=["summer"],
            tags={"occasions": ["work"]},
        )

        async def ids(**params) -> list[str]:
            response = await client.get(ITEMS, params=params, headers=auth_headers)
            assert response.status_code == 200, response.text
            return [i["id"] for i in response.json()["items"]]

        assert await ids(occasion="Wedding") == [str(sherwani.id)]
        assert await ids(occasion="work") == [str(shirt.id)]
        assert await ids(brand="tailor-made") == [str(sherwani.id)]
        assert await ids(material="silk") == [str(sherwani.id)]
        assert await ids(material="cotton") == [str(shirt.id)]
        assert await ids(season="summer") == [str(shirt.id)]
        assert await ids(occasion="gym") == []


class TestNewGarmentTypes:
    def test_jewellery_and_traditional_wear_have_roles(self):
        for jewellery in ("ring", "necklace", "earrings", "bracelet", "bangles", "cufflinks"):
            assert ITEM_ROLE[jewellery] == "accessory"
        assert ITEM_ROLE["kurta"] == "base_top"
        assert ITEM_ROLE["sherwani"] == "outer_layer"
        assert ITEM_ROLE["saree"] == "full_body"
        assert ITEM_ROLE["lehenga"] == "full_body"
        assert ITEM_ROLE["salwar-kameez"] == "full_body"
        assert ITEM_ROLE["dhoti"] == "bottom"
        assert ITEM_ROLE["mojari"] == "footwear"


class TestWardrobeFacets:
    @pytest.mark.asyncio
    async def test_facets_count_what_is_in_the_wardrobe(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        await _item(
            db_session,
            test_user,
            brand="Zara",
            material="cotton",
            tags={"occasions": ["work", "casual"]},
        )
        await _item(
            db_session,
            test_user,
            brand="ZARA ",
            tags={
                "occasions": ["work"],
                "composition": [
                    {"material": "cotton", "percent": 97},
                    {"material": "elastane", "percent": 3},
                ],
            },
        )
        await _item(db_session, test_user, brand="Tailor-made", is_archived=True)
        other, _ = await _other_user_headers(db_session)
        await _item(db_session, other, brand="Theirs", tags={"occasions": ["gym"]})

        response = await client.get("/api/v1/wardrobe/facets", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == {
            "brands": [{"value": "Zara", "count": 2}],
            "occasions": [{"value": "work", "count": 2}, {"value": "casual", "count": 1}],
            "materials": [{"value": "cotton", "count": 2}, {"value": "elastane", "count": 1}],
        }

    @pytest.mark.asyncio
    async def test_facets_can_be_limited_to_one_home(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        await _item(db_session, test_user, brand="Here")
        chennai = await _home(client, auth_headers, "Chennai home", "Chennai")
        kadiri = await _home(client, auth_headers, "Kadiri home", "Kadiri")
        away = await _item(db_session, test_user, brand="Away")
        await client.post(
            f"{HOMES}/{kadiri['id']}/items", json={"item_ids": [str(away.id)]}, headers=auth_headers
        )

        response = await client.get(
            "/api/v1/wardrobe/facets", params={"home_id": chennai["id"]}, headers=auth_headers
        )

        assert [b["value"] for b in response.json()["brands"]] == ["Here"]


class TestPurchaseCurrency:
    @pytest.mark.asyncio
    async def test_a_price_keeps_the_currency_it_was_paid_in(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        item = await _item(db_session, test_user)

        saved = await client.patch(
            f"{ITEMS}/{item.id}",
            json={
                "purchase_price": 4500,
                "purchase_date": "2025-10-02",
                "tags": {"currency": "INR"},
            },
            headers=auth_headers,
        )
        bad = await client.patch(
            f"{ITEMS}/{item.id}", json={"tags": {"currency": "rupees"}}, headers=auth_headers
        )

        assert saved.status_code == 200, saved.text
        assert saved.json()["tags"]["currency"] == "INR"
        assert float(saved.json()["purchase_price"]) == 4500
        assert bad.status_code == 422


class TestBulkMoveToHome:
    @pytest.mark.asyncio
    async def test_moves_the_chosen_items(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        chennai = await _home(client, auth_headers, "Chennai", "Chennai")
        europe = await _home(client, auth_headers, "Europe", "Amsterdam")
        a = await _item(db_session, test_user)
        b = await _item(db_session, test_user)
        c = await _item(db_session, test_user)

        response = await client.post(
            f"{HOMES}/{europe['id']}/items/bulk",
            json={"item_ids": [str(a.id), str(b.id)]},
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        assert response.json()["moved"] == 2
        for item, home in ((a, europe), (b, europe), (c, None)):
            await db_session.refresh(item)
            assert (str(item.home_id) if item.home_id else None) == (home and home["id"])
        assert chennai  # still exists, untouched

    @pytest.mark.asyncio
    async def test_moves_everything_matching_except_the_unticked(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        europe = await _home(client, auth_headers, "Europe", "Amsterdam")
        shirt = await _item(db_session, test_user, type="shirt")
        kept = await _item(db_session, test_user, type="shirt")
        saree = await _item(db_session, test_user, type="saree")

        response = await client.post(
            f"{HOMES}/{europe['id']}/items/bulk",
            json={
                "select_all": True,
                "filters": {"type": "shirt"},
                "excluded_ids": [str(kept.id)],
            },
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        assert response.json() == {"moved": 1, "next_cursor": None, "has_more": False, "errors": []}
        await db_session.refresh(shirt)
        await db_session.refresh(kept)
        await db_session.refresh(saree)
        assert str(shirt.home_id) == europe["id"]
        assert kept.home_id is None
        assert saree.home_id is None

    @pytest.mark.asyncio
    async def test_someone_elses_items_and_homes_are_out_of_reach(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        mine = await _home(client, auth_headers, "Chennai", "Chennai")
        other, other_headers = await _other_user_headers(db_session)
        theirs = await _item(db_session, other)

        into_mine = await client.post(
            f"{HOMES}/{mine['id']}/items/bulk",
            json={"item_ids": [str(theirs.id)]},
            headers=auth_headers,
        )
        into_theirs = await client.post(
            f"{HOMES}/{mine['id']}/items/bulk",
            json={"item_ids": [str(theirs.id)]},
            headers=other_headers,
        )

        assert into_mine.json()["moved"] == 0
        assert into_theirs.status_code == 404
        await db_session.refresh(theirs)
        assert theirs.home_id is None
