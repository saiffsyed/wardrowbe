"""Couple settings (our fork): who your partner is and whether they see your planned looks."""

import uuid

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CoupleSettings(Base):
    """One per person who changed something. Without a row: sharing is on, and the partner is
    the one other member of a two-person family."""

    __tablename__ = "couple_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Chosen when the family has more than two members.
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    share_plans: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
