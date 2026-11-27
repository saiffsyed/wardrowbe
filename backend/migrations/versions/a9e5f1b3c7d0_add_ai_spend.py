"""add ai spend: what the paid AI cost each month

Revision ID: a9e5f1b3c7d0
Revises: f8c4e0a6b2d3
Create Date: 2026-11-27

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9e5f1b3c7d0"
down_revision: str | None = "f8c4e0a6b2d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_spend",
        sa.Column("month", sa.String(7), primary_key=True),
        sa.Column("cents", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("ai_spend")
