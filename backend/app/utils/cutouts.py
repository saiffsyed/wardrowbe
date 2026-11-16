"""See-through cut-outs of clothes photos.

When a photo's background is removed, the cleaned photo is still saved on white as a JPEG: that
is the copy the tagger, the duplicate check and every image operation read. Beside it this
module keeps the same picture with nothing behind the garment (WebP with transparency), in the
same three sizes. Screens are sent the cut-out whenever one exists, so clothes sit on whatever
is behind them: a white page, a dark page, a mannequin, or another garment in an outfit.

Cut-outs are found by file name, not stored in the database: `abc.jpg` has `abc_cut.webp`,
`abc_medium.jpg` has `abc_cut_medium.webp`, `abc_thumb.jpg` has `abc_cut_thumb.webp`.
"""

from io import BytesIO
from pathlib import Path

from PIL import Image

from app.config import get_settings

# (suffix of the photo it stands in for, longest side in px, WebP quality)
_SIZES = (("", 1600, 90), ("_medium", 800, 88), ("_thumb", 400, 86))
_CUT = "_cut"


def _storage_root() -> Path:
    return Path(get_settings().storage_path)


def _base_of(image_path: str) -> str:
    return image_path.rsplit(".", 1)[0]


def cutout_paths(image_path: str) -> list[str]:
    """Where the cut-outs of an item's main photo live, largest first."""
    base = _base_of(image_path)
    return [f"{base}{_CUT}{suffix}.webp" for suffix, _, _ in _SIZES]


def _cutout_for(path: str) -> str | None:
    """The cut-out that would stand in for a stored photo path, if it is the kind that has one."""
    if not path.endswith(".jpg"):
        return None
    base = _base_of(path)
    for suffix in ("_medium", "_thumb"):
        if base.endswith(suffix):
            return f"{base[: -len(suffix)]}{_CUT}{suffix}.webp"
    return f"{base}{_CUT}.webp"


def display_path(path: str, storage_root: Path | None = None) -> str:
    """The path a screen should be sent for a stored photo: its cut-out when there is one."""
    cutout = _cutout_for(path)
    if cutout and ((storage_root or _storage_root()) / cutout).is_file():
        return cutout
    return path


def _encode(image: Image.Image, max_px: int, quality: int) -> bytes:
    sized = image.copy()
    sized.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    sized.save(buffer, format="WEBP", quality=quality, method=4)
    return buffer.getvalue()


def write_cutouts(storage_root: Path, image_path: str, cutout: Image.Image) -> None:
    """Save a background-removed photo (with transparency) beside the item's main photo."""
    rgba = cutout.convert("RGBA")
    for path, (_, max_px, quality) in zip(cutout_paths(image_path), _SIZES, strict=True):
        (storage_root / path).write_bytes(_encode(rgba, max_px, quality))


def delete_cutouts(storage_root: Path, image_path: str) -> None:
    for path in cutout_paths(image_path):
        (storage_root / path).unlink(missing_ok=True)


def rotate_cutouts(storage_root: Path, image_path: str, angle: int) -> None:
    """Turn an item's cut-outs with its photo. Does nothing when it has none."""
    full = storage_root / cutout_paths(image_path)[0]
    if not full.is_file():
        return
    with Image.open(full) as image:
        rotated = image.convert("RGBA").rotate(angle, expand=True)
    write_cutouts(storage_root, image_path, rotated)
