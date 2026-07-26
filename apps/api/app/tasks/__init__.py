"""Background tasks.

The MVP runs tasks in-process via FastAPI ``BackgroundTasks`` — no Docker,
Redis, Celery or a separate worker. See ``README.md`` for the trade-offs.
"""

from app.tasks.parse_competitor import parse_competitor_job

__all__ = ["parse_competitor_job"]
