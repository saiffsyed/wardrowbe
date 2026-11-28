"""The household's monthly limit on paid AI (our fork).

Every paid call is priced up front from fixed estimates, refused when it would go over the limit,
and recorded once it has been made. The estimates are rounded up, so the real bill stays under.
"""

import os
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_spend import AISpend

# Estimated cost of one call, in euro cents (prices checked Nov 2026, rounded up).
PRODUCT_SEARCH_CENTS = 4
CATALOGUE_PHOTO_CENTS = 7


def monthly_limit_cents() -> int:
    try:
        return max(0, round(float(os.environ.get("AI_MONTHLY_LIMIT_EUR", "10")) * 100))
    except ValueError:
        return 1000


def _this_month() -> str:
    return datetime.now(UTC).strftime("%Y-%m")


async def spent_this_month(db: AsyncSession) -> int:
    result = await db.execute(select(AISpend.cents).where(AISpend.month == _this_month()))
    return result.scalar_one_or_none() or 0


async def can_spend(db: AsyncSession, cents: int) -> bool:
    return await spent_this_month(db) + cents <= monthly_limit_cents()


async def record(db: AsyncSession, cents: int) -> None:
    statement = insert(AISpend).values(month=_this_month(), cents=cents)
    statement = statement.on_conflict_do_update(
        index_elements=[AISpend.month], set_={"cents": AISpend.cents + cents}
    )
    await db.execute(statement)
    await db.flush()
