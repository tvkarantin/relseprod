"""Normalization of raw Apify dataset items into :class:`NormalizedReel`.

Actors differ in field naming, so every supported spelling is listed here. After
normalization the raw ``dict`` is not used by the business logic any more (it is
only carried along in ``raw_data`` for debugging).
"""

from __future__ import annotations

import copy
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

INSTAGRAM_ID_KEYS: tuple[str, ...] = ("id", "instagramId", "postId", "pk", "reelId")
SHORTCODE_KEYS: tuple[str, ...] = ("shortCode", "shortcode", "code")
ORIGINAL_URL_KEYS: tuple[str, ...] = ("url", "postUrl", "reelUrl", "inputUrl", "reelURL")
VIDEO_URL_KEYS: tuple[str, ...] = ("videoUrl", "video_url", "videoPlayUrl")
THUMBNAIL_URL_KEYS: tuple[str, ...] = ("displayUrl", "thumbnailUrl", "imageUrl", "coverUrl")
CAPTION_KEYS: tuple[str, ...] = ("caption", "text", "description")
VIEWS_KEYS: tuple[str, ...] = ("videoViewCount", "viewsCount", "playCount", "videoPlayCount")
LIKES_KEYS: tuple[str, ...] = ("likesCount", "likeCount")
COMMENTS_KEYS: tuple[str, ...] = ("commentsCount", "commentCount")
PUBLISHED_AT_KEYS: tuple[str, ...] = ("timestamp", "publishedAt", "takenAt", "createdAt")
DURATION_KEYS: tuple[str, ...] = ("videoDuration", "duration")

REEL_URL_TEMPLATE = "https://www.instagram.com/reel/{shortcode}/"

_ALLOWED_URL_SCHEMES = ("http://", "https://")

# Unix timestamps larger than this are assumed to be milliseconds.
# 10_000_000_000 s ≈ year 2286, while 10^10 ms ≈ 1970 — the split is unambiguous
# for any realistic Instagram publication date.
_MILLISECONDS_THRESHOLD = 10_000_000_000


@dataclass(slots=True)
class NormalizedReel:
    """A reel in the shape the importer understands."""

    instagram_id: str | None = None
    shortcode: str | None = None
    original_url: str | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    caption: str | None = None
    views_count: int | None = None
    likes_count: int | None = None
    comments_count: int | None = None
    published_at: datetime | None = None
    duration: float | None = None
    raw_data: dict[str, Any] = field(default_factory=dict)

    @property
    def identity(self) -> str:
        """Human-readable identity used in logs (never the whole payload)."""
        return self.shortcode or self.instagram_id or "unknown"


def _first_value(raw: dict[str, Any], keys: tuple[str, ...]) -> Any:
    """Return the first non-empty value among ``keys``."""
    for key in keys:
        if key not in raw:
            continue
        value = raw[key]
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _clean_str(value: Any, *, max_length: int | None = None) -> str | None:
    """Coerce a scalar into a trimmed string, or ``None``."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        text = str(value)
    elif isinstance(value, str):
        text = value.strip()
    else:
        return None
    if not text:
        return None
    if max_length is not None and len(text) > max_length:
        return text[:max_length]
    return text


def _clean_url(value: Any, *, max_length: int = 2000) -> str | None:
    """Return ``value`` if it looks like an absolute http(s) URL."""
    text = _clean_str(value)
    if text is None:
        return None
    if not text.lower().startswith(_ALLOWED_URL_SCHEMES):
        return None
    if len(text) > max_length:
        return None
    return text


def _clean_int(value: Any) -> int | None:
    """Parse an integer metric, tolerating numeric strings.

    Unknown or unparsable values become ``None`` — never ``0``.
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value == value and value not in (float("inf"), float("-inf")) else None
    if isinstance(value, str):
        text = value.strip().replace(" ", "").replace(",", "")
        if not text:
            return None
        try:
            return int(text)
        except ValueError:
            try:
                parsed = float(text)
            except ValueError:
                return None
            return int(parsed)
    return None


def _clean_float(value: Any) -> float | None:
    """Parse a float metric, tolerating numeric strings."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        parsed = float(value)
    elif isinstance(value, str):
        text = value.strip().replace(",", ".")
        if not text:
            return None
        try:
            parsed = float(text)
        except ValueError:
            return None
    else:
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):  # NaN / inf
        return None
    return parsed


def _parse_datetime(value: Any) -> datetime | None:
    """Parse ISO 8601 strings and Unix timestamps (seconds or milliseconds)."""
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, int | float):
        return _from_unix(float(value))

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        # Numeric string → Unix timestamp.
        try:
            return _from_unix(float(text))
        except ValueError:
            pass
        iso_text = text.replace("Z", "+00:00") if text.endswith("Z") else text
        try:
            parsed = datetime.fromisoformat(iso_text)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)

    return None


def _from_unix(number: float) -> datetime | None:
    """Build a UTC datetime from a Unix timestamp in seconds or milliseconds."""
    if number <= 0:
        return None
    seconds = number / 1000 if number >= _MILLISECONDS_THRESHOLD else number
    try:
        return datetime.fromtimestamp(seconds, tz=UTC)
    except (OverflowError, OSError, ValueError):
        return None


def normalize_apify_reel(raw: dict[str, Any]) -> NormalizedReel | None:
    """Convert one raw Apify item into a :class:`NormalizedReel`.

    Returns ``None`` when the item carries neither ``instagram_id`` nor
    ``shortcode``, because such an item cannot be deduplicated.

    The input dictionary is never mutated.
    """
    if not isinstance(raw, dict):
        logger.warning("Skipping Apify item: expected an object, got %s", type(raw).__name__)
        return None

    instagram_id = _clean_str(_first_value(raw, INSTAGRAM_ID_KEYS), max_length=64)
    shortcode = _clean_str(_first_value(raw, SHORTCODE_KEYS), max_length=64)

    original_url = _clean_url(_first_value(raw, ORIGINAL_URL_KEYS), max_length=1000)

    if shortcode is None and original_url:
        shortcode = _shortcode_from_url(original_url)

    if instagram_id is None and shortcode is None:
        # Log the identity only — the payload may contain personal data.
        logger.warning("Skipping Apify item without instagram_id and shortcode")
        return None

    if original_url is None and shortcode:
        original_url = REEL_URL_TEMPLATE.format(shortcode=shortcode)

    return NormalizedReel(
        instagram_id=instagram_id,
        shortcode=shortcode,
        original_url=original_url,
        video_url=_clean_url(_first_value(raw, VIDEO_URL_KEYS)),
        thumbnail_url=_clean_url(_first_value(raw, THUMBNAIL_URL_KEYS)),
        caption=_clean_str(_first_value(raw, CAPTION_KEYS)),
        views_count=_clean_int(_first_value(raw, VIEWS_KEYS)),
        likes_count=_clean_int(_first_value(raw, LIKES_KEYS)),
        comments_count=_clean_int(_first_value(raw, COMMENTS_KEYS)),
        published_at=_parse_datetime(_first_value(raw, PUBLISHED_AT_KEYS)),
        duration=_clean_float(_first_value(raw, DURATION_KEYS)),
        raw_data=copy.deepcopy(raw),
    )


def _shortcode_from_url(url: str) -> str | None:
    """Extract the shortcode from a ``/reel/<code>/`` or ``/p/<code>/`` URL."""
    for marker in ("/reel/", "/reels/", "/p/", "/tv/"):
        if marker in url:
            tail = url.split(marker, 1)[1]
            candidate = tail.split("/", 1)[0].split("?", 1)[0].strip()
            if candidate:
                return candidate[:64]
    return None


def normalize_apify_items(items: list[dict[str, Any]]) -> tuple[list[NormalizedReel], int]:
    """Normalize a dataset payload.

    Returns:
        A tuple of ``(normalized reels, number of skipped items)``.
    """
    normalized: list[NormalizedReel] = []
    skipped = 0
    for item in items:
        reel = normalize_apify_reel(item)
        if reel is None:
            skipped += 1
            continue
        normalized.append(reel)
    if skipped:
        logger.info("Normalizer skipped %s of %s Apify items", skipped, len(items))
    return normalized, skipped
