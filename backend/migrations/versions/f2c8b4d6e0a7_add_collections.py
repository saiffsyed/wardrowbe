"""add collections of clothes and outfits

Revision ID: f2c8b4d6e0a7
Revises: e1b7a3c5d9f6
Create Date: 2026-11-18

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f2c8b4d6e0a7"
down_revision: str | None = "e1b7a3c5d9f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "collections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_collections_user_id", "collections", ["user_id"])
    op.create_table(
        "collection_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "collection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clothing_items.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "outfit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("outfits.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "(item_id IS NULL) <> (outfit_id IS NULL)", name="ck_collection_entries_one_thing"
        ),
    )
    op.create_index("ix_collection_entries_item_id", "collection_entries", ["item_id"])
    op.create_index("ix_collection_entries_outfit_id", "collection_entries", ["outfit_id"])
    op.create_index(
        "uq_collection_entries_item",
        "collection_entries",
        ["collection_id", "item_id"],
        unique=True,
        postgresql_where=sa.text("item_id IS NOT NULL"),
    )
    op.create_index(
        "uq_collection_entries_outfit",
        "collection_entries",
        ["collection_id", "outfit_id"],
        unique=True,
        postgresql_where=sa.text("outfit_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("collection_entries")
    op.drop_index("ix_collections_user_id", table_name="collections")
    op.drop_table("collections")
