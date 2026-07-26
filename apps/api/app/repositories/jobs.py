"""Parsing job repository."""

from __future__ import annotations

from sqlalchemy import func, select

from app.models.enums import ParsingJobStatus
from app.models.parsing_job import ParsingJob
from app.repositories.base import BaseRepository


class ParsingJobRepository(BaseRepository[ParsingJob]):
    """Database access for :class:`~app.models.parsing_job.ParsingJob`."""

    model = ParsingJob

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

    def count_for_competitor(self, competitor_id: int) -> int:
        """Number of jobs stored for a competitor."""
        stmt = (
            select(func.count())
            .select_from(ParsingJob)
            .where(ParsingJob.competitor_id == competitor_id)
        )
        return self.db.scalar(stmt) or 0
