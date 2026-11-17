"""Reads and stores a person's wardrobe categories."""

import logging
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wardrobe_category import WardrobeCategoryTree
from app.utils.wardrobe_categories import CategoryTree, default_tree

logger = logging.getLogger(__name__)


async def stored_tree(db: AsyncSession, user_id: UUID) -> CategoryTree | None:
    groups = await db.scalar(
        select(WardrobeCategoryTree.groups).where(WardrobeCategoryTree.user_id == user_id)
    )
    if groups is None:
        return None
    try:
        return CategoryTree(groups=groups)
    except ValidationError as e:
        # A garment type removed from the vocabulary since this was saved, most likely. The
        # wardrobe must still open, so fall back to the built-in tree until it is saved again.
        logger.warning(f"Stored wardrobe categories of user {user_id} are no longer valid: {e}")
        return None


async def tree_for(db: AsyncSession, user_id: UUID) -> CategoryTree:
    """The categories this person sees: their own if they changed them, else the built-in."""
    return await stored_tree(db, user_id) or default_tree()


async def save_tree(db: AsyncSession, user_id: UUID, tree: CategoryTree) -> None:
    groups = tree.model_dump(mode="json", exclude_none=True)["groups"]
    statement = insert(WardrobeCategoryTree).values(user_id=user_id, groups=groups)
    await db.execute(
        statement.on_conflict_do_update(index_elements=["user_id"], set_={"groups": groups})
    )


async def reset_tree(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(delete(WardrobeCategoryTree).where(WardrobeCategoryTree.user_id == user_id))
