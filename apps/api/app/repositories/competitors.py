"""Competitor repository."""

from __future__ import annotations

from sqlalchemy import func, select

from app.models.competitor import Competitor
from app.repositories.base import BaseRepository


class CompetitorRepository(BaseRepository[Competitor]):
    """Database access for :class:`~app.models.competitor.Competitor`."""

    model = Competitor

    def get_by_username(self, instagram_username: str) -> Competitor | None:
        """Return a competitor by its normalized username, or ``None``."""
        stmt = select(Competitor).where(
            Competitor.instagram_username == instagram_username.strip().lower()
        )
        return self.db.scalars(stmt).one_or_none()

    def exists_by_username(self, instagram_username: str) -> bool:
        """Whether a competitor with this username is already tracked."""
        return self.get_by_username(instagram_username) is not None

    def count(self) -> int:
        """Total number of tracked competitors."""
        return self.db.scalar(select(func.count()).select_from(Competitor)) or 0
