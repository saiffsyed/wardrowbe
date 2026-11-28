"""A place where a person keeps part of their wardrobe."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Home(Base):
    """One of a user's homes. Each clothing item is kept in at most one of them, and the home a
    user says they are in decides which items are on hand and which city's weather applies."""

    __tablename__ = "homes"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_homes_user_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    # The city used for weather. Coordinates are optional: without them the weather API geocodes
    # the city name, exactly as it does for a user's saved location name.
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    lon: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))

    # Set here rather than only by the database, whose now() is the transaction's start: homes
    # are listed in the order they were added, and two added in one transaction would tie.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
