"""Finds the exact product a garment was sold as, from what its tag says (our fork).

Gemini searches Google with the brand, article number, colour and kind, and names up to three
product pages. Each page is then fetched here and read for its picture, title and price, so
nothing the model says about a page is shown unless the page itself confirms it. A tick for
"same article number" is only given when the number is printed on the page.
"""

import base64
import io
import json
import logging
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx
from PIL import Image

from app.config import get_settings
from app.utils.safe_fetch import FetchRefused, fetch

logger = logging.getLogger(__name__)

GEMINI_HOST = "generativelanguage.googleapis.com"
GEMINI_NATIVE = "https://generativelanguage.googleapis.com/v1beta"
MAX_PAGE_BYTES = 3 * 1024 * 1024
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_MATCHES = 3
THUMB_PX = 360

SEARCH_PROMPT = """Find the online shop page of this exact piece of clothing.

Brand: {brand}
Article / style number: {article}
Kind: {kind}
Colour: {colour}
Size: {size}

Search the web. Prefer the brand's own shop, then large shops selling the same article. The \
article number is the strongest clue: a page showing the same number is the same product.

Answer with ONLY a JSON array of at most 3 objects, best match first, no other text:
[{{"url": "the product page address", "title": "product name", "price": number or null, \
"currency": "ISO code such as EUR or INR" or null, "colour": "colour name" or null}}]
Give only pages you found in the search, never an address you made up. If nothing fits, \
answer []."""


@dataclass
class Candidate:
    page_url: str
    image_url: str
    title: str | None = None
    price: float | None = None
    currency: str | None = None
    colour: str | None = None
    article_match: bool = False
    thumb: str | None = None  # a small JPEG as a data URL, so the phone loads nothing foreign


@dataclass
class SearchResult:
    status: str  # found | nothing | unavailable | unreachable
    candidates: list[Candidate] = field(default_factory=list)


def gemini_available() -> bool:
    settings = get_settings()
    return bool(settings.ai_api_key) and GEMINI_HOST in (settings.ai_base_url or "")


def _model() -> str:
    return (get_settings().ai_text_model or "").split(",")[0].strip()


# --- reading a product page -------------------------------------------------------------


class _PageReader(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self.title = ""
        self._in_ld = False
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            if key and a.get("content") and key not in self.meta:
                self.meta[key] = a["content"].strip()
        elif tag == "link" and a.get("rel", "").lower() == "image_src" and a.get("href"):
            self.meta.setdefault("image_src", a["href"])
        elif tag == "script" and "ld+json" in a.get("type", "").lower():
            self._in_ld = True
            self.json_ld.append("")
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self._in_ld = False
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_ld:
            self.json_ld[-1] += data
        elif self._in_title:
            self.title += data


def _products_in(node: object) -> list[dict]:
    found: list[dict] = []
    if isinstance(node, list):
        for entry in node:
            found += _products_in(entry)
    elif isinstance(node, dict):
        kind = node.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if "Product" in kinds or "ProductGroup" in kinds:
            found.append(node)
        for key in ("@graph", "hasVariant"):
            if key in node:
                found += _products_in(node[key])
    return found


def _first(value: object) -> object:
    return value[0] if isinstance(value, list) and value else value


def _number(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"\d+(?:[.,]\d{1,2})?", value.replace(" ", ""))
        if match:
            return float(match.group().replace(",", "."))
    return None


@dataclass
class PageFacts:
    image_url: str | None
    title: str | None
    price: float | None
    currency: str | None


def read_product_page(html: str, base_url: str) -> PageFacts:
    reader = _PageReader()
    try:
        reader.feed(html)
    except Exception:  # a broken page still gives what was read before the break
        pass
    image = title = currency = None
    price = None
    for raw in reader.json_ld:
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue
        for product in _products_in(data):
            image = image or _first(product.get("image"))
            if isinstance(image, dict):
                image = image.get("url") or image.get("contentUrl")
            title = title or product.get("name")
            offer = _first(product.get("offers"))
            if isinstance(offer, dict):
                price = (
                    price
                    if price is not None
                    else _number(offer.get("price") or offer.get("lowPrice"))
                )
                currency = currency or offer.get("priceCurrency")
    meta = reader.meta
    image = (
        image
        or meta.get("og:image")
        or meta.get("og:image:url")
        or meta.get("twitter:image")
        or meta.get("image_src")
    )
    title = title or meta.get("og:title") or (reader.title.strip() or None)
    if price is None:
        price = _number(meta.get("product:price:amount") or meta.get("og:price:amount"))
    currency = currency or meta.get("product:price:currency") or meta.get("og:price:currency")
    return PageFacts(
        image_url=urljoin(base_url, image) if isinstance(image, str) and image else None,
        title=" ".join(str(title).split())[:120] if title else None,
        price=price,
        currency=currency.upper()[:3] if isinstance(currency, str) and len(currency) >= 3 else None,
    )


def _compact(text: str) -> str:
    return re.sub(r"[^0-9a-z]", "", text.lower())


def page_shows_article(html: str, article: str | None) -> bool:
    """True when the article number is printed on the page, ignoring spaces, dots and slashes."""
    wanted = _compact(article or "")
    return len(wanted) >= 5 and wanted in _compact(html)


def thumbnail_data_url(image_bytes: bytes) -> str | None:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            image.thumbnail((THUMB_PX, THUMB_PX))
            out = io.BytesIO()
            image.save(out, "JPEG", quality=80)
    except Exception:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii")


async def fetch_product_image(image_url: str) -> bytes:
    body, content_type, _ = await fetch(image_url, max_bytes=MAX_IMAGE_BYTES, accept="image/*")
    if not content_type.startswith("image/") and not body[:12].startswith(
        (b"\xff\xd8", b"\x89PNG", b"RIFF")
    ):
        raise FetchRefused("not a picture")
    return body


async def _candidate(url: str, suggestion: dict, article: str | None) -> Candidate | None:
    try:
        body, content_type, final_url = await fetch(
            url, max_bytes=MAX_PAGE_BYTES, accept="text/html,application/xhtml+xml"
        )
    except FetchRefused as e:
        logger.info("Product page skipped (%s): %s", e, url)
        return None
    if "html" not in content_type:
        return None
    html = body.decode("utf-8", errors="replace")
    facts = read_product_page(html, final_url)
    if not facts.image_url:
        return None
    try:
        thumb = thumbnail_data_url(await fetch_product_image(facts.image_url))
    except FetchRefused:
        return None
    if thumb is None:
        return None
    return Candidate(
        page_url=final_url,
        image_url=facts.image_url,
        title=facts.title or suggestion.get("title"),
        price=facts.price if facts.price is not None else _number(suggestion.get("price")),
        currency=facts.currency or (suggestion.get("currency") or None),
        colour=suggestion.get("colour") if isinstance(suggestion.get("colour"), str) else None,
        article_match=page_shows_article(html, article),
        thumb=thumb,
    )


# --- asking Gemini ----------------------------------------------------------------------


def _json_list(text: str) -> list[dict]:
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end <= start:
        return []
    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []


def parse_search_answer(answer: dict) -> tuple[list[dict], list[str]]:
    """(the model's suggestions, the pages Google actually returned)."""
    candidate = _first(answer.get("candidates") or []) or {}
    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    chunks = (candidate.get("groundingMetadata") or {}).get("groundingChunks") or []
    sources = [
        c["web"]["uri"]
        for c in chunks
        if isinstance(c, dict) and isinstance(c.get("web"), dict) and c["web"].get("uri")
    ]
    return _json_list(text), sources


async def _ask_gemini(prompt: str) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        response = await client.post(
            f"{GEMINI_NATIVE}/models/{_model()}:generateContent",
            headers={"x-goog-api-key": settings.ai_api_key or ""},
            json={
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "tools": [{"google_search": {}}],
            },
        )
        response.raise_for_status()
        return response.json()


async def search(
    *, brand: str, article: str | None, kind: str | None, colour: str | None, size: str | None
) -> SearchResult:
    if not gemini_available():
        return SearchResult(status="unavailable")
    prompt = SEARCH_PROMPT.format(
        brand=brand,
        article=article or "not on the tag",
        kind=kind or "unknown",
        colour=colour or "unknown",
        size=size or "unknown",
    )
    try:
        answer = await _ask_gemini(prompt)
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("Product search failed: %s", e)
        return SearchResult(status="unreachable")
    suggestions, sources = parse_search_answer(answer)
    # The model's own picks first, then the pages Google returned, each tried once.
    tried: set[str] = set()
    candidates: list[Candidate] = []
    for url, suggestion in [(s.get("url"), s) for s in suggestions] + [(u, {}) for u in sources]:
        if len(candidates) >= MAX_MATCHES:
            break
        if not isinstance(url, str) or url in tried:
            continue
        tried.add(url)
        found = await _candidate(url, suggestion, article)
        if found and all(found.page_url != c.page_url for c in candidates):
            candidates.append(found)
    candidates.sort(key=lambda c: not c.article_match)
    return SearchResult(status="found" if candidates else "nothing", candidates=candidates)
