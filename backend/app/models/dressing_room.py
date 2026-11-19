"""A person's dressing-room look: the figure's shape and colour and the background (our fork)."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DressingRoomSettings(Base):
    """One per person who changed something; everyone else gets the defaults. "auto" for a
    colour means it follows the app's light or dark mode."""

    __tablename__ = "dressing_room_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    figure: Mapped[str] = mapped_column(String(10), nullable=False, default="women")
    background: Mapped[str] = mapped_column(String(7), nullable=False, default="auto")
    figure_colour: Mapped[str] = mapped_column(String(7), nullable=False, default="auto")
