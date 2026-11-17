"""Collections: named groups of clothes and outfits a person puts together ("Sister's wedding")."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    # Kept for the "share with family" switch Saiff agreed to add later; nothing reads it yet.
    shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
    )

    entries: Mapped[list["CollectionEntry"]] = relationship(
        "CollectionEntry",
        back_populates="collection",
        cascade="all, delete-orphan",
        order_by="CollectionEntry.position",
    )


class CollectionEntry(Base):
    """One clothing item or one outfit in a collection, never both."""

    __tablename__ = "collection_entries"
    __table_args__ = (
        CheckConstraint(
            "(item_id IS NULL) <> (outfit_id IS NULL)", name="ck_collection_entries_one_thing"
        ),
        Index(
            "uq_collection_entries_item",
            "collection_id",
            "item_id",
            unique=True,
            postgresql_where="item_id IS NOT NULL",
        ),
        Index(
            "uq_collection_entries_outfit",
            "collection_id",
            "outfit_id",
            unique=True,
            postgresql_where="outfit_id IS NOT NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    # An entry goes with the item or outfit it names: deleting either takes it out of every
    # collection.
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clothing_items.id", ondelete="CASCADE"), index=True
    )
    outfit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )

    collection: Mapped[Collection] = relationship("Collection", back_populates="entries")
