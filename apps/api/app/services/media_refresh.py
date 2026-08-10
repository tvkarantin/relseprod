"""Refresh short-lived Instagram media URLs through Apify."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.core.errors import ReelVideoUnavailableError
from app.services.apify import ApifyService
from app.services.apify_input import build_actor_input
from app.services.reel_importer import ReelImporter
from app.services.reel_normalizer import normalize_apify_reel

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.core.config import Settings
    from app.models.reel import Reel

MEDIA_REFRESH_ACTOR_ID = "apify/instagram-scraper"


def refresh_reel_media(session: Session, reel: Reel, settings: Settings) -> str:
    """Refresh one Reel and return its best URL for speech recognition."""
    if not reel.original_url:
        raise ReelVideoUnavailableError(
            "Не удалось обновить видео: отсутствует ссылка на оригинальный Reels",
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

    item: dict[str, Any] | None = items[0] if items else None
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
