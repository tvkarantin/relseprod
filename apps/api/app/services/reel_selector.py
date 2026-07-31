"""Selection policy for reels imported from an Apify candidate pool."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.models.enums import ReelImportMode

if TYPE_CHECKING:
    from app.services.reel_normalizer import NormalizedReel

DEFAULT_IMPORT_LIMIT = 5
_EARLIEST = datetime.min.replace(tzinfo=UTC)


def _published_at(reel: NormalizedReel) -> datetime:
    """Return a comparable UTC publication date, putting unknown dates last."""
    published_at = reel.published_at
    if published_at is None:
        return _EARLIEST
    if published_at.tzinfo is None:
        return published_at.replace(tzinfo=UTC)
    return published_at.astimezone(UTC)


def _is_duplicate(
    reel: NormalizedReel,
    seen_shortcodes: set[str],
    seen_instagram_ids: set[str],
) -> bool:
    return bool(
        (reel.shortcode and reel.shortcode in seen_shortcodes)
        or (reel.instagram_id and reel.instagram_id in seen_instagram_ids)
    )


def select_reels_for_import(
    reels: list[NormalizedReel],
    *,
    limit: int = DEFAULT_IMPORT_LIMIT,
    mode: ReelImportMode = ReelImportMode.POPULAR,
    excluded_shortcodes: set[str] | None = None,
    excluded_instagram_ids: set[str] | None = None,
) -> list[NormalizedReel]:
    """Choose unique popular reels, filling missing slots with the newest.

    Reels with a view count are ranked by views and then publication date.
    When fewer than ``limit`` reels have view metrics, the newest reels without
    metrics fill the remaining slots. Duplicate shortcodes or Instagram ids do
    not consume extra slots.
    """
    if limit <= 0:
        return []

    if mode is ReelImportMode.LATEST:
        prioritized = sorted(reels, key=_published_at, reverse=True)
    else:
        with_views = sorted(
            (reel for reel in reels if reel.views_count is not None),
            key=lambda reel: (reel.views_count or 0, _published_at(reel)),
            reverse=True,
        )
        without_views = sorted(
            (reel for reel in reels if reel.views_count is None),
            key=_published_at,
            reverse=True,
        )
        prioritized = [*with_views, *without_views]

    selected: list[NormalizedReel] = []
    seen_shortcodes = set(excluded_shortcodes or ())
    seen_instagram_ids = set(excluded_instagram_ids or ())

    for reel in prioritized:
        if _is_duplicate(reel, seen_shortcodes, seen_instagram_ids):
            continue

        selected.append(reel)
        if reel.shortcode:
            seen_shortcodes.add(reel.shortcode)
        if reel.instagram_id:
            seen_instagram_ids.add(reel.instagram_id)

        if len(selected) == limit:
            break

    return selected
