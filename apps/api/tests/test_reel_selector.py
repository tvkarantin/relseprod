"""Tests for selecting the five reels persisted from an Apify dataset."""

from datetime import UTC, datetime, timedelta

from app.models.enums import ReelImportMode
from app.services.reel_normalizer import NormalizedReel
from app.services.reel_selector import select_reels_for_import


def make_reel(
    index: int,
    *,
    views: int | None,
    published_at: datetime | None,
    shortcode: str | None = None,
    instagram_id: str | None = None,
) -> NormalizedReel:
    return NormalizedReel(
        shortcode=shortcode or f"REEL{index}",
        instagram_id=instagram_id or f"id-{index}",
        views_count=views,
        published_at=published_at,
    )


def test_selects_five_reels_with_the_most_views() -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    reels = [
        make_reel(index, views=views, published_at=base + timedelta(days=index))
        for index, views in enumerate((150, 9_000, 400, 12_000, 800, 7_500, 50))
    ]

    selected = select_reels_for_import(reels)

    assert [reel.views_count for reel in selected] == [12_000, 9_000, 7_500, 800, 400]


def test_fills_missing_view_metrics_with_the_newest_reels() -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    reels = [
        make_reel(1, views=5_000, published_at=base),
        make_reel(2, views=None, published_at=base + timedelta(days=2)),
        make_reel(3, views=2_000, published_at=base + timedelta(days=1)),
        make_reel(4, views=None, published_at=base + timedelta(days=4)),
        make_reel(5, views=None, published_at=base + timedelta(days=3)),
        make_reel(6, views=None, published_at=None),
    ]

    selected = select_reels_for_import(reels)

    assert [reel.shortcode for reel in selected] == [
        "REEL1",
        "REEL3",
        "REEL4",
        "REEL5",
        "REEL2",
    ]


def test_uses_five_newest_when_no_view_metrics_exist() -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    reels = [
        make_reel(index, views=None, published_at=base + timedelta(days=index))
        for index in range(7)
    ]

    selected = select_reels_for_import(reels)

    assert [reel.shortcode for reel in selected] == [
        "REEL6",
        "REEL5",
        "REEL4",
        "REEL3",
        "REEL2",
    ]


def test_duplicates_do_not_consume_import_slots() -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    reels = [
        make_reel(1, views=10_000, published_at=base, shortcode="SAME"),
        make_reel(2, views=9_000, published_at=base, shortcode="SAME"),
        make_reel(3, views=8_000, published_at=base),
        make_reel(4, views=7_000, published_at=base),
        make_reel(5, views=6_000, published_at=base),
        make_reel(6, views=5_000, published_at=base),
    ]

    selected = select_reels_for_import(reels)

    assert len(selected) == 5
    assert [reel.views_count for reel in selected] == [10_000, 8_000, 7_000, 6_000, 5_000]


def test_returns_every_available_reel_when_fewer_than_five_exist() -> None:
    reels = [
        make_reel(1, views=100, published_at=None),
        make_reel(2, views=None, published_at=None),
    ]

    assert select_reels_for_import(reels) == reels


def test_latest_mode_ignores_views_and_uses_publication_date() -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    reels = [
        make_reel(index, views=100_000 - index, published_at=base + timedelta(days=index))
        for index in range(7)
    ]

    selected = select_reels_for_import(reels, mode=ReelImportMode.LATEST)

    assert [reel.shortcode for reel in selected] == [
        "REEL6",
        "REEL5",
        "REEL4",
        "REEL3",
        "REEL2",
    ]


def test_stored_reels_are_excluded_and_replaced_by_next_candidates() -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    reels = [
        make_reel(index, views=10_000 - index, published_at=base + timedelta(days=index))
        for index in range(8)
    ]

    selected = select_reels_for_import(
        reels,
        excluded_shortcodes={"REEL0", "REEL1"},
        excluded_instagram_ids={"id-2"},
    )

    assert [reel.shortcode for reel in selected] == [
        "REEL3",
        "REEL4",
        "REEL5",
        "REEL6",
        "REEL7",
    ]
