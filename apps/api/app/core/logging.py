"""Logging configuration.

Uses the standard library ``logging`` with ``dictConfig`` so a JSON formatter can
be plugged in later without touching call sites. Secrets (Apify token, ``.env``
contents, auth headers) are never logged by this configuration.
"""

from __future__ import annotations

from logging.config import dictConfig
from typing import Any

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"

_configured = False


def build_logging_config(level: str = "INFO") -> dict[str, Any]:
    """Return a ``logging.config.dictConfig`` compatible dictionary."""
    normalized = level.strip().upper() or "INFO"
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": LOG_FORMAT,
                "datefmt": DATE_FORMAT,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "standard",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "app": {"handlers": ["console"], "level": normalized, "propagate": False},
            "uvicorn": {"handlers": ["console"], "level": normalized, "propagate": False},
            "uvicorn.error": {"handlers": ["console"], "level": normalized, "propagate": False},
            "uvicorn.access": {"handlers": ["console"], "level": normalized, "propagate": False},
            "alembic": {"handlers": ["console"], "level": normalized, "propagate": False},
        },
        "root": {"handlers": ["console"], "level": normalized},
    }


def configure_logging(level: str = "INFO", *, force: bool = False) -> None:
    """Configure logging once per process."""
    global _configured
    if _configured and not force:
        return
    dictConfig(build_logging_config(level))
    _configured = True
