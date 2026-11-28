"""A photo of an item's care label or hang tag."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ItemLabelPhoto(Base):
    """Kept after the label has been read, so a person can check a size or a care symbol against
    the label itself later. Apart from the item's own photos: a label is never the picture of
    the garment, and never goes to the tagger."""

    __tablename__ = "item_label_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clothing_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # Set here rather than only by the database, whose now() is the transaction's start: the
    # photos of one scan are added in one transaction and are listed in the order they were sent.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
