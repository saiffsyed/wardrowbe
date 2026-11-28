"""How a look was arranged on the outfit board, so it is shown exactly as saved."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OutfitLayout(Base):
    """One per arranged outfit. Outfits never arranged by hand have none and are shown with the
    automatic layout. Pieces are [{item_id, x, y, w, z}]: position and width in percent of the
    board (3 wide by 4 high), z the stacking order."""

    __tablename__ = "outfit_layouts"

    outfit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="CASCADE"), primary_key=True
    )
    background: Mapped[str] = mapped_column(String(7), nullable=False, default="#ffffff")
    pieces: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
