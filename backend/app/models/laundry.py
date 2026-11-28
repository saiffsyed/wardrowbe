"""Clothes that are away being cleaned (our fork): in the wash or at the dry cleaner.

"Needs washing" is upstream's own `needs_wash` flag, worked out from wears; this table only
holds clothes that have left the cupboard. An item back in the wardrobe has no row.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

LAUNDRY_STATES = ("wash", "dry")


class ItemLaundry(Base):
    __tablename__ = "item_laundry"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clothing_items.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # "wash" (in the machine or drying) or "dry" (at the dry cleaner).
    state: Mapped[str] = mapped_column(String(10), nullable=False)
    since: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


async def away_item_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """The person's clothes that are away being cleaned, to leave out of outfits."""
    return set(
        (await db.execute(select(ItemLaundry.item_id).where(ItemLaundry.user_id == user_id)))
        .scalars()
        .all()
    )
