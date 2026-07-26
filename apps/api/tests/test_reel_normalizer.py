"""Tests for the Apify → NormalizedReel converter."""

from __future__ import annotations

import copy
from datetime import UTC, datetime

import pytest

from app.services.reel_normalizer import (
    NormalizedReel,
    normalize_apify_items,
    normalize_apify_reel,
)


def base_item(**overrides: object) -> dict[str, object]:
    item: dict[str, object] = {"shortCode": "CxAbCdEf"}
    item.update(overrides)
    return item


@pytest.mark.parametrize("key", ["id", "instagramId", "postId", "pk", "reelId"])
def test_all_instagram_id_variants_are_supported(key: str) -> None:
    reel = normalize_apify_reel({key: "17900000000000000"})

    assert reel is not None
    assert reel.instagram_id == "17900000000000000"


@pytest.mark.parametrize("key", ["shortCode", "shortcode", "code"])
def test_all_shortcode_variants_are_supported(key: str) -> None:
    reel = normalize_apify_reel({key: "CxAbCdEf"})

    assert reel is not None
    assert reel.shortcode == "CxAbCdEf"


def test_original_url_is_built_from_shortcode_when_missing() -> None:
    reel = normalize_apify_reel(base_item())

    assert reel is not None
    assert reel.original_url == "https://www.instagram.com/reel/CxAbCdEf/"


@pytest.mark.parametrize("key", ["url", "postUrl", "reelUrl", "inputUrl", "reelURL"])
def test_original_url_variants_win_over_the_generated_one(key: str) -> None:
    url = "https://www.instagram.com/reel/REAL123/"
    reel = normalize_apify_reel(base_item(**{key: url}))

    assert reel is not None
    assert reel.original_url == url


def test_shortcode_is_recovered_from_the_url_when_absent() -> None:
    reel = normalize_apify_reel({"url": "https://www.instagram.com/reel/FromUrl9/?igshid=1"})

    assert reel is not None
    assert reel.shortcode == "FromUrl9"


@pytest.mark.parametrize("key", ["videoUrl", "video_url", "videoPlayUrl"])
def test_video_url_variants(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: "https://cdn.example.com/v.mp4"}))

    assert reel is not None
    assert reel.video_url == "https://cdn.example.com/v.mp4"


@pytest.mark.parametrize("key", ["displayUrl", "thumbnailUrl", "imageUrl", "coverUrl"])
def test_thumbnail_url_variants(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: "https://cdn.example.com/t.jpg"}))

    assert reel is not None
    assert reel.thumbnail_url == "https://cdn.example.com/t.jpg"


@pytest.mark.parametrize("key", ["caption", "text", "description"])
def test_caption_variants(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: "  Текст подписи  "}))

    assert reel is not None
    assert reel.caption == "Текст подписи"


@pytest.mark.parametrize(
    "key", ["videoViewCount", "viewsCount", "playCount", "videoPlayCount"]
)
def test_views_variants_as_int(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: 1_200_000}))

    assert reel is not None
    assert reel.views_count == 1_200_000


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("1200000", 1_200_000), ("1 200 000", 1_200_000), ("1,200,000", 1_200_000), ("12.0", 12)],
)
def test_views_accept_numeric_strings(raw: str, expected: int) -> None:
    reel = normalize_apify_reel(base_item(videoViewCount=raw))

    assert reel is not None
    assert reel.views_count == expected


@pytest.mark.parametrize("key", ["likesCount", "likeCount"])
def test_likes_variants(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: 950}))

    assert reel is not None
    assert reel.likes_count == 950


@pytest.mark.parametrize("key", ["commentsCount", "commentCount"])
def test_comments_variants(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: 42}))

    assert reel is not None
    assert reel.comments_count == 42


@pytest.mark.parametrize("key", ["timestamp", "publishedAt", "takenAt", "createdAt"])
def test_iso_datetime_variants(key: str) -> None:
    reel = normalize_apify_reel(base_item(**{key: "2026-01-07T17:04:30.000Z"}))

    assert reel is not None
    assert reel.published_at == datetime(2026, 1, 7, 17, 4, 30, tzinfo=UTC)


def test_unix_seconds_are_parsed() -> None:
    reel = normalize_apify_reel(base_item(timestamp=1767805470))

    assert reel is not None
    assert reel.published_at == datetime(2026, 1, 7, 17, 4, 30, tzinfo=UTC)


def test_unix_milliseconds_are_parsed() -> None:
    reel = normalize_apify_reel(base_item(timestamp=1767805470000))

    assert reel is not None
    assert reel.published_at == datetime(2026, 1, 7, 17, 4, 30, tzinfo=UTC)


def test_numeric_string_timestamp_is_parsed() -> None:
    reel = normalize_apify_reel(base_item(timestamp="1767805470"))

    assert reel is not None
    assert reel.published_at == datetime(2026, 1, 7, 17, 4, 30, tzinfo=UTC)


@pytest.mark.parametrize(
    ("key", "raw", "expected"),
    [("videoDuration", 32.5, 32.5), ("duration", "18", 18.0)],
)
def test_duration_variants(key: str, raw: object, expected: float) -> None:
    reel = normalize_apify_reel(base_item(**{key: raw}))

    assert reel is not None
    assert reel.duration == pytest.approx(expected)


def test_missing_metrics_stay_none_and_are_not_zeroed() -> None:
    reel = normalize_apify_reel(base_item())

    assert reel is not None
    assert reel.views_count is None
    assert reel.likes_count is None
    assert reel.comments_count is None
    assert reel.published_at is None
    assert reel.duration is None
    assert reel.caption is None


@pytest.mark.parametrize("value", ["", "   ", "n/a", "unknown", None])
def test_unparsable_metrics_become_none(value: object) -> None:
    reel = normalize_apify_reel(base_item(likesCount=value))

    assert reel is not None
    assert reel.likes_count is None


@pytest.mark.parametrize(
    "raw",
    [
        {},
        {"caption": "нет идентификаторов"},
        {"likesCount": 10, "url": "https://example.com/not-instagram"},
        {"id": "", "shortCode": "   "},
    ],
)
def test_items_without_identifiers_are_skipped(raw: dict[str, object]) -> None:
    assert normalize_apify_reel(raw) is None


@pytest.mark.parametrize("bad_url", ["not-a-url", "ftp://cdn.example.com/v.mp4", "/relative", ""])
def test_invalid_urls_are_dropped(bad_url: str) -> None:
    reel = normalize_apify_reel(base_item(videoUrl=bad_url))

    assert reel is not None
    assert reel.video_url is None


def test_raw_data_is_preserved() -> None:
    raw = base_item(likesCount=5, nested={"a": [1, 2, 3]})
    reel = normalize_apify_reel(raw)

    assert reel is not None
    assert reel.raw_data == raw


def test_source_object_is_not_mutated() -> None:
    raw = base_item(likesCount=5, nested={"a": [1, 2]})
    snapshot = copy.deepcopy(raw)

    reel = normalize_apify_reel(raw)
    assert reel is not None

    reel.raw_data["nested"]["a"].append(99)  # type: ignore[index]

    assert raw == snapshot, "normalizer must deep-copy the incoming payload"


def test_normalize_apify_items_reports_skipped_count() -> None:
    items: list[dict[str, object]] = [
        base_item(shortCode="AAA"),
        {"caption": "no id"},
        base_item(shortCode="BBB"),
    ]

    normalized, skipped = normalize_apify_items(items)

    assert [reel.shortcode for reel in normalized] == ["AAA", "BBB"]
    assert skipped == 1


def test_real_world_reel_scraper_item() -> None:
    """Shape documented for apify/instagram-reel-scraper."""
    raw: dict[str, object] = {
        "reelURL": "https://www.instagram.com/p/DTN5aH4gG9z/",
        "reelId": "3804949744019599219",
        "ownerUsername": "natgeo",
        "videoPlayCount": 1_948_214,
        "likesCount": 64_503,
        "commentsCount": 340,
        "timestamp": "2026-01-07T17:04:30.000Z",
    }

    reel = normalize_apify_reel(raw)

    assert reel is not None
    assert reel.instagram_id == "3804949744019599219"
    assert reel.shortcode == "DTN5aH4gG9z"
    assert reel.original_url == "https://www.instagram.com/p/DTN5aH4gG9z/"
    assert reel.views_count == 1_948_214
    assert reel.likes_count == 64_503
    assert reel.comments_count == 340
    assert reel.published_at == datetime(2026, 1, 7, 17, 4, 30, tzinfo=UTC)


def test_normalized_reel_identity_prefers_shortcode() -> None:
    assert NormalizedReel(shortcode="ABC", instagram_id="1").identity == "ABC"
    assert NormalizedReel(instagram_id="1").identity == "1"
    assert NormalizedReel().identity == "unknown"
