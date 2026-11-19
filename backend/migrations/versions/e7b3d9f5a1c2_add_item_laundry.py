"""add clothes away in the wash or at the dry cleaner

Revision ID: e7b3d9f5a1c2
Revises: d6a2c8e4f0b1
Create Date: 2026-11-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e7b3d9f5a1c2"
down_revision: str | None = "d6a2c8e4f0b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "item_laundry",
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clothing_items.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("state", sa.String(10), nullable=False),
        sa.Column(
            "since", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_item_laundry_user_id", "item_laundry", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_item_laundry_user_id", table_name="item_laundry")
    op.drop_table("item_laundry")
