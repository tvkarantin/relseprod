"""Reel repository."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from app.models.competitor import Competitor
from app.models.enums import ContentStatus
from app.models.reel import Reel
from app.models.reel_content import ReelContent
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy import Select

LIKE_ESCAPE = "\\"
"""Escape character used in LIKE patterns."""

USER_CONTENT_FIELDS: frozenset[str] = frozenset(
    {"hook", "script", "cta", "notes", "content_status"}
)
"""Fields of ``reel_content`` the user owns."""


def escape_like(term: str) -> str:
    """Escape LIKE wildcards so `%` and `_` are searched literally."""
    return (
        term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", f"{LIKE_ESCAPE}%")
        .replace("_", f"{LIKE_ESCAPE}_")
    )


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

    def identity_sets_for_competitor(self, competitor_id: int) -> tuple[set[str], set[str]]:
        """Return stored shortcodes and Instagram ids for duplicate filtering."""
        stmt = select(Reel.shortcode, Reel.instagram_id).where(Reel.competitor_id == competitor_id)
        shortcodes: set[str] = set()
        instagram_ids: set[str] = set()
        for shortcode, instagram_id in self.db.execute(stmt):
            if shortcode:
                shortcodes.add(shortcode)
            if instagram_id:
                instagram_ids.add(instagram_id)
        return shortcodes, instagram_ids

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

    # ------------------------------------------------------------- library

    def _library_query(
        self,
        *,
        competitor_id: int | None = None,
        search: str | None = None,
        content_statuses: Sequence[ContentStatus] | None = None,
    ) -> Select[tuple[Reel]]:
        """Base SELECT shared by the listing and counting queries."""
        stmt = select(Reel).join(Competitor, Reel.competitor_id == Competitor.id)

        if content_statuses is not None:
            stmt = stmt.join(ReelContent, ReelContent.reel_id == Reel.id).where(
                ReelContent.content_status.in_(list(content_statuses))
            )

        if competitor_id is not None:
            stmt = stmt.where(Reel.competitor_id == competitor_id)

        term = (search or "").strip()
        if term:
            if content_statuses is None:
                stmt = stmt.outerjoin(ReelContent, ReelContent.reel_id == Reel.id)
            pattern = f"%{escape_like(term.lower())}%"
            stmt = stmt.where(
                or_(
                    func.lower(Reel.caption).like(pattern, escape=LIKE_ESCAPE),
                    func.lower(Competitor.instagram_username).like(pattern, escape=LIKE_ESCAPE),
                    func.lower(ReelContent.hook).like(pattern, escape=LIKE_ESCAPE),
                    func.lower(ReelContent.script).like(pattern, escape=LIKE_ESCAPE),
                    func.lower(ReelContent.cta).like(pattern, escape=LIKE_ESCAPE),
                    func.lower(ReelContent.notes).like(pattern, escape=LIKE_ESCAPE),
                )
            )
        return stmt

    def list_paginated(
        self,
        *,
        competitor_id: int | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[Reel]:
        """Return one page of the library.

        Order is fixed: ``published_at DESC NULLS LAST``, then ``created_at
        DESC``, then ``id DESC``. SQLite has no ``NULLS LAST``, so the null
        check is expressed as an explicit sort key.
        """
        stmt = (
            self._library_query(competitor_id=competitor_id, search=search)
            .options(
                joinedload(Reel.competitor),
                joinedload(Reel.content),
                joinedload(Reel.transcription),
                joinedload(Reel.analysis),
            )
            .order_by(
                Reel.published_at.is_(None).asc(),
                Reel.published_at.desc(),
                Reel.created_at.desc(),
                Reel.id.desc(),
            )
            .limit(limit)
            .offset(max(0, (page - 1) * limit))
        )
        return list(self.db.scalars(stmt).unique())

    def count_filtered(self, *, competitor_id: int | None = None, search: str | None = None) -> int:
        """Count reels matching the same filters as :meth:`list_paginated`."""
        stmt = self._library_query(competitor_id=competitor_id, search=search)
        return self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    def search(self, term: str, *, limit: int = 20) -> list[Reel]:
        """Convenience wrapper around a search-only query."""
        return self.list_paginated(search=term, limit=limit)

    def get_details_by_id(self, reel_id: int) -> Reel | None:
        """Return a reel with its competitor and content eagerly loaded."""
        stmt = (
            select(Reel)
            .where(Reel.id == reel_id)
            .options(
                joinedload(Reel.competitor),
                joinedload(Reel.content),
                joinedload(Reel.transcription),
                joinedload(Reel.analysis),
            )
        )
        return self.db.scalars(stmt).unique().one_or_none()

    def get_or_create_content(self, reel: Reel) -> ReelContent:
        """Return the reel's content row, creating an empty one if missing.

        Older rows imported before ``reel_content`` existed are healed here.
        """
        if reel.content is not None:
            return reel.content
        content = ReelContent(reel_id=reel.id, content_status=ContentStatus.NEW)
        self.db.add(content)
        self.db.flush()
        self.db.refresh(reel)
        return content

    def update_content(self, content: ReelContent, values: dict[str, object]) -> ReelContent:
        """Update user-authored fields only."""
        for name, value in values.items():
            if name in USER_CONTENT_FIELDS:
                setattr(content, name, value)
        self.db.flush()
        return content

    def list_by_content_statuses(
        self,
        statuses: Sequence[ContentStatus],
        *,
        search: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[Reel]:
        """Return reels the user is working on, most recently edited first."""
        stmt = (
            self._library_query(search=search, content_statuses=statuses)
            .options(
                joinedload(Reel.competitor),
                joinedload(Reel.content),
                joinedload(Reel.transcription),
                joinedload(Reel.analysis),
            )
            .order_by(ReelContent.updated_at.desc(), Reel.id.desc())
            .limit(limit)
            .offset(max(0, (page - 1) * limit))
        )
        return list(self.db.scalars(stmt).unique())

    def count_by_content_statuses(
        self, statuses: Sequence[ContentStatus], *, search: str | None = None
    ) -> int:
        """Count reels matching :meth:`list_by_content_statuses`."""
        stmt = self._library_query(search=search, content_statuses=statuses)
        return self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    def count_all(self) -> int:
        """Total number of stored reels."""
        return self.db.scalar(select(func.count()).select_from(Reel)) or 0

    def count_by_status(self, status: ContentStatus) -> int:
        """Number of reels whose content is in ``status``."""
        stmt = (
            select(func.count())
            .select_from(ReelContent)
            .where(ReelContent.content_status == status)
        )
        return self.db.scalar(stmt) or 0
