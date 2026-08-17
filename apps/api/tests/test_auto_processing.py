"""Regression coverage for automatic post-import reel preparation."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Competitor
from app.services.reel_importer import ReelImporter
from app.services.reel_normalizer import NormalizedReel


def _reel(*, views_count: int = 100) -> NormalizedReel:
    return NormalizedReel(
        instagram_id="auto-1",
        shortcode="AUTO1",
        original_url="https://www.instagram.com/reel/AUTO1/",
        video_url="https://cdn.example.com/auto.mp4",
        thumbnail_url="https://cdn.example.com/auto.jpg",
        caption="Auto processing",
        views_count=views_count,
        likes_count=10,
        comments_count=1,
        published_at=datetime(2026, 8, 17, 8, 0, tzinfo=UTC),
        duration=20.0,
        raw_data={"source": "test"},
    )


def test_import_result_tracks_new_and_refreshed_reels(db_session: Session) -> None:
    competitor = Competitor(
        instagram_username="autoprocess",
        profile_url="https://www.instagram.com/autoprocess/",
    )
    db_session.add(competitor)
    db_session.flush()

    importer = ReelImporter()
    first = importer.import_reels(db_session, competitor, [_reel()])

    assert first.created == 1
    assert first.updated == 0
    assert len(first.created_reel_ids) == 1
    assert first.processed_reel_ids == first.created_reel_ids

    second = importer.import_reels(db_session, competitor, [_reel(views_count=999)])

    assert second.created == 0
    assert second.updated == 1
    assert second.created_reel_ids == []
    assert second.processed_reel_ids == first.processed_reel_ids
