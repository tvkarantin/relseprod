"""Background execution of a parsing job.

The task opens its own SQLAlchemy session: a request-scoped session is closed as
soon as the HTTP response is sent and must never be handed to a background
worker.

Failures never propagate to the HTTP layer — they are recorded on the parsing
job by :class:`~app.services.parsing.ParsingService`.
"""

from __future__ import annotations

import logging

from app.core.config import Settings, get_settings
from app.database.session import get_session_factory
from app.services.parsing import ParsingService

logger = logging.getLogger(__name__)


def parse_competitor_job(job_id: int, settings: Settings | None = None) -> None:
    """Run the import pipeline for ``job_id``.

    Safe to pass directly to ``BackgroundTasks.add_task``: it takes only
    primitives, opens and closes its own session, and never raises.
    """
    active_settings = settings or get_settings()
    session = get_session_factory(active_settings)()

    try:
        with ParsingService(session, settings=active_settings) as service:
            service.run_job(job_id)
    except Exception:
        # Already persisted on the job; log without a traceback of secrets.
        logger.warning("Background parsing job %s finished with an error", job_id)
    finally:
        session.close()
