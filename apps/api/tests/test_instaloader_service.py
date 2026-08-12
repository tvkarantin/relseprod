"""Unit tests for the free Instaloader Instagram source."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from app.core.config import Settings
from app.services import instaloader_service as service_module
from app.services.instaloader_service import InstaloaderService


class FakeLoader:
    def __init__(self) -> None:
        self.context = object()


def make_post(shortcode: str, *, play_count: int | None = 123) -> SimpleNamespace:
    return SimpleNamespace(
        shortcode=shortcode,
        mediaid=123456,
        is_video=True,
        video_url=f"https://cdn.example.com/{shortcode}.mp4",
        url=f"https://cdn.example.com/{shortcode}.jpg",
        caption=f"Caption {shortcode}",
        video_play_count=play_count,
        video_view_count=99,
        likes=25,
        comments=4,
        date_utc=datetime(2026, 8, 12, 8, 30, tzinfo=UTC),
        video_duration=18.5,
    )


def make_settings(**overrides: Any) -> Settings:
    defaults: dict[str, Any] = {
        "cors_origins": ["http://localhost:4173"],
        "instagram_primary_provider": "instaloader",
    }
    return Settings(**(defaults | overrides))


def test_fetch_profile_reels_maps_posts_to_existing_normalizer_shape(monkeypatch: Any) -> None:
    posts = [make_post("AAA"), make_post("BBB")]

    class FakeProfile:
        def get_reels(self) -> Any:
            return iter(posts)

    class FakeProfileType:
        @staticmethod
        def from_username(_context: object, username: str) -> FakeProfile:
            assert username == "competitor"
            return FakeProfile()

    monkeypatch.setattr(service_module.instaloader, "Profile", FakeProfileType)

    service = InstaloaderService(make_settings(), loader=FakeLoader())
    items = service.fetch_profile_reels("competitor", limit=1)

    assert len(items) == 1
    assert items[0]["shortCode"] == "AAA"
    assert items[0]["videoPlayCount"] == 123
    assert items[0]["videoUrl"] == "https://cdn.example.com/AAA.mp4"
    assert items[0]["_provider"] == "instaloader"


def test_fetch_reel_uses_shortcode_and_falls_back_to_view_count(monkeypatch: Any) -> None:
    post = make_post("ONE", play_count=None)

    class FakePostType:
        @staticmethod
        def from_shortcode(_context: object, shortcode: str) -> SimpleNamespace:
            assert shortcode == "ONE"
            return post

    monkeypatch.setattr(service_module.instaloader, "Post", FakePostType)

    service = InstaloaderService(make_settings(), loader=FakeLoader())
    item = service.fetch_reel("ONE")

    assert item["shortCode"] == "ONE"
    assert item["videoPlayCount"] == 99
    assert item["timestamp"] == "2026-08-12T08:30:00+00:00"
