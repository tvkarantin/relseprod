"""Background execution of a parsing job.

The task opens its own SQLAlchemy session: a request-scoped session is closed as
soon as the HTTP response is sent and must never be handed to a background
worker.

Failures never propagate to the HTTP layer — they are recorded on the parsing
job by :class:`~app.services.parsing.ParsingService`.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

from app.core.config import Settings, get_settings
from app.database.session import get_session_factory
from app.services.apify import ApifyService
from app.services.parsing import ParsingService
from app.tasks.prepare_reel import prepare_reel_task

logger = logging.getLogger(__name__)


def _prepare_imported_reel(reel_id: int, settings: Settings) -> None:
    """Prepare one newly imported reel without failing the parent import job."""
    try:
        prepare_reel_task(reel_id, settings, creator_profile=None, apply_to_content=True)
    except Exception:
        logger.exception("Automatic reel preparation failed: reel_id=%s", reel_id)


def parse_competitor_job(job_id: int, settings: Settings | None = None) -> None:
    """Run import and immediately prepare every newly created reel.

    Safe to pass directly to ``BackgroundTasks.add_task``: it takes only
    primitives, opens and closes its own session, and never raises. New reels
    are transcribed and analyzed automatically; successful analysis populates
    hook/script/CTA and moves the reel into the working content list.
    """
    active_settings = settings or get_settings()
    session = get_session_factory(active_settings)()
    apify = ApifyService(active_settings)

    try:
        service = ParsingService(session, settings=active_settings, apify=apify)
        result = service.run_job(job_id)

        if result.created_reel_ids:
            worker_count = min(3, len(result.created_reel_ids))
            with ThreadPoolExecutor(
                max_workers=worker_count,
                thread_name_prefix="reel-prepare",
            ) as executor:
                futures = [
                    executor.submit(_prepare_imported_reel, reel_id, active_settings)
                    for reel_id in result.created_reel_ids
                ]
                for future in futures:
                    future.result()
    except Exception:
        # Import failures are already persisted on the job; log without secrets.
        logger.warning("Background parsing job %s finished with an error", job_id)
    finally:
        apify.close()
        session.close()
