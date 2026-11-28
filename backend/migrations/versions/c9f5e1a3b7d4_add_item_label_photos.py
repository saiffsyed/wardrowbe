"""add the photos of an item's care label

Revision ID: c9f5e1a3b7d4
Revises: b8e4d0f2a6c3
Create Date: 2026-11-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c9f5e1a3b7d4"
down_revision: str | None = "b8e4d0f2a6c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "item_label_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clothing_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("image_path", sa.String(500), nullable=False),
        sa.Column("thumbnail_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_item_label_photos_item_id", "item_label_photos", ["item_id"])


def downgrade() -> None:
    op.drop_index("ix_item_label_photos_item_id", table_name="item_label_photos")
    op.drop_table("item_label_photos")
