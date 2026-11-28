"""add homes, and the home an item is kept in and a user is in

Revision ID: b8e4d0f2a6c3
Revises: a7d3c9e1f5b2
Create Date: 2026-11-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b8e4d0f2a6c3"
down_revision: str | None = "a7d3c9e1f5b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "homes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("lon", sa.Numeric(11, 8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "name", name="uq_homes_user_name"),
    )
    op.create_index("ix_homes_user_id", "homes", ["user_id"])

    op.add_column(
        "clothing_items", sa.Column("home_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_clothing_items_home_id",
        "clothing_items",
        "homes",
        ["home_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_clothing_items_home_id", "clothing_items", ["home_id"])

    op.add_column(
        "users", sa.Column("current_home_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_users_current_home_id",
        "users",
        "homes",
        ["current_home_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Occasion tags live in the tags JSONB (a user-owned key); the wardrobe filters on them.
    op.create_index(
        "ix_clothing_items_tags_occasions",
        "clothing_items",
        [sa.text("(tags -> 'occasions')")],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_clothing_items_tags_occasions", table_name="clothing_items")
    op.drop_constraint("fk_users_current_home_id", "users", type_="foreignkey")
    op.drop_column("users", "current_home_id")
    op.drop_index("ix_clothing_items_home_id", table_name="clothing_items")
    op.drop_constraint("fk_clothing_items_home_id", "clothing_items", type_="foreignkey")
    op.drop_column("clothing_items", "home_id")
    op.drop_index("ix_homes_user_id", table_name="homes")
    op.drop_table("homes")
