"""Database engine, session factory and FastAPI dependency."""

from __future__ import annotations

import logging
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings

if TYPE_CHECKING:
    from sqlalchemy.engine.interfaces import DBAPIConnection
    from sqlalchemy.pool import ConnectionPoolEntry

logger = logging.getLogger(__name__)


def _sqlite_connect_args(url: str) -> dict[str, Any]:
    """Connection arguments required for SQLite used from a threadpool."""
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _ensure_sqlite_directory(url: str) -> None:
    """Create the parent directory of a file-based SQLite database.

    Failures are logged rather than raised: the application must still start so
    that ``GET /health`` can report the problem through the unified error format
    instead of crashing at import time.
    """
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return
    raw_path = url[len(prefix) :]
    if not raw_path or raw_path.startswith(":memory:"):
        return
    try:
        Path(raw_path).expanduser().parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        logger.warning("Could not create the directory for the configured SQLite database")


def enable_sqlite_foreign_keys(engine: Engine) -> None:
    """Turn on ``PRAGMA foreign_keys`` so ON DELETE CASCADE works in SQLite."""

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(
        dbapi_connection: DBAPIConnection, _record: ConnectionPoolEntry
    ) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()


def create_database_engine(settings: Settings | None = None) -> Engine:
    """Create a SQLAlchemy engine configured for the given settings."""
    settings = settings or get_settings()
    return create_engine_for_url(settings.sqlalchemy_database_url)


def create_engine_for_url(url: str) -> Engine:
    """Create a SQLAlchemy engine for an explicit database URL."""
    _ensure_sqlite_directory(url)
    engine = create_engine(
        url,
        connect_args=_sqlite_connect_args(url),
        pool_pre_ping=True,
        future=True,
    )
    if url.startswith("sqlite"):
        enable_sqlite_foreign_keys(engine)
    return engine


@lru_cache(maxsize=8)
def _engine_and_factory(url: str) -> tuple[Engine, sessionmaker[Session]]:
    """One engine + session factory per database URL, created on first use."""
    engine_for_url = create_engine_for_url(url)
    factory = sessionmaker(
        bind=engine_for_url,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=Session,
    )
    return engine_for_url, factory


def get_engine(settings: Settings | None = None) -> Engine:
    """Return the engine for the given (or default) settings."""
    settings = settings or get_settings()
    return _engine_and_factory(settings.sqlalchemy_database_url)[0]


def get_session_factory(settings: Settings | None = None) -> sessionmaker[Session]:
    """Return the session factory for the given (or default) settings."""
    settings = settings or get_settings()
    return _engine_and_factory(settings.sqlalchemy_database_url)[1]


engine: Engine = get_engine()
"""Engine for the default configuration (``DATABASE_URL``)."""

SessionLocal: sessionmaker[Session] = get_session_factory()
"""Session factory for the default configuration."""


def get_db(request: Request) -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped session.

    The session is bound to the settings stored on the application state, so an
    app created by :func:`app.main.create_app` with custom settings really does
    talk to the database those settings point at.
    """
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    db = get_session_factory(settings)()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope(settings: Settings | None = None) -> Iterator[Session]:
    """Context manager with commit/rollback handling for scripts and tasks."""
    db = get_session_factory(settings)()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
