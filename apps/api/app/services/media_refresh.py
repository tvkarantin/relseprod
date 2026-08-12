"""Refresh short-lived Instagram media URLs with Instaloader and Apify fallback."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.core.errors import ReelVideoUnavailableError
from app.services.apify import ApifyService
from app.services.apify_input import build_actor_input
from app.services.instaloader_service import InstaloaderService
from app.services.reel_importer import ReelImporter
from app.services.reel_normalizer import normalize_apify_reel

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.core.config import Settings
    from app.models.reel import Reel

logger = logging.getLogger(__name__)

MEDIA_REFRESH_ACTOR_ID = "apify/instagram-scraper"


def refresh_reel_media(session: Session, reel: Reel, settings: Settings) -> str:
    """Refresh one Reel and return its best URL for speech recognition."""
    if not reel.shortcode and not reel.original_url:
        raise ReelVideoUnavailableError(
            "Не удалось обновить видео: отсутствует идентификатор Reels",
            details={"reelId": reel.id},
        )

    item: dict[str, Any] | None = None

    if settings.instagram_primary_provider == "instaloader" and reel.shortcode:
        try:
            with InstaloaderService(settings) as primary:
                candidate = primary.fetch_reel(reel.shortcode)
            normalized_candidate = normalize_apify_reel(candidate)
            if normalized_candidate is not None and normalized_candidate.video_url:
                item = candidate
            else:
                logger.warning(
                    "Instaloader returned Reel %s without a usable video URL; trying Apify",
                    reel.shortcode,
                )
        except Exception as exc:
            logger.warning(
                "Instaloader media refresh failed for reel %s (%s); trying Apify",
                reel.id,
                type(exc).__name__,
            )

    if item is None:
        item = _refresh_reel_media_with_apify(reel, settings)

    normalized = normalize_apify_reel(item) if item else None
    if normalized is None or not normalized.video_url:
        raise ReelVideoUnavailableError(
            "Не удалось получить свежую ссылку на видео Reels",
            details={"reelId": reel.id},
        )

    ReelImporter().import_reels(session, reel.competitor, [normalized])
    session.commit()

    audio_url = item.get("audioUrl") if item else None
    if isinstance(audio_url, str) and audio_url.startswith("https://"):
        return audio_url
    return normalized.video_url


def _refresh_reel_media_with_apify(reel: Reel, settings: Settings) -> dict[str, Any] | None:
    """Use the existing paid Apify path when the free primary source is unavailable."""
    if not reel.original_url:
        raise ReelVideoUnavailableError(
            "Не удалось обновить видео через Apify: отсутствует ссылка на оригинальный Reels",
            details={"reelId": reel.id},
        )

    refresh_settings = settings.model_copy(
        update={"apify_actor_id": MEDIA_REFRESH_ACTOR_ID, "apify_results_limit": 1}
    )
    actor_input = build_actor_input(
        username=reel.competitor.instagram_username,
        profile_url=reel.original_url,
        results_limit=1,
        actor_id=MEDIA_REFRESH_ACTOR_ID,
        input_style="direct_urls",
    )

    with ApifyService(refresh_settings) as apify:
        run = apify.start_run(actor_input)
        if not run.is_successful:
            run = apify.wait_for_completion(run.id)
        items = apify.get_dataset_items(run.dataset_id, limit=1)

    return items[0] if items else None
