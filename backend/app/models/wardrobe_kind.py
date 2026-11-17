"""A kind of item a person added themselves, such as "pattu pavadai"."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WardrobeCustomKind(Base):
    """A person's own kind of item is always "a kind of" one of the built-in types, and that
    is how it is stored on an item: the built-in type in `type`, this kind's name in
    `subtype`. So outfits, wash intervals, weather rules and the tagger, which all go by the
    built-in type, need to know nothing about it."""

    __tablename__ = "wardrobe_custom_kinds"
    __table_args__ = (
        Index("uq_wardrobe_custom_kinds_user_name", "user_id", func.lower("name"), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    # The built-in garment type this is a kind of.
    base_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
