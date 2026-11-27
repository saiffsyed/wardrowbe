"""See-through cut-outs of clothes photos.

When a photo's background is removed, the cleaned photo is still saved on white as a JPEG: that
is the copy the tagger, the duplicate check and every image operation read. Beside it this
module keeps the same picture with nothing behind the garment (WebP with transparency), in the
same three sizes. Screens are sent the cut-out whenever one exists, so clothes sit on whatever
is behind them: a white page, a dark page, a mannequin, or another garment in an outfit.

A cut-out is trimmed to the garment's edges with a thin margin, so a shirt can sit right on
top of the trousers in an outfit and a garment fills its tile in the wardrobe.

Cut-outs are found by file name, not stored in the database: `abc.jpg` has `abc_cut.webp`,
`abc_medium.jpg` has `abc_cut_medium.webp`, `abc_thumb.jpg` has `abc_cut_thumb.webp`.
"""

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

from app.config import get_settings

# (suffix of the photo it stands in for, longest side in px, WebP quality)
_SIZES = (("", 1600, 90), ("_medium", 800, 88), ("_thumb", 400, 86))
_CUT = "_cut"
# Pixels fainter than this are leftover haze from the removal, not garment.
_SOLID_ALPHA = 12
# Margin kept round the garment when trimming, as a share of its longer side.
_TRIM_MARGIN = 0.02
# A separate patch smaller than this share of the biggest one is a leftover bit of floor or of
# something lying beside the garment, not part of it (an earring's twin is far bigger than this).
_LOOSE_BIT_SHARE = 0.06
# Patches are found on a smaller copy of the mask: plenty to tell bits from garment, and quick.
_MASK_PX = 512


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


def drop_loose_bits(rgba: Image.Image) -> Image.Image:
    """The cut-out without small patches that are not joined to the garment. Without numpy and
    scipy (not installed) it comes back as it was."""
    try:
        import numpy as np
        from scipy import ndimage
    except ImportError:
        return rgba
    alpha = rgba.getchannel("A")
    small = alpha.copy()
    small.thumbnail((_MASK_PX, _MASK_PX), Image.Resampling.BILINEAR)
    solid = np.asarray(small) > _SOLID_ALPHA
    labels, count = ndimage.label(solid, structure=np.ones((3, 3), dtype=bool))
    if count < 2:
        return rgba
    sizes = np.bincount(labels.ravel())[1:]
    keep = np.flatnonzero(sizes >= sizes.max() * _LOOSE_BIT_SHARE) + 1
    if len(keep) == count:
        return rgba
    kept = Image.fromarray((np.isin(labels, keep) * 255).astype(np.uint8))
    # Grown a little before scaling back up, so the garment's own soft edge is not shaved off.
    kept = kept.filter(ImageFilter.MaxFilter(5)).resize(rgba.size, Image.Resampling.BILINEAR)
    cleaned = rgba.copy()
    cleaned.putalpha(ImageChops.multiply(alpha, kept))
    return cleaned


def trim(cutout: Image.Image) -> Image.Image:
    """The cut-out without loose bits, cropped to the garment with a thin margin. One with
    nothing solid in it, or already trimmed, comes back the same size."""
    rgba = drop_loose_bits(cutout.convert("RGBA"))
    solid = rgba.getchannel("A").point(lambda a: 255 if a > _SOLID_ALPHA else 0)
    box = solid.getbbox()
    if box is None:
        return rgba
    left, top, right, bottom = box
    margin = round(max(right - left, bottom - top) * _TRIM_MARGIN)
    box = (
        max(0, left - margin),
        max(0, top - margin),
        min(rgba.width, right + margin),
        min(rgba.height, bottom + margin),
    )
    return rgba.crop(box)


def write_cutouts(storage_root: Path, image_path: str, cutout: Image.Image) -> None:
    """Save a background-removed photo (with transparency), trimmed, beside the item's main
    photo."""
    rgba = trim(cutout)
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
