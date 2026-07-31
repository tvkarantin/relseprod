"""API coverage for YouTube monitoring gallery actions."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

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


def test_video_can_be_added_to_gallery(client: TestClient, db_session: Session) -> None:
    video = make_monitored_video(db_session)

    response = client.post(f"/api/v1/monitoring/videos/{video.id}/save")

    assert response.status_code == 200
    assert response.json()["status"] == "saved"
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
