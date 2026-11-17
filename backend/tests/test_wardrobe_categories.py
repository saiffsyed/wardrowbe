"""The wardrobe's grouped categories: the built-in tree, a person's own, and filtering by one."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import create_access_token
from app.models.item import ClothingItem, ItemStatus
from app.models.user import User
from app.utils.garment_vocabulary import TYPES
from app.utils.wardrobe_categories import (
    DEFAULT_GROUPS,
    CategoryTree,
    default_tree,
    types_in,
    unplaced_types,
)
from tests.identity_helpers import add_users_with_identities

CATEGORIES = "/api/v1/wardrobe/categories"
ITEMS = "/api/v1/items"


async def _item(db: AsyncSession, user: User, type: str, **fields) -> ClothingItem:
    item = ClothingItem(
        id=uuid4(),
        user_id=user.id,
        image_path="x.jpg",
        type=type,
        status=ItemStatus.ready,
        tags={},
        **fields,
    )
    db.add(item)
    await db.commit()
    return item


def _own_tree() -> dict:
    return {
        "groups": [
            {
                "id": "indian",
                "key": "indian",
                "children": [
                    {"id": "sarees", "key": "sarees", "types": ["saree", "saree-blouse"]},
                    {"id": "pattu", "name": "  Pattu   sarees ", "types": []},
                ],
            },
            {
                "id": "mine",
                "name": "Office",
                "children": [{"id": "office-shirts", "name": "Shirts", "types": ["shirt"]}],
            },
        ]
    }


class TestBuiltInTree:
    def test_every_garment_type_has_exactly_one_place(self):
        placed = [t for g in DEFAULT_GROUPS for c in g.children for t in c.types]

        assert sorted(placed) == sorted(TYPES)
        assert unplaced_types(default_tree()) == []

    def test_a_group_holds_everything_under_it_and_a_subgroup_only_its_own(self):
        tree = default_tree()

        assert set(types_in(tree, "sarees")) == {"saree", "saree-blouse", "petticoat"}
        assert {"saree", "kurta", "lehenga", "dupatta", "dhoti"} <= set(types_in(tree, "indian"))
        assert "shirt" not in types_in(tree, "indian")
        assert types_in(tree, "no-such-category") == ()


class TestTreeRules:
    def test_a_type_cannot_be_in_two_places(self):
        tree = _own_tree()
        tree["groups"][1]["children"][0]["types"] = ["saree"]

        with pytest.raises(ValidationError, match="more than one category"):
            CategoryTree(**tree)

    def test_an_unknown_type_is_refused(self):
        tree = _own_tree()
        tree["groups"][0]["children"][0]["types"] = ["spacesuit"]

        with pytest.raises(ValidationError, match="not an item type"):
            CategoryTree(**tree)

    def test_ids_are_unique_and_every_category_is_named(self):
        tree = _own_tree()
        tree["groups"][1]["id"] = "sarees"
        with pytest.raises(ValidationError, match="share an id"):
            CategoryTree(**tree)

        tree = _own_tree()
        tree["groups"][1]["name"] = "   "
        with pytest.raises(ValidationError, match="needs a name"):
            CategoryTree(**tree)


class TestCategoriesEndpoint:
    @pytest.mark.asyncio
    async def test_built_in_tree_with_counts_of_the_persons_own_items(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        await _item(db_session, test_user, "saree")
        await _item(db_session, test_user, "saree-blouse")
        await _item(db_session, test_user, "kurta")
        await _item(db_session, test_user, "shirt", is_archived=True)

        body = (await client.get(CATEGORIES, headers=auth_headers)).json()

        assert body["customised"] is False
        assert body["unplaced_types"] == []
        counts = {g["id"]: g["item_count"] for g in body["groups"]}
        assert counts == {"indian": 3, "western": 0, "shoes": 0, "jewellery": 0, "accessories": 0}
        indian = body["groups"][0]
        assert {c["id"]: c["item_count"] for c in indian["children"]} == {
            "sarees": 2,
            "kurtas-suits": 1,
            "lehengas": 0,
            "dupattas": 0,
            "indian-bottoms": 0,
        }
        assert indian["children"][0]["key"] == "sarees"

    @pytest.mark.asyncio
    async def test_a_person_can_save_their_own_tree_and_go_back(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        await _item(db_session, test_user, "shirt")

        saved = await client.put(CATEGORIES, json=_own_tree(), headers=auth_headers)

        assert saved.status_code == 200, saved.text
        body = (await client.get(CATEGORIES, headers=auth_headers)).json()
        assert body["customised"] is True
        assert [g["id"] for g in body["groups"]] == ["indian", "mine"]
        assert body["groups"][0]["children"][1]["name"] == "Pattu sarees"
        assert body["groups"][1]["item_count"] == 1
        # Types the person left out of every category are reported, not lost.
        assert "kurta" in body["unplaced_types"]
        assert "shirt" not in body["unplaced_types"]

        reset = await client.delete(CATEGORIES, headers=auth_headers)

        assert reset.status_code == 204
        body = (await client.get(CATEGORIES, headers=auth_headers)).json()
        assert body["customised"] is False
        assert len(body["groups"]) == len(DEFAULT_GROUPS)

    @pytest.mark.asyncio
    async def test_a_tree_that_breaks_the_rules_is_refused_and_nothing_changes(
        self, client: AsyncClient, auth_headers: dict
    ):
        tree = _own_tree()
        tree["groups"][1]["children"][0]["types"] = ["saree"]

        response = await client.put(CATEGORIES, json=tree, headers=auth_headers)

        assert response.status_code == 422
        assert (await client.get(CATEGORIES, headers=auth_headers)).json()["customised"] is False

    @pytest.mark.asyncio
    async def test_one_persons_tree_is_not_anothers(
        self, client: AsyncClient, db_session: AsyncSession, auth_headers: dict
    ):
        await client.put(CATEGORIES, json=_own_tree(), headers=auth_headers)
        other = User(
            external_id=f"other-{uuid4()}", email=f"other-{uuid4()}@example.com", display_name="O"
        )
        (identity,) = await add_users_with_identities(db_session, other)
        await db_session.commit()
        headers = {"Authorization": f"Bearer {create_access_token(other.id, identity.id)}"}

        body = (await client.get(CATEGORIES, headers=headers)).json()

        assert body["customised"] is False


class TestFilterByCategory:
    @pytest.mark.asyncio
    async def test_items_filter_by_group_and_by_subgroup(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        await _item(db_session, test_user, "shirt")
        saree = await _item(db_session, test_user, "saree")
        kurta = await _item(db_session, test_user, "kurta")

        indian = await client.get(f"{ITEMS}?category=indian", headers=auth_headers)
        sarees = await client.get(f"{ITEMS}?category=sarees", headers=auth_headers)
        unknown = await client.get(f"{ITEMS}?category=hats-only", headers=auth_headers)

        assert {i["id"] for i in indian.json()["items"]} == {str(saree.id), str(kurta.id)}
        assert [i["id"] for i in sarees.json()["items"]] == [str(saree.id)]
        assert unknown.json()["items"] == []

    @pytest.mark.asyncio
    async def test_the_filter_follows_the_persons_own_tree(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict
    ):
        shirt = await _item(db_session, test_user, "shirt")
        await _item(db_session, test_user, "kurta")
        await client.put(CATEGORIES, json=_own_tree(), headers=auth_headers)

        office = await client.get(f"{ITEMS}?category=mine", headers=auth_headers)
        western = await client.get(f"{ITEMS}?category=western", headers=auth_headers)

        assert [i["id"] for i in office.json()["items"]] == [str(shirt.id)]
        # "western" is not one of this person's categories any more.
        assert western.json()["items"] == []
