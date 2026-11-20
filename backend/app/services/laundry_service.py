"""Where a piece of clothing is in the laundry, and every way it moves (our fork).

An item is in exactly one of four states:

    clean ──wear (enough times)──▶ dirty
      │                              │
      ├──────── wash / dry ──────────┤
      ▼                              ▼
    washing ◀────── wash / dry ───▶ dry_cleaning
      │                              │
      └──── back (records a wash) ───┴──▶ clean

"dirty" is upstream's own ``needs_wash`` flag, worked out from wears. "washing" and
"dry_cleaning" are a row in ``item_laundry``. Everything that changes either goes through
this module, so the rules live in one place:

- ``move``: the Laundry screen and the item's ⋯ menu (wash, dry, back).
- ``returned``: the item screen's "Mark washed" (upstream's wash endpoint).
- ``worn``: wearing a piece that is away means it came back clean first.
- ``forget``: archiving a piece takes it out of the laundry without recording a wash.
"""

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import ClothingItem
from app.models.laundry import ItemLaundry


class Laundry(StrEnum):
    clean = "clean"
    dirty = "dirty"
    washing = "washing"
    dry_cleaning = "dry_cleaning"


Move = Literal["wash", "dry", "back"]

_ROW_STATE: dict[str, Laundry] = {"wash": Laundry.washing, "dry": Laundry.dry_cleaning}
_AWAY = (Laundry.washing, Laundry.dry_cleaning)
DRY_CLEAN_METHOD = "dry_clean"

# Which states each move may start from. Anything else is left as it is (and not counted).
ALLOWED: dict[Move, tuple[Laundry, ...]] = {
    "wash": (Laundry.clean, Laundry.dirty, Laundry.dry_cleaning),
    "dry": (Laundry.clean, Laundry.dirty, Laundry.washing),
    "back": _AWAY,
}


def laundry_of(needs_wash: bool, row_state: str | None) -> Laundry:
    """An item's one laundry state, from its two stored halves."""
    if row_state in _ROW_STATE:
        return _ROW_STATE[row_state]
    return Laundry.dirty if needs_wash else Laundry.clean


def can_move(state: Laundry, to: Move) -> bool:
    return state in ALLOWED[to]


class LaundryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def rows(self, item_ids: list[UUID]) -> dict[UUID, ItemLaundry]:
        if not item_ids:
            return {}
        result = await self.db.execute(select(ItemLaundry).where(ItemLaundry.item_id.in_(item_ids)))
        return {row.item_id: row for row in result.scalars()}

    async def state(self, item: ClothingItem) -> Laundry:
        row = (await self.rows([item.id])).get(item.id)
        return laundry_of(item.needs_wash, row.state if row else None)

    async def move(self, user_id: UUID, items: list[ClothingItem], to: Move, today: date) -> int:
        """Apply one move to several items; returns how many actually moved."""
        rows = await self.rows([item.id for item in items])
        now = datetime.now(UTC)
        moved = 0
        for item in items:
            row = rows.get(item.id)
            state = laundry_of(item.needs_wash, row.state if row else None)
            if not can_move(state, to):
                continue
            moved += 1
            if to == "back":
                await self._wash(item, row, today)
            elif row is None:
                self.db.add(ItemLaundry(item_id=item.id, user_id=user_id, state=to, since=now))
            else:
                row.state = to
                row.since = now
        await self.db.flush()
        return moved

    async def returned(
        self, item: ClothingItem, washed_at: date, method: str | None, notes: str | None
    ) -> None:
        """Marked washed from the item screen: back in the wardrobe, clean."""
        row = (await self.rows([item.id])).get(item.id)
        await self._wash(item, row, washed_at, method=method, notes=notes)
        await self.db.flush()

    async def worn(self, user_id: UUID, item_ids: list[UUID], worn_at: date) -> None:
        """Pieces worn while marked away must have come back clean; record that first."""
        rows = await self.rows(item_ids)
        if not rows:
            return
        result = await self.db.execute(
            select(ClothingItem).where(
                ClothingItem.id.in_(list(rows)), ClothingItem.user_id == user_id
            )
        )
        for item in result.scalars():
            await self._wash(item, rows[item.id], worn_at)
        await self.db.flush()

    async def forget(self, item_ids: list[UUID]) -> None:
        """Taken out of the laundry without a wash (an archived piece)."""
        if item_ids:
            await self.db.execute(
                delete(ItemLaundry)
                .where(ItemLaundry.item_id.in_(item_ids))
                .execution_options(synchronize_session=False)
            )

    async def _wash(
        self,
        item: ClothingItem,
        row: ItemLaundry | None,
        washed_at: date,
        method: str | None = None,
        notes: str | None = None,
    ) -> None:
        # Imported here: ItemService itself calls into this module.
        from app.services.item_service import ItemService

        if method is None and row is not None and row.state == "dry":
            method = DRY_CLEAN_METHOD
        await ItemService(self.db).log_wash(
            item=item, washed_at=washed_at, method=method, notes=notes
        )
        if row is not None:
            await self.db.delete(row)
