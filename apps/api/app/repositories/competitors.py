"""Competitor repository."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.models.competitor import Competitor
from app.models.reel import Reel
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from datetime import datetime

    from app.models.enums import CompetitorStatus


class CompetitorRepository(BaseRepository[Competitor]):
    """Database access for :class:`~app.models.competitor.Competitor`."""

    model = Competitor

    def list_all(self, *, limit: int = 100, offset: int = 0) -> list[Competitor]:
        """Return competitors, newest first."""
        stmt = (
            select(Competitor)
            .order_by(Competitor.created_at.desc(), Competitor.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def get_by_id(self, competitor_id: int) -> Competitor | None:
        """Return a competitor by primary key, or ``None``."""
        return self.get(competitor_id)

    def get_by_username(self, instagram_username: str) -> Competitor | None:
        """Return a competitor by its normalized username, or ``None``.

        The stored username is always lowercase, so the comparison is
        effectively case-insensitive.
        """
        stmt = select(Competitor).where(
            Competitor.instagram_username == instagram_username.strip().lower()
        )
        return self.db.scalars(stmt).one_or_none()

    def exists_by_username(self, instagram_username: str) -> bool:
        """Whether a competitor with this username is already tracked."""
        return self.get_by_username(instagram_username) is not None

    def create(self, instagram_username: str, profile_url: str) -> Competitor:
        """Insert a new competitor with default status and counters."""
        competitor = Competitor(
            instagram_username=instagram_username.strip().lower(),
            profile_url=profile_url,
        )
        return self.add(competitor)

    def count_reels(self, competitor_id: int) -> int:
        """Actual number of reels stored for a competitor."""
        stmt = select(func.count()).select_from(Reel).where(Reel.competitor_id == competitor_id)
        return self.db.scalar(stmt) or 0

    def update_status(
        self,
        competitor: Competitor,
        status: CompetitorStatus,
        *,
        last_parsed_at: datetime | None = None,
        reels_count: int | None = None,
    ) -> Competitor:
        """Update the status and, optionally, the parsing bookkeeping fields."""
        competitor.status = status
        if last_parsed_at is not None:
            competitor.last_parsed_at = last_parsed_at
        if reels_count is not None:
            competitor.reels_count = reels_count
        self.db.flush()
        return competitor

    def count(self) -> int:
        """Total number of tracked competitors."""
        return self.db.scalar(select(func.count()).select_from(Competitor)) or 0
