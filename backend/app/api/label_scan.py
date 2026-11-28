"""Scan an item's care label: keep the photos and suggest the details they show.

A scan never changes an item's details. It stores the photos, asks the vision model what they
say, and hands the reading back for the person to check; what they confirm is saved through the
ordinary item update.
"""

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.config import get_settings
from app.database import DbSession
from app.models.item import ClothingItem
from app.models.label_photo import ItemLabelPhoto
from app.models.preference import UserPreference
from app.models.user import User
from app.services.ai_service import AIDisabledError, AIService, require_internal_ai
from app.services.image_service import ImageService, ImageTooLargeError
from app.services.item_service import ItemService
from app.services.label_photos import delete_label_photo_files, store_label_photo
from app.services.label_reader import LabelReading, read_labels
from app.utils.auth import get_current_user
from app.utils.rate_limit import rate_limit_by_user
from app.utils.signed_urls import sign_image_url
from app.utils.uploads import UploadTooLargeError, read_upload_within_limit

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/items", tags=["Items"])

# A care label, its other side and a hang tag.
MAX_PHOTOS_PER_SCAN = 3
MAX_PHOTOS_PER_ITEM = 6

# read: the labels gave at least one detail. nothing_read: the model answered but found nothing
# legible. ai_disabled / ai_unreachable: nobody looked. The photos are kept in every case.
ScanStatus = Literal["read", "nothing_read", "ai_disabled", "ai_unreachable"]


class LabelPhotoResponse(BaseModel):
    id: UUID
    image_url: str
    thumbnail_url: str


class LabelScanResponse(BaseModel):
    status: ScanStatus
    reading: LabelReading | None = None
    photos: list[LabelPhotoResponse]


def _photo_response(photo: ItemLabelPhoto) -> LabelPhotoResponse:
    return LabelPhotoResponse(
        id=photo.id,
        image_url=sign_image_url(photo.image_path),
        thumbnail_url=sign_image_url(photo.thumbnail_path),
    )


async def _owned_item(db: DbSession, item_id: UUID, user: User) -> ClothingItem:
    item = await ItemService(db).get_by_id(item_id, user.id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


async def _photos_of(db: DbSession, item_id: UUID) -> list[ItemLabelPhoto]:
    result = await db.execute(
        select(ItemLabelPhoto)
        .where(ItemLabelPhoto.item_id == item_id)
        .order_by(ItemLabelPhoto.created_at, ItemLabelPhoto.id)
    )
    return list(result.scalars().all())


def _invalid_image() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "message": "Invalid image file. Supported formats: JPEG, PNG, WebP, HEIC",
            "error_code": "INVALID_IMAGE",
        },
    )


@router.get("/{item_id}/label-photos", response_model=list[LabelPhotoResponse])
async def list_label_photos(
    item_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[LabelPhotoResponse]:
    await _owned_item(db, item_id, current_user)
    return [_photo_response(photo) for photo in await _photos_of(db, item_id)]


@router.delete("/{item_id}/label-photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label_photo(
    item_id: UUID,
    photo_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await _owned_item(db, item_id, current_user)
    photo = await db.scalar(
        select(ItemLabelPhoto).where(
            ItemLabelPhoto.id == photo_id, ItemLabelPhoto.item_id == item_id
        )
    )
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label photo not found")
    await db.delete(photo)
    await db.commit()
    delete_label_photo_files(ImageService(), [photo])


@router.post("/{item_id}/label-scan", response_model=LabelScanResponse)
async def scan_label(
    item_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    images: Annotated[list[UploadFile], File()],
) -> LabelScanResponse:
    """Keep one to three photos of an item's labels and read the details off them.

    Changes none of the item's details. The photos are kept even when nothing could be read,
    so the person can still fill the details in by hand from them.
    """
    item = await _owned_item(db, item_id, current_user)
    if not 1 <= len(images) <= MAX_PHOTOS_PER_SCAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Send one to {MAX_PHOTOS_PER_SCAN} photos",
                "error_code": "LABEL_PHOTO_COUNT",
            },
        )
    await rate_limit_by_user(current_user.id, "label-scan", max_requests=10, window_seconds=60)

    existing = await db.scalar(
        select(func.count()).select_from(ItemLabelPhoto).where(ItemLabelPhoto.item_id == item_id)
    )
    if (existing or 0) + len(images) > MAX_PHOTOS_PER_ITEM:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"An item keeps at most {MAX_PHOTOS_PER_ITEM} label photos",
                "error_code": "LABEL_PHOTO_LIMIT",
            },
        )

    image_service = ImageService()
    uploads: list[tuple[bytes, str]] = []
    for image in images:
        try:
            content = await read_upload_within_limit(image, settings.max_upload_size_mb)
        except UploadTooLargeError as e:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(e)
            ) from None
        if not image_service.validate_image(
            content, image.content_type or "application/octet-stream"
        ):
            raise _invalid_image()
        uploads.append((content, image.filename or "label.jpg"))

    # All or nothing: a scan whose second photo is unusable keeps none of them.
    new_photos: list[ItemLabelPhoto] = []
    try:
        for content, filename in uploads:
            try:
                paths = await store_label_photo(image_service, current_user.id, content, filename)
            except (ValueError, ImageTooLargeError, OSError) as e:
                raise _invalid_image() from e
            photo = ItemLabelPhoto(item_id=item.id, **paths)
            new_photos.append(photo)
            db.add(photo)
        await db.commit()
    except Exception:
        await db.rollback()
        delete_label_photo_files(image_service, new_photos)
        raise

    scan_status, reading = await _read(db, current_user, image_service, item_id, new_photos)
    return LabelScanResponse(
        status=scan_status,
        reading=reading,
        photos=[_photo_response(photo) for photo in await _photos_of(db, item_id)],
    )


async def _read(
    db: DbSession,
    user: User,
    image_service: ImageService,
    item_id: UUID,
    photos: list[ItemLabelPhoto],
) -> tuple[ScanStatus, LabelReading | None]:
    try:
        require_internal_ai("vision")
    except AIDisabledError:
        return "ai_disabled", None

    ai_endpoints = (
        await db.execute(
            select(UserPreference.ai_endpoints).where(UserPreference.user_id == user.id)
        )
    ).scalar_one_or_none()
    paths = [image_service.get_image_path(photo.image_path) for photo in photos]
    try:
        reading = await read_labels(AIService(endpoints=ai_endpoints), paths, locale=user.locale)
    except Exception as e:
        logger.error(f"Label reading failed for item {item_id}: {e}")
        return "ai_unreachable", None
    if not reading.has_content():
        return "nothing_read", None
    return "read", reading
