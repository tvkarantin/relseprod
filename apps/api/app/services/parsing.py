"""Orchestration of the reels import pipeline.

``ParsingService`` owns the long-running work: it starts the Apify Actor, polls
it, downloads the dataset, normalizes the items and hands them to the importer.
It is deliberately independent of HTTP so it can be called from a background
task and from tests without a client.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import Settings, get_settings
from app.core.errors import (
    ActiveJobAlreadyExistsError,
    ApifyError,
    AppError,
    CompetitorNotFoundError,
    InvalidJobStateError,
    JobNotFoundError,
)
from app.database.base import utcnow
from app.models.enums import CompetitorStatus, ParsingJobStatus, ReelImportMode
from app.repositories.competitors import CompetitorRepository
from app.repositories.jobs import ParsingJobRepository
from app.repositories.reels import ReelRepository
from app.services.apify import ApifyService
from app.services.apify_input import build_actor_input
from app.services.reel_importer import ImportResult, ReelImporter
from app.services.reel_normalizer import normalize_apify_items
from app.services.reel_selector import select_reels_for_import

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.competitor import Competitor
    from app.models.parsing_job import ParsingJob

logger = logging.getLogger(__name__)


class Progress:
    """Real progress checkpoints — no artificial smoothing."""

    CREATED = 0
    TASK_STARTED = 10
    ACTOR_STARTING = 20
    ACTOR_STARTED = 30
    ACTOR_WAITING = 50
    DATASET_FETCHED = 70
    IMPORTING = 85
    DONE = 100


GENERIC_FAILURE_MESSAGE = "Не удалось импортировать рилсы. Попробуйте повторить задачу"


class ParsingService:
    """Creates parsing jobs and executes them."""

    def __init__(
        self,
        session: Session,
        *,
        settings: Settings | None = None,
        apify: ApifyService | None = None,
        importer: ReelImporter | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.competitors = CompetitorRepository(session)
        self.jobs = ParsingJobRepository(session)
        self.apify = apify or ApifyService(self.settings)
        self.importer = importer or ReelImporter()

    # ------------------------------------------------------------ scheduling

    def create_job(
        self,
        competitor_id: int,
        *,
        import_mode: ReelImportMode = ReelImportMode.POPULAR,
    ) -> ParsingJob:
        """Queue an import for a competitor.

        Raises:
            CompetitorNotFoundError: if the competitor does not exist.
            ActiveJobAlreadyExistsError: if an import is already in flight.
        """
        competitor = self.competitors.get_by_id(competitor_id)
        if competitor is None:
            raise CompetitorNotFoundError(details={"competitorId": competitor_id})

        active = self.jobs.get_active_for_competitor(competitor.id)
        if active is not None:
            raise ActiveJobAlreadyExistsError(
                details={"competitorId": competitor.id, "jobId": active.id},
            )

        job = self.jobs.create(competitor.id, import_mode=import_mode)
        self.competitors.update_status(competitor, CompetitorStatus.QUEUED)
        self.session.commit()
        self.session.refresh(job)
        logger.info(
            "Parsing job created: job_id=%s competitor_id=%s username=%s",
            job.id,
            competitor.id,
            competitor.instagram_username,
        )
        return job

    def create_retry_job(self, job_id: int) -> ParsingJob:
        """Queue a new job replaying a failed one.

        The failed job itself is never modified.

        Raises:
            JobNotFoundError: if the job does not exist.
            InvalidJobStateError: if the job is not in the ``failed`` state.
            ActiveJobAlreadyExistsError: if the competitor already has an
                active job.
        """
        failed_job = self.jobs.get_by_id(job_id)
        if failed_job is None:
            raise JobNotFoundError(details={"jobId": job_id})

        if failed_job.status is not ParsingJobStatus.FAILED:
            raise InvalidJobStateError(
                "Повторить можно только задачу со статусом failed",
                details={"jobId": job_id, "status": str(failed_job.status)},
            )

        active = self.jobs.get_active_for_competitor(failed_job.competitor_id)
        if active is not None:
            raise ActiveJobAlreadyExistsError(
                details={"competitorId": failed_job.competitor_id, "jobId": active.id},
            )

        competitor = self.competitors.get_by_id(failed_job.competitor_id)
        if competitor is None:  # pragma: no cover - guarded by FK cascade
            raise CompetitorNotFoundError(details={"competitorId": failed_job.competitor_id})

        retry = self.jobs.create_retry(failed_job)
        self.competitors.update_status(competitor, CompetitorStatus.QUEUED)
        self.session.commit()
        self.session.refresh(retry)
        logger.info("Retry job created: job_id=%s from failed job_id=%s", retry.id, job_id)
        return retry

    def get_job(self, job_id: int) -> ParsingJob:
        """Return a job or raise :class:`JobNotFoundError`."""
        job = self.jobs.get_by_id(job_id)
        if job is None:
            raise JobNotFoundError(details={"jobId": job_id})
        return job

    # ------------------------------------------------------------- execution

    def run_job(self, job_id: int) -> ImportResult:
        """Execute a queued job end to end.

        Every failure is recorded on the job and re-raised as an
        :class:`AppError`; the caller (the background task) swallows it so
        nothing escapes into the HTTP layer.
        """
        job = self.jobs.get_by_id(job_id)
        if job is None:
            raise JobNotFoundError(details={"jobId": job_id})

        competitor = self.competitors.get_by_id(job.competitor_id)
        if competitor is None:  # pragma: no cover - guarded by FK cascade
            raise CompetitorNotFoundError(details={"competitorId": job.competitor_id})

        logger.info(
            "Background import started: job_id=%s username=%s",
            job.id,
            competitor.instagram_username,
        )

        self.jobs.update_status(
            job,
            ParsingJobStatus.RUNNING,
            progress=Progress.TASK_STARTED,
            started_at=utcnow(),
        )
        self.competitors.update_status(competitor, CompetitorStatus.PARSING)
        self.session.commit()

        try:
            items = self._fetch_items(job, competitor)
            result = self._store_items(job, competitor, items)
        except AppError as exc:
            self._fail(job, competitor, exc)
            raise
        except Exception as exc:
            logger.exception("Unexpected failure in job %s", job.id)
            self._fail(job, competitor, exc)
            raise

        return result

    def _fetch_items(self, job: ParsingJob, competitor: Competitor) -> list[dict[str, object]]:
        """Run the Actor and download its dataset."""
        self.apify.ensure_configured()

        actor_input = build_actor_input(
            username=competitor.instagram_username,
            profile_url=competitor.profile_url,
            results_limit=self.settings.apify_results_limit,
            actor_id=self.settings.apify_actor_id,
            input_style=self.settings.apify_actor_input_style,
        )

        self.jobs.set_progress(job, Progress.ACTOR_STARTING)
        self.session.commit()

        run = self.apify.start_run(actor_input)
        self.jobs.update_status(
            job,
            ParsingJobStatus.RUNNING,
            progress=Progress.ACTOR_STARTED,
            apify_run_id=run.id,
        )
        self.session.commit()
        logger.info("Apify run %s registered for job %s", run.id, job.id)

        if not run.is_successful:
            self.jobs.set_progress(job, Progress.ACTOR_WAITING)
            self.session.commit()
            run = self.apify.wait_for_completion(run.id)

        items = self.apify.get_dataset_items(
            run.dataset_id, limit=self.settings.apify_results_limit
        )
        self.jobs.set_progress(job, Progress.DATASET_FETCHED)
        self.session.commit()
        logger.info("Dataset fetched for job %s: %s items", job.id, len(items))
        return items

    def _store_items(
        self, job: ParsingJob, competitor: Competitor, items: list[dict[str, object]]
    ) -> ImportResult:
        """Normalize and persist dataset items, then finish the job."""
        self.jobs.set_progress(job, Progress.IMPORTING)
        self.session.commit()

        normalized, skipped = normalize_apify_items(items)
        if skipped:
            logger.info("Job %s: normalizer skipped %s items", job.id, skipped)

        existing_shortcodes, existing_instagram_ids = ReelRepository(
            self.session
        ).identity_sets_for_competitor(competitor.id)
        selected = select_reels_for_import(
            normalized,
            mode=job.import_mode,
            excluded_shortcodes=existing_shortcodes,
            excluded_instagram_ids=existing_instagram_ids,
        )
        logger.info(
            "Job %s: selected %s reels for import from %s normalized candidates",
            job.id,
            len(selected),
            len(normalized),
        )

        result = self.importer.import_reels(self.session, competitor, selected)
        result.skipped += skipped

        now = utcnow()
        self.jobs.update_status(
            job,
            ParsingJobStatus.COMPLETED,
            progress=Progress.DONE,
            reels_created=result.created,
            reels_updated=result.updated,
            completed_at=now,
        )
        self.competitors.update_status(
            competitor,
            CompetitorStatus.READY,
            last_parsed_at=now,
            reels_count=self.competitors.count_reels(competitor.id),
        )
        self.session.commit()

        logger.info(
            "Job %s completed: created=%s updated=%s skipped=%s reels_count=%s",
            job.id,
            result.created,
            result.updated,
            result.skipped,
            competitor.reels_count,
        )
        return result

    def _fail(self, job: ParsingJob, competitor: Competitor, exc: Exception) -> None:
        """Persist a failure in its own transaction.

        Only safe text reaches the database: Apify errors carry a curated
        message, anything else becomes a generic one.
        """
        message = exc.message if isinstance(exc, ApifyError | AppError) else GENERIC_FAILURE_MESSAGE

        self.session.rollback()
        try:
            fresh_job = self.jobs.get_by_id(job.id)
            fresh_competitor = self.competitors.get_by_id(competitor.id)
            if fresh_job is not None:
                self.jobs.update_status(
                    fresh_job,
                    ParsingJobStatus.FAILED,
                    error_message=message,
                    completed_at=utcnow(),
                )
            if fresh_competitor is not None:
                self.competitors.update_status(fresh_competitor, CompetitorStatus.ERROR)
            self.session.commit()
        except Exception:  # pragma: no cover - database is already broken
            logger.exception("Could not record the failure of job %s", job.id)
            self.session.rollback()

        logger.warning("Job %s failed: %s", job.id, message)
