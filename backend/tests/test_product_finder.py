"""Finding the exact product from the tag, and taking the shop's photo and details."""

import json
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
from app.services import product_finder
from app.services.product_finder import (
    Candidate,
    SearchResult,
    page_shows_article,
    parse_search_answer,
    read_product_page,
)
from app.utils.safe_fetch import FetchRefused, _check_url

ITEMS = "/api/v1/items"


@pytest.fixture(autouse=True)
async def _no_spend_yet(db_session: AsyncSession):
    # The ledger has no owner to cascade from, so earlier runs would otherwise add up.
    await db_session.execute(delete(AISpend))
    await db_session.commit()


def _jpeg() -> bytes:
    out = BytesIO()
    Image.new("RGB", (400, 600), (90, 92, 90)).save(out, format="JPEG")
    return out.getvalue()


async def _item(db: AsyncSession, user: User, **fields) -> ClothingItem:
    item = ClothingItem(
        id=uuid4(),
        user_id=user.id,
        image_path="own.jpg",
        thumbnail_path="own_thumb.jpg",
        medium_path="own_medium.jpg",
        type="pants",
        status=ItemStatus.ready,
        tags=fields.pop("tags", {}),
        **fields,
    )
    db.add(item)
    await db.commit()
    return item


class TestReadingAProductPage:
    def test_the_product_data_on_the_page_is_preferred(self):
        product = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Slim-fit trousers",
            "image": ["/img/trousers.jpg"],
            "offers": {"@type": "Offer", "price": "39.95", "priceCurrency": "EUR"},
        }
        html = (
            '<html><head><meta property="og:image" content="https://cdn.example/og.jpg">'
            f'<script type="application/ld+json">{json.dumps(product)}</script></head></html>'
        )
        facts = read_product_page(html, "https://shop.example/p/1")
        assert facts.image_url == "https://shop.example/img/trousers.jpg"
        assert facts.title == "Slim-fit trousers"
        assert facts.price == 39.95
        assert facts.currency == "EUR"

    def test_open_graph_is_used_when_there_is_no_product_data(self):
        html = (
            '<meta property="og:image" content="https://cdn.example/og.jpg">'
            '<meta property="og:title" content="Kurta, blue">'
            '<meta property="product:price:amount" content="1,499">'
            '<meta property="product:price:currency" content="inr">'
        )
        facts = read_product_page(html, "https://shop.example/p/2")
        assert facts.image_url == "https://cdn.example/og.jpg"
        assert facts.title == "Kurta, blue"
        assert facts.currency == "INR"

    def test_the_article_number_must_be_on_the_page(self):
        assert page_shows_article("<p>Ref. 1234 / 567 / 800</p>", "1234/567/800")
        assert not page_shows_article("<p>Ref. 1234/567/801</p>", "1234/567/800")
        assert not page_shows_article("<p>12</p>", "12")  # too short to mean anything

    def test_the_search_answer_gives_suggestions_and_the_pages_google_found(self):
        answer = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": '```json\n[{"url": "https://a.example/p"}]\n```'}]
                    },
                    "groundingMetadata": {
                        "groundingChunks": [{"web": {"uri": "https://b.example/q"}}]
                    },
                }
            ]
        }
        suggestions, sources = parse_search_answer(answer)
        assert suggestions == [{"url": "https://a.example/p"}]
        assert sources == ["https://b.example/q"]


class TestSafeFetch:
    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1/",
            "http://localhost:8000/",
            "http://10.0.0.5/",
            "http://169.254.169.254/latest/meta-data",
            "file:///etc/passwd",
            "https://example.com:8443/",
            "https://user:pw@example.com/",
        ],
    )
    async def test_private_and_odd_addresses_are_refused(self, url):
        with pytest.raises(FetchRefused):
            await _check_url(url)


class TestFindProduct:
    async def test_an_item_without_a_brand_is_not_searched(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        item = await _item(db_session, test_user)
        response = await client.post(f"{ITEMS}/{item.id}/find-product", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "no_brand"

    async def test_matches_are_returned_and_the_search_is_counted(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        item = await _item(
            db_session, test_user, brand="Example", tags={"article_number": "1234/567/800"}
        )
        match = Candidate(
            page_url="https://shop.example/p",
            image_url="https://shop.example/p.jpg",
            title="Slim-fit trousers",
            price=39.95,
            currency="EUR",
            article_match=True,
            thumb="data:image/jpeg;base64,AA==",
        )
        search = AsyncMock(return_value=SearchResult(status="found", candidates=[match]))
        before = sum((await db_session.execute(select(AISpend.cents))).scalars().all())
        with (
            patch("app.api.product_finder.require_internal_ai"),
            patch.object(product_finder, "gemini_available", return_value=True),
            patch.object(product_finder, "search", search),
        ):
            response = await client.post(f"{ITEMS}/{item.id}/find-product", headers=auth_headers)
        body = response.json()
        assert body["status"] == "found"
        assert body["matches"][0]["article_match"] is True
        assert body["spent_cents"] == before + 4
        assert search.await_args.kwargs["article"] == "1234/567/800"
        spend = (await db_session.execute(select(AISpend.cents))).scalars().all()
        assert sum(spend) == before + 4

    async def test_nothing_is_searched_over_the_monthly_limit(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers,
        monkeypatch,
    ):
        monkeypatch.setenv("AI_MONTHLY_LIMIT_EUR", "0")
        item = await _item(db_session, test_user, brand="Example")
        search = AsyncMock()
        with (
            patch("app.api.product_finder.require_internal_ai"),
            patch.object(product_finder, "gemini_available", return_value=True),
            patch.object(product_finder, "search", search),
        ):
            response = await client.post(f"{ITEMS}/{item.id}/find-product", headers=auth_headers)
        assert response.json()["status"] == "over_limit"
        search.assert_not_awaited()


class TestUseProduct:
    async def test_the_shop_photo_becomes_the_main_photo_and_the_own_one_is_kept(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        item = await _item(db_session, test_user, brand="Example", name="Brown")
        with patch.object(product_finder, "fetch_product_image", AsyncMock(return_value=_jpeg())):
            response = await client.post(
                f"{ITEMS}/{item.id}/use-product",
                headers=auth_headers,
                json={
                    "page_url": "https://shop.example/p",
                    "image_url": "https://shop.example/p.jpg",
                    "name": "Slim-fit trousers",
                    "colour": "Grey",
                    "price": "39.95",
                    "currency": "EUR",
                },
            )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["name"] == "Slim-fit trousers"
        assert body["primary_color"] == "gray"
        assert body["tags"]["source_url"] == "https://shop.example/p"
        assert body["tags"]["currency"] == "EUR"
        assert float(body["purchase_price"]) == 39.95

        main = await db_session.scalar(
            select(ClothingItem.image_path).where(ClothingItem.id == item.id)
        )
        assert main != "own.jpg"
        kept = (
            (await db_session.execute(select(ItemImage).where(ItemImage.item_id == item.id)))
            .scalars()
            .all()
        )
        assert [k.image_path for k in kept] == ["own.jpg"]

    async def test_an_unknown_colour_name_is_not_saved(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        item = await _item(db_session, test_user, brand="Example", primary_color="brown")
        with patch.object(product_finder, "fetch_product_image", AsyncMock(return_value=_jpeg())):
            response = await client.post(
                f"{ITEMS}/{item.id}/use-product",
                headers=auth_headers,
                json={
                    "page_url": "https://s.example/p",
                    "image_url": "https://s.example/p.jpg",
                    "colour": "Moonlight",
                },
            )
        assert response.json()["primary_color"] == "brown"

    async def test_a_picture_that_cannot_be_loaded_changes_nothing(
        self, client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers
    ):
        item = await _item(db_session, test_user, brand="Example")
        with patch.object(
            product_finder, "fetch_product_image", AsyncMock(side_effect=FetchRefused("nope"))
        ):
            response = await client.post(
                f"{ITEMS}/{item.id}/use-product",
                headers=auth_headers,
                json={"page_url": "https://s.example/p", "image_url": "https://s.example/p.jpg"},
            )
        assert response.status_code == 502
        main = await db_session.scalar(
            select(ClothingItem.image_path).where(ClothingItem.id == item.id)
        )
        assert main == "own.jpg"
