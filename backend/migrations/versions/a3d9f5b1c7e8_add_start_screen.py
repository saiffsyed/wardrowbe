"""add the screen the app opens on

Revision ID: a3d9f5b1c7e8
Revises: f2c8b4d6e0a7
Create Date: 2026-11-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3d9f5b1c7e8"
down_revision: str | None = "f2c8b4d6e0a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("start_screen", sa.String(20), nullable=False, server_default="wardrobe"),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "start_screen")
