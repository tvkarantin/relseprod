"""Tests for safe Instagram thumbnail retrieval."""

from __future__ import annotations

import httpx
import pytest

from app.services.reel_media import ReelThumbnailFetchError, fetch_reel_thumbnail


def test_fetch_reel_thumbnail_uses_instagram_headers() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["referer"] == "https://www.instagram.com/"
        assert "Mozilla" in request.headers["user-agent"]
        return httpx.Response(200, headers={"content-type": "image/jpeg"}, content=b"jpeg")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    payload = fetch_reel_thumbnail(
        "https://scontent-ams2-1.cdninstagram.com/example.jpg",
        client=client,
    )

    assert payload.content == b"jpeg"
    assert payload.media_type == "image/jpeg"


@pytest.mark.parametrize(
    "url",
    [
        "http://scontent-ams2-1.cdninstagram.com/example.jpg",
        "https://localhost/internal.jpg",
        "https://cdninstagram.com.attacker.example/example.jpg",
    ],
)
def test_fetch_reel_thumbnail_rejects_unsafe_urls(url: str) -> None:
    with pytest.raises(ReelThumbnailFetchError):
        fetch_reel_thumbnail(url)
