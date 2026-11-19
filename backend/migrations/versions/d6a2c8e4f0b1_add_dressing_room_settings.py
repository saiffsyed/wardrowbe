"""add each person's dressing-room settings

Revision ID: d6a2c8e4f0b1
Revises: c5f1b7d3e9a0
Create Date: 2026-11-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d6a2c8e4f0b1"
down_revision: str | None = "c5f1b7d3e9a0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dressing_room_settings",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("figure", sa.String(10), nullable=False, server_default="women"),
        sa.Column("background", sa.String(7), nullable=False, server_default="auto"),
        sa.Column("figure_colour", sa.String(7), nullable=False, server_default="auto"),
    )


def downgrade() -> None:
    op.drop_table("dressing_room_settings")
