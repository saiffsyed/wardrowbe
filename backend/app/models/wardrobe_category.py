"""A person's own arrangement of the wardrobe's categories."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WardrobeCategoryTree(Base):
    """Present only for someone who has changed the categories in Settings; everyone else
    reads the built-in tree. Stored whole: it is small, always read and written in one piece,
    and its shape is checked by app.utils.wardrobe_categories.CategoryTree."""

    __tablename__ = "wardrobe_category_trees"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    groups: Mapped[list] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
