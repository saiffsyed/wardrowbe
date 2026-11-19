"""add stays: where a person will be on given days

Revision ID: b4e0a6c2d8f9
Revises: a3d9f5b1c7e8
Create Date: 2026-11-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b4e0a6c2d8f9"
down_revision: str | None = "a3d9f5b1c7e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "home_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("homes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("lon", sa.Numeric(11, 8), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("end_date >= start_date", name="ck_stays_dates_in_order"),
    )
    op.create_index("ix_stays_user_dates", "stays", ["user_id", "start_date", "end_date"])


def downgrade() -> None:
    op.drop_index("ix_stays_user_dates", table_name="stays")
    op.drop_table("stays")
