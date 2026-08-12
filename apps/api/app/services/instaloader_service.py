"""Instagram Reels metadata fetcher backed by the free Instaloader library."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import instaloader

from app.core.config import API_DIR, Settings, get_settings

logger = logging.getLogger(__name__)


class InstaloaderService:
    """Fetch public Reel metadata directly from Instagram through Instaloader."""

    def __init__(self, settings: Settings | None = None, *, loader: Any | None = None) -> None:
        self.settings = settings or get_settings()
        self._owns_loader = loader is None
        self.loader = loader or instaloader.Instaloader(
            sleep=True,
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            save_metadata=False,
            max_connection_attempts=self.settings.instaloader_max_connection_attempts,
            request_timeout=float(self.settings.instaloader_timeout_seconds),
            # Do not spend minutes retrying errors that should immediately use Apify fallback.
            fatal_status_codes=[401, 403, 429],
        )
        if self._owns_loader:
            self._load_session_if_configured()

    def _load_session_if_configured(self) -> None:
        username = self.settings.instaloader_session_username.strip()
        if not username:
            return

        raw_session_file = self.settings.instaloader_session_file.strip()
        session_file: str | None = None
        if raw_session_file:
            path = Path(raw_session_file)
            if not path.is_absolute():
                path = API_DIR / path
            session_file = str(path.resolve())

        try:
            self.loader.load_session_from_file(username, session_file)
        except FileNotFoundError:
            # Public profiles can still be fetched anonymously. A missing session
            # must not disable the free primary provider completely.
            logger.warning(
                "Instaloader session file is missing for %s; continuing anonymously",
                username,
            )
        else:
            logger.info("Loaded Instaloader session for %s", username)

    def fetch_profile_reels(self, username: str, *, limit: int) -> list[dict[str, object]]:
        """Fetch up to ``limit`` Reels from one Instagram profile."""
        profile = instaloader.Profile.from_username(self.loader.context, username)
        items: list[dict[str, object]] = []

        for post in profile.get_reels():
            items.append(self._post_to_item(post))
            if len(items) >= limit:
                break

        logger.info("Instaloader fetched %s reels for %s", len(items), username)
        return items

    def fetch_profile_summary(
        self,
        username: str,
        *,
        reels_limit: int = 20,
    ) -> dict[str, object]:
        """Fetch public profile totals plus a bounded sample of Reel views."""
        profile = instaloader.Profile.from_username(self.loader.context, username)
        view_counts: list[int] = []
        reels_checked = 0

        try:
            for post in profile.get_reels():
                reels_checked += 1
                views_count = post.video_play_count
                if views_count is None:
                    views_count = post.video_view_count
                if views_count is not None:
                    view_counts.append(int(views_count))
                if reels_checked >= reels_limit:
                    break
        except Exception:
            logger.warning(
                "Could not read Reel view sample for %s; profile totals are still available",
                username,
                exc_info=True,
            )

        return {
            "username": str(profile.username),
            "displayName": profile.full_name or profile.username,
            "avatarUrl": str(profile.profile_pic_url) if profile.profile_pic_url else None,
            "followers": int(profile.followers),
            "publications": int(profile.mediacount),
            "views": sum(view_counts) if view_counts else None,
            "viewsSampleSize": reels_checked,
        }

    def fetch_reel(self, shortcode: str) -> dict[str, object]:
        """Fetch fresh metadata for a single Reel by shortcode."""
        post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
        return self._post_to_item(post)

    @staticmethod
    def _post_to_item(post: Any) -> dict[str, object]:
        shortcode = str(post.shortcode)
        video_url = post.video_url if post.is_video else None
        views_count = post.video_play_count
        if views_count is None:
            views_count = post.video_view_count

        return {
            "id": str(post.mediaid),
            "shortCode": shortcode,
            "url": f"https://www.instagram.com/reel/{shortcode}/",
            "videoUrl": str(video_url) if video_url else None,
            "displayUrl": str(post.url) if post.url else None,
            "caption": post.caption,
            "videoPlayCount": views_count,
            "likesCount": post.likes,
            "commentsCount": post.comments,
            "timestamp": post.date_utc.isoformat(),
            "videoDuration": post.video_duration,
            "_provider": "instaloader",
        }

    def close(self) -> None:
        if self._owns_loader:
            self.loader.close()

    def __enter__(self) -> InstaloaderService:
        return self

    def __exit__(self, *_exc_info: object) -> None:
        self.close()
