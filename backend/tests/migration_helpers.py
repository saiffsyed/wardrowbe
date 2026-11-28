import os
import subprocess
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

FORK_COLUMNS = (
    ("users", "current_home_id", "uuid"),
    ("clothing_items", "home_id", "uuid"),
    ("user_preferences", "start_screen", "varchar(20) NOT NULL DEFAULT 'wardrobe'"),
)


def alembic(*args: str) -> None:
    env = {**os.environ, "DATABASE_URL": os.environ["TEST_DATABASE_URL"]}
    result = subprocess.run(
        ["python", "-m", "alembic", *args], env=env, capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"alembic {' '.join(args)} failed:\n{result.stderr[-4000:]}")


@asynccontextmanager
async def migration_downgrade(db_session: AsyncSession, revision: str) -> AsyncIterator[None]:
    # Migrations lock users, so the test's own transaction must end before each alembic run or
    # the migration waits on it until lock_timeout; a failed body leaves it idle or aborted.
    await db_session.commit()
    alembic("downgrade", revision)
    # This fork's own migration sits after every upstream one, so stepping back to an upstream
    # revision also drops the fork's columns, while the models the tests insert with still have
    # them. Stand the bare columns in for the duration, and remove them before upgrading again.
    for table, column, column_type in FORK_COLUMNS:
        await db_session.execute(
            text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {column_type}")
        )
    await db_session.commit()
    try:
        yield
    finally:
        await db_session.rollback()
        for table, column, _ in FORK_COLUMNS:
            await db_session.execute(text(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {column}"))
        await db_session.commit()
        alembic("upgrade", "head")
