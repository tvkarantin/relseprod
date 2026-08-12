"""Instagram Reels fetcher that runs outside Vercel's rate-limited egress."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import httpx
from sqlalchemy import text

from app.core.config import Settings, get_settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_SECRET_QUERY = text(
    "select value from internal_service_secrets "
    "where key = 'instagram_edge_token' limit 1"
)


class InstagramEdgeService:
    """Fetch public Instagram data through the project's Supabase Edge Function."""

    def __init__(
        self,
        session: Session,
        settings: Settings | None = None,
        *,
        client: httpx.Client | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self._owns_client = client is None
        self.client = client or httpx.Client(timeout=self.settings.instagram_edge_timeout_seconds)

    def close(self) -> None:
        if self._owns_client:
            self.client.close()

    def __enter__(self) -> InstagramEdgeService:
        return self

    def __exit__(self, *_exc_info: object) -> None:
        self.close()

    def is_configured(self) -> bool:
        """Return whether both the endpoint and its database-backed token exist."""
        if not self.settings.instagram_edge_url.strip():
            return False
        token = self.session.execute(_SECRET_QUERY).scalar_one_or_none()
        return isinstance(token, str) and bool(token.strip())

    def _post(self, username: str, *, limit: int, mode: str) -> dict[str, Any]:
        endpoint = self.settings.instagram_edge_url.strip()
        if not endpoint:
            raise RuntimeError("Instagram Edge endpoint is not configured")

        token = self.session.execute(_SECRET_QUERY).scalar_one_or_none()
        if not isinstance(token, str) or not token.strip():
            raise RuntimeError("Instagram Edge token is not configured")

        response = self.client.post(
            endpoint,
            headers={"x-internal-token": token.strip()},
            json={"username": username, "limit": limit, "mode": mode},
        )

        try:
            payload: Any = response.json()
        except ValueError as exc:
            raise RuntimeError(
                f"Instagram Edge returned invalid JSON (HTTP {response.status_code})"
            ) from exc

        if response.status_code >= 400 or not isinstance(payload, dict):
            diagnostics = payload.get("diagnostics") if isinstance(payload, dict) else None
            logger.warning(
                "Instagram Edge failed for %s: http=%s diagnostics=%s",
                username,
                response.status_code,
                diagnostics,
            )
            raise RuntimeError(f"Instagram Edge request failed with HTTP {response.status_code}")

        return payload

    def fetch_profile_reels(self, username: str, *, limit: int) -> list[dict[str, object]]:
        """Fetch normalized-to-Apify-shaped Reel metadata for one public profile."""
        payload = self._post(username, limit=limit, mode="reels")
        items = payload.get("items")
        if not isinstance(items, list):
            raise RuntimeError("Instagram Edge response does not contain an items list")
        return [item for item in items if isinstance(item, dict)]

    def fetch_profile_summary(self, username: str, *, reels_limit: int = 20) -> dict[str, Any]:
        """Fetch public profile totals plus a bounded recent-Reels view sample."""
        payload = self._post(username, limit=reels_limit, mode="summary")
        profile = payload.get("profile")
        items = payload.get("items")
        if not isinstance(profile, dict):
            raise RuntimeError("Instagram Edge response does not contain profile data")
        if not isinstance(items, list):
            items = []

        views = 0
        sample_size = 0
        for item in items[:reels_limit]:
            if not isinstance(item, dict):
                continue
            value = item.get("videoPlayCount")
            if isinstance(value, (int, float)) and value >= 0:
                views += int(value)
                sample_size += 1

        return {
            "username": str(profile.get("username") or username),
            "displayName": str(profile.get("displayName") or profile.get("username") or username),
            "avatarUrl": profile.get("avatarUrl"),
            "followers": profile.get("followers"),
            "publications": profile.get("publications"),
            "views": views,
            "viewsSampleSize": sample_size,
        }
