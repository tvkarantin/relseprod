"""Reel repository."""

from __future__ import annotations

from sqlalchemy import func, select

from app.models.reel import Reel
from app.repositories.base import BaseRepository

EXTERNAL_FIELD_NAMES: frozenset[str] = frozenset(
    {
        "instagram_id",
        "shortcode",
        "original_url",
        "video_url",
        "thumbnail_url",
        "caption",
        "views_count",
        "likes_count",
        "comments_count",
        "published_at",
        "duration",
        "raw_data",
    }
)
"""Fields owned by Instagram and safe to overwrite on re-import."""


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

    def create(self, reel: Reel) -> Reel:
        """Insert a new reel."""
        return self.add(reel)

    def update_external_fields(self, reel: Reel, values: dict[str, object]) -> Reel:
        """Update Instagram-owned fields only.

        User-authored content lives in ``reel_content`` and is never part of
        ``values``; unknown keys are ignored on purpose.
        """
        for name, value in values.items():
            if name in EXTERNAL_FIELD_NAMES and value is not None:
                setattr(reel, name, value)
        self.db.flush()
        return reel

    def count_by_competitor(self, competitor_id: int) -> int:
        """Alias of :meth:`count_for_competitor` used by the import pipeline."""
        return self.count_for_competitor(competitor_id)

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
