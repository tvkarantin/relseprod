"""Idempotent import of normalized reels into the database."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from sqlalchemy.exc import SQLAlchemyError

from app.models.enums import ContentStatus
from app.models.reel import Reel
from app.models.reel_content import ReelContent
from app.repositories.reels import ReelRepository

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.competitor import Competitor
    from app.services.reel_normalizer import NormalizedReel

logger = logging.getLogger(__name__)

EXTERNAL_FIELDS: tuple[str, ...] = (
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
)
"""Fields owned by Instagram. User-authored content is never in this list."""


@dataclass(slots=True)
class ImportResult:
    """Outcome of one import run."""

    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    created_reel_ids: list[int] = field(default_factory=list)

    @property
    def total_processed(self) -> int:
        return self.created + self.updated


class ReelImporter:
    """Saves normalized reels without creating duplicates.

    User-authored content (``hook``, ``script``, ``cta``, ``notes`` and
    ``content_status``) is never touched on re-import — only the fields owned by
    Instagram are refreshed.
    """

    def import_reels(
        self,
        session: Session,
        competitor: Competitor,
        reels: list[NormalizedReel],
    ) -> ImportResult:
        """Import ``reels`` for ``competitor``.

        Each item is processed inside a savepoint, so one broken reel does not
        abort the whole import. Infrastructure failures propagate to the caller,
        which rolls the outer transaction back.
        """
        result = ImportResult()
        repository = ReelRepository(session)

        for reel in reels:
            try:
                with session.begin_nested():
                    created_reel = self._import_one(session, repository, competitor, reel)
                if created_reel is not None:
                    result.created += 1
                    result.created_reel_ids.append(created_reel.id)
                else:
                    result.updated += 1
            except SQLAlchemyError as exc:
                # `begin_nested()` already rolled the savepoint back, so the
                # outer transaction stays usable for the remaining reels.
                result.skipped += 1
                message = f"{reel.identity}: {type(exc).__name__}"
                result.errors.append(message)
                logger.warning("Failed to import reel %s: %s", reel.identity, type(exc).__name__)

        competitor.reels_count = repository.count_for_competitor(competitor.id)
        session.flush()

        logger.info(
            "Import finished for competitor %s: created=%s updated=%s skipped=%s",
            competitor.instagram_username,
            result.created,
            result.updated,
            result.skipped,
        )
        return result

    def _import_one(
        self,
        session: Session,
        repository: ReelRepository,
        competitor: Competitor,
        reel: NormalizedReel,
    ) -> Reel | None:
        """Create or update a single reel and return the newly created row."""
        existing = self._find_existing(repository, competitor.id, reel)

        if existing is None:
            return self._create(session, competitor, reel)

        self._update_external_fields(existing, reel)
        return None

    @staticmethod
    def _find_existing(
        repository: ReelRepository, competitor_id: int, reel: NormalizedReel
    ) -> Reel | None:
        """Look a reel up by shortcode first, then by Instagram id.

        Checking both keys prevents a duplicate when one import provided only a
        shortcode and the next one provides only an ``instagram_id``.
        """
        if reel.shortcode:
            found = repository.get_by_shortcode(competitor_id, reel.shortcode)
            if found is not None:
                return found
        if reel.instagram_id:
            return repository.get_by_instagram_id(competitor_id, reel.instagram_id)
        return None

    @staticmethod
    def _create(session: Session, competitor: Competitor, reel: NormalizedReel) -> Reel:
        """Insert a new reel together with its empty content row."""
        created = Reel(
            competitor_id=competitor.id,
            instagram_id=reel.instagram_id,
            shortcode=reel.shortcode,
            original_url=reel.original_url,
            video_url=reel.video_url,
            thumbnail_url=reel.thumbnail_url,
            caption=reel.caption,
            views_count=reel.views_count,
            likes_count=reel.likes_count,
            comments_count=reel.comments_count,
            published_at=reel.published_at,
            duration=reel.duration,
            raw_data=reel.raw_data,
        )
        session.add(created)
        session.flush()

        session.add(ReelContent(reel_id=created.id, content_status=ContentStatus.NEW))
        session.flush()
        return created

    @staticmethod
    def _update_external_fields(existing: Reel, reel: NormalizedReel) -> None:
        """Refresh Instagram-owned fields, preserving user content.

        A missing value in the new payload does not erase a previously stored
        one: only non-``None`` values overwrite existing data.
        """
        for name in EXTERNAL_FIELDS:
            new_value = getattr(reel, name)
            if new_value is not None:
                setattr(existing, name, new_value)
