"""Reel repository."""

from __future__ import annotations

from sqlalchemy import func, select

from app.models.reel import Reel
from app.repositories.base import BaseRepository


class ReelRepository(BaseRepository[Reel]):
    """Database access for :class:`~app.models.reel.Reel`."""

    model = Reel

    def get_by_shortcode(self, competitor_id: int, shortcode: str) -> Reel | None:
        """Return a reel by ``(competitor_id, shortcode)``, or ``None``."""
        stmt = select(Reel).where(
            Reel.competitor_id == competitor_id,
            Reel.shortcode == shortcode,
        )
        return self.db.scalars(stmt).one_or_none()

    def get_by_instagram_id(self, competitor_id: int, instagram_id: str) -> Reel | None:
        """Return a reel by ``(competitor_id, instagram_id)``, or ``None``."""
        stmt = select(Reel).where(
            Reel.competitor_id == competitor_id,
            Reel.instagram_id == instagram_id,
        )
        return self.db.scalars(stmt).first()

    def list_for_competitor(
        self, competitor_id: int, *, limit: int = 100, offset: int = 0
    ) -> list[Reel]:
        """Return reels of one competitor, newest published first."""
        stmt = (
            select(Reel)
            .where(Reel.competitor_id == competitor_id)
            .order_by(Reel.published_at.desc().nullslast(), Reel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def count_for_competitor(self, competitor_id: int) -> int:
        """Number of reels stored for a competitor."""
        stmt = select(func.count()).select_from(Reel).where(Reel.competitor_id == competitor_id)
        return self.db.scalar(stmt) or 0
