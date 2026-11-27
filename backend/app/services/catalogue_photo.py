"""A clean catalogue photo of the person's own garment (our fork).

Nano Banana (Gemini's image model) gets the item's photo on white and is asked for the same
garment, pressed and laid out like a shop picture. The result is only a draft until the person
picks it; drafts are files beside the user's photos and are cleared after a day.
"""

import base64
import io
import logging
import os
import time
import uuid
from pathlib import Path

import httpx
from PIL import Image

from app.config import get_settings
from app.services.image_service import ImageService
from app.services.product_finder import GEMINI_HOST, GEMINI_NATIVE

logger = logging.getLogger(__name__)

INPUT_PX = 1536
PREVIEW_PX = 720
DRAFT_TTL_SECONDS = 24 * 3600

PROMPT = """Turn this photo of a piece of clothing into a clean catalogue product photo of the \
SAME garment, as an online shop would show it.

Keep exactly: the colour and shade, the fabric and its texture, every print, pattern, border, \
embroidery and embellishment, the buttons, zips and pockets, the neckline, sleeves, length and \
proportions. Do not add, remove or redesign anything.

Change only: smooth out creases and wrinkles, straighten it and lay it out neatly and \
symmetrically (flat lay or invisible mannequin), soft even studio light, plain pure white \
background, the whole garment in view and centred. No person, no hands, no text, no logos, no \
props, no shadows on the background."""


class CatalogueError(Exception):
    """The image model gave no usable picture."""


def image_model() -> str:
    return os.environ.get("AI_IMAGE_MODEL", "").strip()


def available() -> bool:
    settings = get_settings()
    return bool(
        settings.ai_api_key and image_model() and GEMINI_HOST in (settings.ai_base_url or "")
    )


def _jpeg(image: Image.Image, max_px: int, quality: int = 90) -> bytes:
    image = image.convert("RGB")
    image.thumbnail((max_px, max_px))
    out = io.BytesIO()
    image.save(out, "JPEG", quality=quality)
    return out.getvalue()


def picture_from_answer(answer: dict) -> bytes:
    for candidate in answer.get("candidates") or []:
        for part in (candidate.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data")
            if isinstance(inline, dict) and inline.get("data"):
                return base64.b64decode(inline["data"])
    raise CatalogueError("no picture in the answer")


async def generate(photo: Path) -> bytes:
    """The catalogue version of a photo, as JPEG bytes."""
    with Image.open(photo) as source:
        payload = base64.b64encode(_jpeg(source, INPUT_PX)).decode("ascii")
    settings = get_settings()
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        try:
            response = await client.post(
                f"{GEMINI_NATIVE}/models/{image_model()}:generateContent",
                headers={"x-goog-api-key": settings.ai_api_key or ""},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"inline_data": {"mime_type": "image/jpeg", "data": payload}},
                                {"text": PROMPT},
                            ],
                        }
                    ],
                    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise CatalogueError(str(e)) from e
    raw = picture_from_answer(response.json())
    try:
        with Image.open(io.BytesIO(raw)) as picture:
            return _jpeg(picture, 2048, 92)
    except Exception as e:
        raise CatalogueError("unreadable picture") from e


# --- drafts --------------------------------------------------------------------------


def _drafts_dir(user_id: uuid.UUID) -> Path:
    path = ImageService().storage_path / str(user_id) / "drafts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def draft_path(user_id: uuid.UUID, item_id: uuid.UUID, draft_id: str) -> Path | None:
    try:
        draft = uuid.UUID(draft_id).hex
    except ValueError:
        return None
    return _drafts_dir(user_id) / f"{item_id.hex}_{draft}.jpg"


def save_draft(user_id: uuid.UUID, item_id: uuid.UUID, picture: bytes) -> tuple[str, str]:
    """(draft id, preview data URL). Old drafts of this user go first."""
    folder = _drafts_dir(user_id)
    now = time.time()
    for old in folder.glob("*.jpg"):
        if now - old.stat().st_mtime > DRAFT_TTL_SECONDS:
            old.unlink(missing_ok=True)
    draft_id = uuid.uuid4().hex
    path = draft_path(user_id, item_id, draft_id)
    path.write_bytes(picture)
    with Image.open(io.BytesIO(picture)) as image:
        preview = _jpeg(image, PREVIEW_PX, 85)
    return draft_id, "data:image/jpeg;base64," + base64.b64encode(preview).decode("ascii")
