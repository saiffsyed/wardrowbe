"""What the paid AI cost this month (our fork), for the household's monthly limit."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AISpend(Base):
    """One row per calendar month ("2026-11"), in euro cents, shared by the whole household:
    the limit is on the one Google bill."""

    __tablename__ = "ai_spend"

    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
