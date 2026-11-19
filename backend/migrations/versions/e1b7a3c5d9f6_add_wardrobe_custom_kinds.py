"""add the kinds of item a person adds themselves

Revision ID: e1b7a3c5d9f6
Revises: d0a6f2b4c8e5
Create Date: 2026-11-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e1b7a3c5d9f6"
down_revision: str | None = "d0a6f2b4c8e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wardrobe_custom_kinds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("base_type", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_wardrobe_custom_kinds_user_id", "wardrobe_custom_kinds", ["user_id"])
    op.create_index(
        "uq_wardrobe_custom_kinds_user_name",
        "wardrobe_custom_kinds",
        ["user_id", sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_wardrobe_custom_kinds_user_name", table_name="wardrobe_custom_kinds")
    op.drop_index("ix_wardrobe_custom_kinds_user_id", table_name="wardrobe_custom_kinds")
    op.drop_table("wardrobe_custom_kinds")
