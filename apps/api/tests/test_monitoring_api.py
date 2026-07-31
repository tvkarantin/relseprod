"""API coverage for YouTube monitoring library actions."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from app.api.v1.monitoring import _filter_topic_videos
from app.models import (
    MonitoredChannel,
    MonitoredVideo,
    MonitoringTopic,
    TopicVideo,
    VideoStatisticsSnapshot,
)

if TYPE_CHECKING:
    from fastapi.testclient import TestClient
    from pytest import MonkeyPatch
    from sqlalchemy.orm import Session


def make_monitored_video(db: Session) -> MonitoredVideo:
    topic = MonitoringTopic(
        user_id="local-user",
        name="AI",
        keywords=["AI"],
        negative_keywords=[],
    )
    video = MonitoredVideo(
        external_id="youtube-1",
        url="https://youtube.com/watch?v=youtube-1",
        title="AI video",
        description="Test",
        channel_id="channel-1",
        channel_title="Creator",
        published_at=datetime.now(UTC),
        view_count=100,
    )
    db.add_all((topic, video))
    db.flush()
    db.add(TopicVideo(topic_id=topic.id, video_id=video.id))
    db.add(
        VideoStatisticsSnapshot(
            video_id=video.id,
            view_count=100,
            like_count=10,
            comment_count=2,
        )
    )
    db.commit()
    return video


def test_topic_video_filters_apply_format_views_period_and_sorting() -> None:
    now = datetime(2026, 7, 31, 12, tzinfo=UTC)
    topic = MonitoringTopic(
        user_id="local-user",
        name="Popular Shorts",
        keywords=["AI"],
        negative_keywords=[],
        content_filter="shorts",
        min_view_count=10_000,
        published_within_days=1,
        sort_by="views",
    )
    videos = [
        {
            "id": "short-low",
            "title": "Short with too few views",
            "contentType": "short",
            "viewCount": 9_999,
            "publishedAt": now - timedelta(hours=2),
        },
        {
            "id": "regular",
            "title": "Popular horizontal video",
            "contentType": "video",
            "viewCount": 100_000,
            "publishedAt": now - timedelta(hours=3),
        },
        {
            "id": "short-older",
            "title": "Older Short",
            "contentType": "short",
            "viewCount": 80_000,
            "publishedAt": now - timedelta(days=2),
        },
        {
            "id": "short-a",
            "title": "Recent Short",
            "contentType": "short",
            "viewCount": 20_000,
            "publishedAt": now - timedelta(hours=1),
        },
        {
            "id": "short-b",
            "title": "Most viewed recent Short",
            "contentType": "short",
            "viewCount": 50_000,
            "publishedAt": now - timedelta(hours=6),
        },
    ]

    filtered = _filter_topic_videos(videos, topic, now)

    assert [video["id"] for video in filtered] == ["short-b", "short-a"]


def test_animation_filter_uses_title_and_description_keywords() -> None:
    topic = MonitoringTopic(
        user_id="local-user",
        name="Animation",
        keywords=["AI"],
        negative_keywords=[],
        content_filter="animation",
    )
    videos = [
        {
            "id": "animation-title",
            "title": "3D animation breakdown",
            "description": "",
            "contentType": "video",
            "viewCount": 100,
            "publishedAt": datetime.now(UTC),
        },
        {
            "id": "animation-description",
            "title": "How it was made",
            "description": "Моушн-дизайн для рекламы",
            "contentType": "video",
            "viewCount": 100,
            "publishedAt": datetime.now(UTC),
        },
        {
            "id": "regular",
            "title": "Camera review",
            "description": "A regular horizontal video",
            "contentType": "video",
            "viewCount": 100,
            "publishedAt": datetime.now(UTC),
        },
    ]

    filtered = _filter_topic_videos(videos, topic)

    assert [video["id"] for video in filtered] == [
        "animation-title",
        "animation-description",
    ]


def test_video_moves_from_discovered_results_to_library(
    client: TestClient, db_session: Session
) -> None:
    video = make_monitored_video(db_session)

    before = client.get("/api/v1/monitoring/videos")
    response = client.post(f"/api/v1/monitoring/videos/{video.id}/library")
    discovered = client.get("/api/v1/monitoring/videos")
    library = client.get("/api/v1/monitoring/videos?scope=library")

    assert [item["id"] for item in before.json()] == [video.id]
    assert response.status_code == 200
    assert response.json()["status"] == "saved"
    assert discovered.json() == []
    assert [item["id"] for item in library.json()] == [video.id]
    db_session.refresh(video)
    assert video.status == "saved"


def test_video_can_be_deleted_with_related_rows(
    client: TestClient, db_session: Session
) -> None:
    video = make_monitored_video(db_session)
    video_id = video.id

    response = client.delete(f"/api/v1/monitoring/videos/{video_id}")

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(MonitoredVideo, video_id) is None
    assert db_session.query(TopicVideo).filter_by(video_id=video_id).count() == 0
    assert db_session.query(VideoStatisticsSnapshot).filter_by(video_id=video_id).count() == 0


def test_topic_run_includes_all_added_active_channels(
    client: TestClient,
    db_session: Session,
    stub_background_tasks: list[tuple[Any, ...]],
    monkeypatch: MonkeyPatch,
) -> None:
    topic = MonitoringTopic(
        user_id="local-user",
        name="AI",
        keywords=["AI"],
        negative_keywords=[],
    )
    channel = MonitoredChannel(
        user_id="local-user",
        channel_id="channel-1",
        channel_url="https://youtube.com/channel/channel-1",
        channel_title="Creator",
        uploads_playlist_id="uploads-1",
        is_active=True,
    )
    db_session.add_all((topic, channel))
    db_session.commit()
    seen_channels: list[tuple[str, str | None]] = []

    class FakeYouTubeService:
        def __init__(self, _settings: Any) -> None:
            pass

        def searchVideosByKeywords(self, *_args: Any) -> list[dict[str, Any]]:  # noqa: N802
            return []

        def getLatestChannelVideos(  # noqa: N802
            self,
            channel_id: str,
            uploads_playlist_id: str | None,
            _after: datetime | None,
        ) -> list[dict[str, Any]]:
            seen_channels.append((channel_id, uploads_playlist_id))
            return []

        def close(self) -> None:
            pass

    monkeypatch.setattr(
        "app.api.v1.monitoring.YouTubeMonitoringService",
        FakeYouTubeService,
    )

    topics_response = client.get("/api/v1/monitoring/topics")
    assert topics_response.status_code == 200
    assert topics_response.json()[0]["includedChannelsCount"] == 1

    response = client.post(f"/api/v1/monitoring/topics/{topic.id}/run")

    assert response.status_code == 202
    assert len(stub_background_tasks) == 1
    task, args, kwargs = stub_background_tasks[0]
    task(*args, **kwargs)
    assert seen_channels == [("channel-1", "uploads-1")]

    db_session.expire_all()
    refreshed = db_session.get(MonitoringTopic, topic.id)
    assert refreshed is not None
    assert refreshed.run_status == "completed"
    assert refreshed.run_message == "Готово: обработано 0 видео"
