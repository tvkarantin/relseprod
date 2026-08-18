"""Shared FastAPI dependencies."""

from __future__ import annotations

import logging
import re

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import DatabaseError
from app.database.session import get_db

logger = logging.getLogger(__name__)

DbSession = get_db
"""Dependency callable yielding a request-scoped SQLAlchemy session."""


def _safe_db_error_message(exc: BaseException) -> str:
    """Return a useful database error summary without leaking credentials."""
    message = str(exc)
    message = re.sub(
        r"(postgres(?:ql)?(?:\+psycopg)?://)[^@\s]+@",
        r"\1***@",
        message,
        flags=re.IGNORECASE,
    )
    message = re.sub(
        r"(?i)(password\s*=\s*)[^\s]+",
        r"\1***",
        message,
    )
    return " ".join(message.split())[:1200]


def check_database(db: Session) -> None:
    """Verify the database connection with a trivial query.

    Raises:
        DatabaseError: if the query fails; the driver exception is logged but
            never exposed to the client.
    """
    try:
        db.execute(text("SELECT 1")).scalar_one()
    except SQLAlchemyError as exc:
        root = getattr(exc, "orig", None) or exc
        logger.error(
            "Database healthcheck failed: %s: %s",
            type(root).__name__,
            _safe_db_error_message(root),
        )
        logger.exception("Database healthcheck traceback")
        raise DatabaseError(
            "Не удалось подключиться к базе данных",
            details={"database": "disconnected"},
        ) from None
