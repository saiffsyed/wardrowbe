"""Where a person will be on given days: "Bangalore, Fri 21 to Sat 22 Nov"."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Stay(Base):
    """Days spent away from the current home. Days without a stay use the current home's city,
    so only the exceptions are stored. Either one of the person's homes or any city."""

    __tablename__ = "stays"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_stays_dates_in_order"),
        Index("ix_stays_user_dates", "user_id", "start_date", "end_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # A stay at one of the person's homes keeps the link, so the wardrobe can offer that
    # home's clothes on the day. A deleted home leaves the stay as a plain city.
    home_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("homes.id", ondelete="SET NULL")
    )
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    # Filled in when the city is found on the map; left empty when the map service could not
    # be reached, and looked up again when the weather is needed.
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    lon: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
