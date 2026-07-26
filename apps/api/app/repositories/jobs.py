"""Parsing job repository."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.database.base import utcnow
from app.models.enums import ParsingJobStatus
from app.models.parsing_job import ParsingJob
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from datetime import datetime


class ParsingJobRepository(BaseRepository[ParsingJob]):
    """Database access for :class:`~app.models.parsing_job.ParsingJob`."""

    model = ParsingJob

    def get_by_id(self, job_id: int) -> ParsingJob | None:
        """Return a job by primary key, or ``None``."""
        return self.get(job_id)

    def create(self, competitor_id: int) -> ParsingJob:
        """Insert a new queued job for a competitor."""
        return self.add(ParsingJob(competitor_id=competitor_id))

    def create_retry(self, failed_job: ParsingJob) -> ParsingJob:
        """Create a fresh job replaying a failed one.

        The original job is left untouched so the failure stays auditable.
        """
        return self.create(failed_job.competitor_id)

    def update_status(
        self,
        job: ParsingJob,
        status: ParsingJobStatus,
        *,
        progress: int | None = None,
        apify_run_id: str | None = None,
        reels_created: int | None = None,
        reels_updated: int | None = None,
        error_message: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> ParsingJob:
        """Update a job's state; only the provided fields are written."""
        job.status = status
        if progress is not None:
            job.progress = progress
        if apify_run_id is not None:
            job.apify_run_id = apify_run_id
        if reels_created is not None:
            job.reels_created = reels_created
        if reels_updated is not None:
            job.reels_updated = reels_updated
        if error_message is not None:
            job.error_message = error_message
        if started_at is not None:
            job.started_at = started_at
        if completed_at is not None:
            job.completed_at = completed_at

        if status is ParsingJobStatus.RUNNING and job.started_at is None:
            job.started_at = utcnow()
        if status in (ParsingJobStatus.COMPLETED, ParsingJobStatus.FAILED):
            job.completed_at = job.completed_at or utcnow()
        if status is ParsingJobStatus.COMPLETED:
            job.error_message = None

        self.db.flush()
        return job

    def set_progress(self, job: ParsingJob, progress: int) -> ParsingJob:
        """Record a real progress checkpoint."""
        job.progress = progress
        self.db.flush()
        return job

    def get_active_for_competitor(self, competitor_id: int) -> ParsingJob | None:
        """Return the queued/running job of a competitor, or ``None``."""
        stmt = (
            select(ParsingJob)
            .where(
                ParsingJob.competitor_id == competitor_id,
                ParsingJob.status.in_(ParsingJobStatus.active_statuses()),
            )
            .order_by(ParsingJob.created_at.desc(), ParsingJob.id.desc())
        )
        return self.db.scalars(stmt).first()

    def get_by_apify_run_id(self, apify_run_id: str) -> ParsingJob | None:
        """Return a job by its Apify run id, or ``None``."""
        stmt = select(ParsingJob).where(ParsingJob.apify_run_id == apify_run_id)
        return self.db.scalars(stmt).first()

    def list_for_competitor(
        self, competitor_id: int, *, limit: int = 50, offset: int = 0
    ) -> list[ParsingJob]:
        """Return jobs of one competitor, newest first."""
        stmt = (
            select(ParsingJob)
            .where(ParsingJob.competitor_id == competitor_id)
            .order_by(ParsingJob.created_at.desc(), ParsingJob.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def count_active(self) -> int:
        """Number of queued or running jobs across all competitors."""
        stmt = (
            select(func.count())
            .select_from(ParsingJob)
            .where(ParsingJob.status.in_(ParsingJobStatus.active_statuses()))
        )
        return self.db.scalar(stmt) or 0

    def count_for_competitor(self, competitor_id: int) -> int:
        """Number of jobs stored for a competitor."""
        stmt = (
            select(func.count())
            .select_from(ParsingJob)
            .where(ParsingJob.competitor_id == competitor_id)
        )
        return self.db.scalar(stmt) or 0
