"""Business logic for the reels library and the script editor."""

from __future__ import annotations

import logging
import math
from typing import TYPE_CHECKING

from app.core.errors import ReelNotFoundError
from app.models.enums import ContentStatus
from app.repositories.competitors import CompetitorRepository
from app.repositories.jobs import ParsingJobRepository
from app.repositories.reels import ReelRepository

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.reel import Reel
    from app.models.reel_content import ReelContent
    from app.schemas.reel_content import ReelContentWrite

logger = logging.getLogger(__name__)

WORKING_STATUSES: tuple[ContentStatus, ...] = (
    ContentStatus.IDEA,
    ContentStatus.SCRIPT,
    ContentStatus.READY,
    ContentStatus.PUBLISHED,
    ContentStatus.ARCHIVED,
)
"""Statuses that mean the user has started working on a reel."""


class ReelLibraryService:
    """Read access to the imported reels."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.reels = ReelRepository(session)

    def list_reels(
        self,
        *,
        competitor_id: int | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[Reel], int, int]:
        """Return ``(items, total, pages)`` for one page of the library.

        A page beyond the last one yields an empty list rather than an error.
        """
        total = self.reels.count_filtered(competitor_id=competitor_id, search=search)
        pages = math.ceil(total / limit) if total else 0
        items = self.reels.list_paginated(
            competitor_id=competitor_id, search=search, page=page, limit=limit
        )
        return items, total, pages

    def list_my_reels(
        self,
        *,
        content_status: ContentStatus | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[Reel], int, int]:
        """Return reels the user is working on (everything except ``new``)."""
        statuses = (content_status,) if content_status else WORKING_STATUSES
        total = self.reels.count_by_content_statuses(statuses, search=search)
        pages = math.ceil(total / limit) if total else 0
        items = self.reels.list_by_content_statuses(
            statuses, search=search, page=page, limit=limit
        )
        return items, total, pages

    def get_reel(self, reel_id: int) -> Reel:
        """Return one reel, healing a missing content row on the way.

        Reels imported before ``reel_content`` existed get an empty content row
        created here so the editor always has something to bind to.
        """
        reel = self.reels.get_details_by_id(reel_id)
        if reel is None:
            raise ReelNotFoundError(details={"reelId": reel_id})

        if reel.content is None:
            logger.info("Creating the missing content row for reel %s", reel_id)
            self.reels.get_or_create_content(reel)
            self.session.commit()
            reel = self.reels.get_details_by_id(reel_id)
            if reel is None:  # pragma: no cover - deleted concurrently
                raise ReelNotFoundError(details={"reelId": reel_id})
        return reel


class ReelContentService:
    """Saves the user-authored script of a reel."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.reels = ReelRepository(session)

    def save_content(self, reel_id: int, payload: ReelContentWrite) -> ReelContent:
        """Persist the editor payload.

        Only user-authored fields are written — data owned by Instagram is
        never touched here.
        """
        reel = self.reels.get_details_by_id(reel_id)
        if reel is None:
            raise ReelNotFoundError(details={"reelId": reel_id})

        content = self.reels.get_or_create_content(reel)
        self.reels.update_content(
            content,
            {
                "hook": payload.hook,
                "script": payload.script,
                "cta": payload.cta,
                "notes": payload.notes,
                "content_status": payload.content_status,
            },
        )
        self.session.commit()
        self.session.refresh(content)
        logger.info(
            "Reel content saved: reel_id=%s status=%s", reel_id, content.content_status
        )
        return content


class DashboardService:
    """Plain counters for the dashboard — no analytics, no trends."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.reels = ReelRepository(session)
        self.competitors = CompetitorRepository(session)
        self.jobs = ParsingJobRepository(session)

    def summary(self) -> dict[str, int]:
        """Return real ``COUNT`` values from SQLite."""
        return {
            "competitors_count": self.competitors.count(),
            "reels_count": self.reels.count_all(),
            "ideas_count": self.reels.count_by_status(ContentStatus.IDEA),
            "scripts_count": self.reels.count_by_status(ContentStatus.SCRIPT),
            "ready_count": self.reels.count_by_status(ContentStatus.READY),
            "active_jobs_count": self.jobs.count_active(),
        }
