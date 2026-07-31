"""Safe retrieval of short-lived Instagram reel thumbnails."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

_ALLOWED_HOST_SUFFIXES = (".cdninstagram.com", ".fbcdn.net")
_MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024
_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Referer": "https://www.instagram.com/",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


class ReelThumbnailFetchError(Exception):
    """The stored thumbnail cannot be exposed safely or fetched."""


@dataclass(frozen=True, slots=True)
class ReelThumbnailPayload:
    content: bytes
    media_type: str


def _is_allowed_instagram_media_url(url: str) -> bool:
    parsed = urlsplit(url)
    hostname = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(
        hostname.endswith(suffix) for suffix in _ALLOWED_HOST_SUFFIXES
    )


def fetch_reel_thumbnail(
    url: str,
    *,
    client: httpx.Client | None = None,
) -> ReelThumbnailPayload:
    """Fetch one Instagram thumbnail with browser-like headers.

    Both the stored URL and the final redirect target are restricted to known
    Instagram CDN domains so this proxy cannot be used for arbitrary requests.
    """
    if not _is_allowed_instagram_media_url(url):
        raise ReelThumbnailFetchError("Unsupported thumbnail host")

    owns_client = client is None
    active_client = client or httpx.Client(
        timeout=httpx.Timeout(12.0, connect=5.0),
        follow_redirects=True,
    )
    try:
        response = active_client.get(url, headers=_REQUEST_HEADERS)
    except httpx.HTTPError as exc:
        raise ReelThumbnailFetchError("Thumbnail request failed") from exc
    finally:
        if owns_client:
            active_client.close()

    if response.status_code != 200:
        raise ReelThumbnailFetchError(f"Thumbnail returned HTTP {response.status_code}")
    if not _is_allowed_instagram_media_url(str(response.url)):
        raise ReelThumbnailFetchError("Thumbnail redirected to an unsupported host")

    media_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if not media_type.startswith("image/"):
        raise ReelThumbnailFetchError("Thumbnail response is not an image")
    if len(response.content) > _MAX_THUMBNAIL_BYTES:
        raise ReelThumbnailFetchError("Thumbnail is too large")

    return ReelThumbnailPayload(content=response.content, media_type=media_type)
