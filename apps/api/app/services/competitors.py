"""Business logic for tracked competitors."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.errors import (
    CompetitorAlreadyExistsError,
    CompetitorHasActiveJobError,
    CompetitorNotFoundError,
)
from app.repositories.competitors import CompetitorRepository
from app.repositories.jobs import ParsingJobRepository
from app.services.instagram import normalize_instagram_profile

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.competitor import Competitor

logger = logging.getLogger(__name__)


class CompetitorService:
    """Create, read and delete competitors."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.competitors = CompetitorRepository(session)
        self.jobs = ParsingJobRepository(session)

    def list_competitors(self) -> list[Competitor]:
        """All tracked competitors, newest first."""
        return self.competitors.list_all(limit=500)

    def get_competitor(self, competitor_id: int) -> Competitor:
        """Return a competitor or raise :class:`CompetitorNotFoundError`."""
        competitor = self.competitors.get_by_id(competitor_id)
        if competitor is None:
            raise CompetitorNotFoundError(details={"competitorId": competitor_id})
        return competitor

    def add_competitor(self, profile: str) -> Competitor:
        """Normalize ``profile`` and start tracking it.

        Raises:
            InvalidInstagramProfileError: if the profile cannot be parsed.
            CompetitorAlreadyExistsError: if the username is already tracked.
        """
        normalized = normalize_instagram_profile(profile)

        if self.competitors.exists_by_username(normalized.username):
            raise CompetitorAlreadyExistsError(
                "Этот Instagram-аккаунт уже добавлен",
                details={"instagramUsername": normalized.username},
            )

        competitor = self.competitors.create(
            instagram_username=normalized.username,
            profile_url=normalized.profile_url,
        )
        self.session.commit()
        self.session.refresh(competitor)
        logger.info(
            "Competitor created: id=%s username=%s", competitor.id, competitor.instagram_username
        )
        return competitor

    def delete_competitor(self, competitor_id: int) -> None:
        """Delete a competitor and everything attached to it.

        Reels, their content and parsing jobs are removed by the ON DELETE
        CASCADE constraints inside a single transaction.

        Raises:
            CompetitorNotFoundError: if the competitor does not exist.
            CompetitorHasActiveJobError: if an import is queued or running.
        """
        competitor = self.get_competitor(competitor_id)

        active_job = self.jobs.get_active_for_competitor(competitor.id)
        if active_job is not None:
            raise CompetitorHasActiveJobError(
                details={"competitorId": competitor.id, "jobId": active_job.id},
            )

        username = competitor.instagram_username
        self.competitors.delete(competitor)
        self.session.commit()
        logger.info("Competitor deleted: id=%s username=%s", competitor_id, username)
