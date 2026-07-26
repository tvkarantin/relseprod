"""Shared FastAPI dependencies."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import DatabaseError
from app.database.session import get_db

logger = logging.getLogger(__name__)

DbSession = get_db
"""Dependency callable yielding a request-scoped SQLAlchemy session."""


def check_database(db: Session) -> None:
    """Verify the database connection with a trivial query.

    Raises:
        DatabaseError: if the query fails; the driver exception is logged but
            never exposed to the client.
    """
    try:
        db.execute(text("SELECT 1")).scalar_one()
    except SQLAlchemyError:
        logger.exception("Database healthcheck failed")
        raise DatabaseError(
            "Не удалось подключиться к базе данных",
            details={"database": "disconnected"},
        ) from None
