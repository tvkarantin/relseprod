"""Alembic environment.

The database URL always comes from the application settings (``DATABASE_URL``),
never from ``alembic.ini``, so migrations and the running app agree on the
target database.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, event, pool

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.core.config import get_settings
from app.database.types import UTCDateTime
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# A URL set programmatically (e.g. by the test suite) wins over the settings,
# so migrations can be applied to a temporary database.
DATABASE_URL: str = config.get_main_option("sqlalchemy.url") or ""
if not DATABASE_URL:
    DATABASE_URL = get_settings().sqlalchemy_database_url
    config.set_main_option("sqlalchemy.url", DATABASE_URL)

target_metadata = Base.metadata


def _is_sqlite() -> bool:
    return DATABASE_URL.startswith("sqlite")


def render_item(type_: str, obj: object, autogen_context: object) -> str | bool:
    """Render custom column types as plain SQLAlchemy types.

    ``UTCDateTime`` is a ``TypeDecorator`` over ``DateTime(timezone=True)`` and
    only changes Python-side behaviour, so migrations can emit the underlying
    type and stay independent of the application package.
    """
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime(timezone=True)"
    return False


def run_migrations_offline() -> None:
    """Run migrations without a DBAPI connection (emit SQL)."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=_is_sqlite(),
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    section = config.get_section(config.config_ini_section, {})
    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    if _is_sqlite():
        # The pragma must be issued on the raw DBAPI connection: running it
        # through the SQLAlchemy connection would open a transaction and break
        # Alembic's version bookkeeping.
        @event.listens_for(connectable, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):  # noqa: ANN001, ANN202
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA foreign_keys=ON")
            finally:
                cursor.close()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=_is_sqlite(),
            render_item=render_item,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
