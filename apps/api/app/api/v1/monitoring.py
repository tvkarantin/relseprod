"""YouTube monitoring API. Current product has no login, so X-User-Id scopes the local MVP."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.models.monitoring import (
    MonitoredChannel,
    MonitoredVideo,
    MonitoringTopic,
    TopicVideo,
    VideoStatisticsSnapshot,
)
from app.services.youtube_monitoring import (
    YouTubeMonitoringService,
    calculate_final_score,
    category_for_score,
    engagement_rate,
    fallback_analysis,
    parse_youtube_url,
    views_per_hour,
)

router = APIRouter(prefix="/monitoring", tags=["youtube-monitoring"])
logger = logging.getLogger(__name__)

VIDEO_FIELD_MAP = {
    "externalId": "external_id",
    "thumbnailUrl": "thumbnail_url",
    "publishedAt": "published_at",
    "durationSeconds": "duration_seconds",
    "contentType": "content_type",
    "viewCount": "view_count",
    "likeCount": "like_count",
    "commentCount": "comment_count",
    "channelId": "channel_id",
    "channelTitle": "channel_title",
}

ANIMATION_KEYWORDS = (
    "animation",
    "animated",
    "anime",
    "cartoon",
    "motion design",
    "3d animation",
    "анимац",
    "мульт",
    "моушн",
)


def user_scope(x_user_id: Annotated[str | None, Header()] = None) -> str:
    return (x_user_id or "local-user").strip()[:128] or "local-user"


class TopicPayload(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    keywords: list[str] = Field(min_length=1, max_length=50)
    negative_keywords: list[str] = Field(default_factory=list, max_length=50)
    language: str | None = Field(default=None, max_length=16)
    region_code: str | None = Field(default=None, max_length=8)
    minimum_score: int = Field(default=70, ge=0, le=100)
    is_active: bool = True
    check_interval_hours: int = Field(default=3, ge=1, le=24)
    content_filter: str = Field(default="all", pattern="^(all|shorts|videos|animation)$")
    min_view_count: int = Field(default=0, ge=0, le=2_000_000_000)
    published_within_days: int | None = Field(default=None, ge=1, le=365)
    sort_by: str = Field(default="score", pattern="^(score|views|recent|velocity)$")

    @field_validator("keywords", "negative_keywords")
    @classmethod
    def clean_words(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(word.strip() for word in value if word.strip()))


class StatusPayload(BaseModel):
    status: str = Field(pattern="^(new|analyzed|recommended|saved|ignored)$")


class ChannelPayload(BaseModel):
    url: str = Field(min_length=3, max_length=500)


def topic_read(topic: MonitoringTopic, included_channels_count: int = 0) -> dict[str, Any]:
    return {
        "id": topic.id,
        "name": topic.name,
        "keywords": topic.keywords,
        "negativeKeywords": topic.negative_keywords,
        "language": topic.language,
        "regionCode": topic.region_code,
        "minimumScore": topic.minimum_score,
        "isActive": topic.is_active,
        "checkIntervalHours": topic.check_interval_hours,
        "contentFilter": topic.content_filter,
        "minViewCount": topic.min_view_count,
        "publishedWithinDays": topic.published_within_days,
        "sortBy": topic.sort_by,
        "lastCheckedAt": topic.last_checked_at,
        "runStatus": topic.run_status,
        "runStage": topic.run_stage,
        "runProgress": topic.run_progress,
        "runMessage": topic.run_message,
        "runError": topic.run_error,
        "runStartedAt": topic.run_started_at,
        "runFinishedAt": topic.run_finished_at,
        "includedChannelsCount": included_channels_count,
        "createdAt": topic.created_at,
        "updatedAt": topic.updated_at,
    }


def video_read(video: MonitoredVideo) -> dict[str, Any]:
    return {
        "id": video.id,
        "externalId": video.external_id,
        "platform": video.platform,
        "url": video.url,
        "title": video.title,
        "description": video.description,
        "channelId": video.channel_id,
        "channelTitle": video.channel_title,
        "thumbnailUrl": video.thumbnail_url,
        "publishedAt": video.published_at,
        "durationSeconds": video.duration_seconds,
        "contentType": video.content_type,
        "viewCount": video.view_count,
        "likeCount": video.like_count,
        "commentCount": video.comment_count,
        "viewsPerHour": video.views_per_hour,
        "engagementRate": video.engagement_rate,
        "relevanceScore": video.relevance_score,
        "velocityScore": video.velocity_score,
        "engagementScore": video.engagement_score,
        "competitorScore": video.competitor_score,
        "aiScore": video.ai_score,
        "finalScore": video.final_score,
        "category": video.category or category_for_score(video.final_score),
        "hook": video.hook,
        "format": video.format,
        "targetAudience": video.target_audience,
        "whyItWorks": video.why_it_works,
        "recommendation": video.recommendation,
        "status": video.status,
        "firstDetectedAt": video.first_detected_at,
        "lastStatisticsUpdateAt": video.last_statistics_update_at,
    }


@router.get("/topics")
def list_topics(
    db: Annotated[Session, Depends(DbSession)], user_id: Annotated[str, Depends(user_scope)]
) -> list[dict[str, Any]]:
    included_channels_count = db.scalar(
        select(func.count(MonitoredChannel.id)).where(
            MonitoredChannel.user_id == user_id,
            MonitoredChannel.is_active.is_(True),
        )
    ) or 0
    return [
        topic_read(item, included_channels_count)
        for item in db.scalars(
            select(MonitoringTopic)
            .where(MonitoringTopic.user_id == user_id)
            .order_by(MonitoringTopic.created_at.desc())
        ).all()
    ]


@router.post("/topics", status_code=status.HTTP_201_CREATED)
def create_topic(
    payload: TopicPayload,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    topic = MonitoringTopic(user_id=user_id, **payload.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    included_channels_count = db.scalar(
        select(func.count(MonitoredChannel.id)).where(
            MonitoredChannel.user_id == user_id,
            MonitoredChannel.is_active.is_(True),
        )
    ) or 0
    return topic_read(topic, included_channels_count)


@router.patch("/topics/{topic_id}")
def update_topic(
    topic_id: int,
    payload: TopicPayload,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    topic = db.scalar(
        select(MonitoringTopic).where(
            MonitoringTopic.id == topic_id, MonitoringTopic.user_id == user_id
        )
    )
    if not topic:
        raise HTTPException(404, "Тема мониторинга не найдена")
    for key, value in payload.model_dump().items():
        setattr(topic, key, value)
    db.commit()
    db.refresh(topic)
    included_channels_count = db.scalar(
        select(func.count(MonitoredChannel.id)).where(
            MonitoredChannel.user_id == user_id,
            MonitoredChannel.is_active.is_(True),
        )
    ) or 0
    return topic_read(topic, included_channels_count)


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(
    topic_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> None:
    topic = db.scalar(
        select(MonitoringTopic).where(
            MonitoringTopic.id == topic_id, MonitoringTopic.user_id == user_id
        )
    )
    if not topic:
        raise HTTPException(404, "Тема мониторинга не найдена")
    db.delete(topic)
    db.commit()


@router.get("/channels")
def list_channels(
    db: Annotated[Session, Depends(DbSession)], user_id: Annotated[str, Depends(user_scope)]
) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(MonitoredChannel)
        .where(MonitoredChannel.user_id == user_id)
        .order_by(MonitoredChannel.created_at.desc())
    ).all()
    return [
        {
            "id": x.id,
            "channelId": x.channel_id,
            "channelUrl": x.channel_url,
            "channelTitle": x.channel_title,
            "thumbnailUrl": x.thumbnail_url,
            "subscriberCount": x.subscriber_count,
            "lastCheckedAt": x.last_checked_at,
            "isActive": x.is_active,
            "monitoringTopicId": x.monitoring_topic_id,
        }
        for x in rows
    ]


@router.post("/channels", status_code=201)
def add_channel(
    payload: ChannelPayload,
    request: Request,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    source = payload.url.strip()
    try:
        kind, identifier = parse_youtube_url(source)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    service = YouTubeMonitoringService(settings)
    try:
        channel_id = identifier
        if kind == "video_id":
            data = service._request("videos", {"part": "snippet", "id": identifier})
            channel_id = data.get("items", [{}])[0].get("snippet", {}).get("channelId")
        if kind in {"handle", "channel_id"} and kind == "handle":
            data = service._request(
                "channels",
                {"part": "snippet,statistics,contentDetails", "forHandle": identifier.lstrip("@")},
            )
        else:
            data = service._request(
                "channels", {"part": "snippet,statistics,contentDetails", "id": channel_id}
            )
    except Exception as exc:
        raise HTTPException(502, "YouTube API недоступен или канал не найден") from exc
    finally:
        service.close()
    item = data.get("items", [None])[0]
    if not item:
        raise HTTPException(404, "Канал YouTube не найден")
    channel_id = item["id"]
    existing = db.scalar(
        select(MonitoredChannel).where(
            MonitoredChannel.user_id == user_id, MonitoredChannel.channel_id == channel_id
        )
    )
    if existing:
        return {
            "id": existing.id,
            "channelId": existing.channel_id,
            "channelTitle": existing.channel_title,
            "isActive": existing.is_active,
            "duplicate": True,
        }
    details = item.get("contentDetails", {}).get("relatedPlaylists", {})
    channel = MonitoredChannel(
        user_id=user_id,
        channel_id=channel_id,
        channel_url=f"https://www.youtube.com/channel/{channel_id}",
        channel_title=item.get("snippet", {}).get("title", channel_id),
        thumbnail_url=item.get("snippet", {}).get("thumbnails", {}).get("default", {}).get("url"),
        uploads_playlist_id=details.get("uploads"),
        subscriber_count=int(item.get("statistics", {}).get("subscriberCount", 0)),
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return {
        "id": channel.id,
        "channelId": channel.channel_id,
        "channelTitle": channel.channel_title,
        "thumbnailUrl": channel.thumbnail_url,
        "subscriberCount": channel.subscriber_count,
        "isActive": channel.is_active,
    }


@router.delete("/channels/{channel_id}", status_code=204)
def delete_channel(
    channel_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> None:
    channel = db.scalar(
        select(MonitoredChannel).where(
            MonitoredChannel.id == channel_id, MonitoredChannel.user_id == user_id
        )
    )
    if not channel:
        raise HTTPException(404, "Канал не найден")
    db.delete(channel)
    db.commit()


@router.get("/videos")
def list_videos(
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
    topic_id: int | None = Query(default=None),
    content_type: str | None = None,
    minimum_score: float | None = None,
    scope: Literal["discovered", "library", "all"] = Query(default="discovered"),
    sort_by: str | None = Query(
        default=None,
        pattern="^(score|views|recent|velocity)$",
    ),
) -> list[dict[str, Any]]:
    query = (
        select(MonitoredVideo)
        .join(TopicVideo)
        .join(MonitoringTopic)
        .where(MonitoringTopic.user_id == user_id)
        .distinct()
    )
    if topic_id:
        query = query.where(TopicVideo.topic_id == topic_id)
        if sort_by is None:
            sort_by = db.scalar(
                select(MonitoringTopic.sort_by).where(
                    MonitoringTopic.id == topic_id,
                    MonitoringTopic.user_id == user_id,
                )
            )
    if content_type:
        query = query.where(MonitoredVideo.content_type == content_type)
    if minimum_score is not None:
        query = query.where(MonitoredVideo.final_score >= minimum_score)
    if scope == "library":
        query = query.where(MonitoredVideo.status == "saved")
    elif scope == "discovered":
        query = query.where(MonitoredVideo.status != "saved")

    if sort_by == "views":
        query = query.order_by(
            MonitoredVideo.view_count.desc(),
            MonitoredVideo.published_at.desc(),
        )
    elif sort_by == "recent":
        query = query.order_by(MonitoredVideo.published_at.desc())
    elif sort_by == "velocity":
        query = query.order_by(
            MonitoredVideo.views_per_hour.desc().nullslast(),
            MonitoredVideo.published_at.desc(),
        )
    else:
        query = query.order_by(
            MonitoredVideo.final_score.desc().nullslast(),
            MonitoredVideo.published_at.desc(),
        )
    return [video_read(item) for item in db.scalars(query).all()]


@router.get("/videos/{video_id}")
def get_video(
    video_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    video = db.scalar(
        select(MonitoredVideo)
        .join(TopicVideo)
        .join(MonitoringTopic)
        .where(MonitoredVideo.id == video_id, MonitoringTopic.user_id == user_id)
    )
    if not video:
        raise HTTPException(404, "Видео не найдено")
    return video_read(video)


@router.patch("/videos/{video_id}/status")
def update_status(
    video_id: int,
    payload: StatusPayload,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    video = db.scalar(
        select(MonitoredVideo)
        .join(TopicVideo)
        .join(MonitoringTopic)
        .where(MonitoredVideo.id == video_id, MonitoringTopic.user_id == user_id)
    )
    if not video:
        raise HTTPException(404, "Видео не найдено")
    video.status = payload.status
    db.commit()
    return video_read(video)


@router.post("/videos/{video_id}/library")
def add_video_to_library(
    video_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    return _set_video_status(video_id, "saved", db, user_id)


@router.post("/videos/{video_id}/save", include_in_schema=False)
def save_video(
    video_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    """Backward-compatible alias for clients using the former gallery action."""
    return add_video_to_library(video_id, db, user_id)


@router.post("/videos/{video_id}/required")
def require_video(
    video_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    return _set_video_status(video_id, "recommended", db, user_id)


def _set_video_status(video_id: int, value: str, db: Session, user_id: str) -> dict[str, Any]:
    video = db.scalar(
        select(MonitoredVideo)
        .join(TopicVideo)
        .join(MonitoringTopic)
        .where(MonitoredVideo.id == video_id, MonitoringTopic.user_id == user_id)
    )
    if not video:
        raise HTTPException(404, "Видео не найдено")
    video.status = value
    db.commit()
    return video_read(video)


@router.post("/videos/{video_id}/ignore")
def ignore_video(
    video_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, Any]:
    return _set_video_status(video_id, "ignored", db, user_id)


@router.delete("/videos/{video_id}", status_code=204)
def delete_video(
    video_id: int,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> None:
    video = db.scalar(
        select(MonitoredVideo)
        .join(TopicVideo)
        .join(MonitoringTopic)
        .where(MonitoredVideo.id == video_id, MonitoringTopic.user_id == user_id)
    )
    if not video:
        raise HTTPException(404, "Видео не найдено")

    user_topic_ids = select(MonitoringTopic.id).where(MonitoringTopic.user_id == user_id)
    links = db.scalars(
        select(TopicVideo).where(
            TopicVideo.video_id == video_id,
            TopicVideo.topic_id.in_(user_topic_ids),
        )
    ).all()
    for link in links:
        db.delete(link)
    db.flush()

    remaining_link = db.scalar(
        select(TopicVideo.id).where(TopicVideo.video_id == video_id).limit(1)
    )
    if remaining_link is None:
        db.delete(video)
    db.commit()


def _video_model_values(data: dict[str, Any]) -> dict[str, Any]:
    """Translate the YouTube service payload into SQLAlchemy attribute names."""

    return {VIDEO_FIELD_MAP.get(key, key): value for key, value in data.items()}


def _is_animation_video(data: dict[str, Any]) -> bool:
    text = f"{data.get('title', '')} {data.get('description', '')}".lower()
    return any(keyword in text for keyword in ANIMATION_KEYWORDS)


def _filter_topic_videos(
    videos: list[dict[str, Any]],
    topic: MonitoringTopic,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Apply the topic's format, age and popularity settings to YouTube results."""

    now = now or datetime.now(UTC)
    content_filter = topic.content_filter or "all"
    min_view_count = topic.min_view_count or 0
    sort_by = topic.sort_by or "score"
    published_after = (
        now - timedelta(days=topic.published_within_days)
        if topic.published_within_days
        else None
    )
    filtered: list[dict[str, Any]] = []
    for video in videos:
        if int(video.get("viewCount") or 0) < min_view_count:
            continue
        if content_filter == "shorts" and video.get("contentType") != "short":
            continue
        if content_filter == "videos" and video.get("contentType") != "video":
            continue
        if content_filter == "animation" and not _is_animation_video(video):
            continue
        published_at = video.get("publishedAt")
        if (
            published_after is not None
            and isinstance(published_at, datetime)
            and published_at < published_after
        ):
            continue
        filtered.append(video)

    if sort_by == "views":
        filtered.sort(key=lambda item: int(item.get("viewCount") or 0), reverse=True)
    elif sort_by == "recent":
        filtered.sort(
            key=lambda item: item.get("publishedAt") or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
    elif sort_by == "velocity":
        filtered.sort(
            key=lambda item: views_per_hour(
                int(item.get("viewCount") or 0),
                item.get("publishedAt") or now,
                now,
            ),
            reverse=True,
        )
    return filtered


def _set_run_state(
    topic: MonitoringTopic,
    *,
    status_value: str,
    stage: str,
    progress: int,
    message: str,
    error: str | None = None,
    finished: bool = False,
) -> None:
    topic.run_status = status_value
    topic.run_stage = stage
    topic.run_progress = max(0, min(100, progress))
    topic.run_message = message
    topic.run_error = error
    if finished:
        topic.run_finished_at = datetime.now(UTC)


def run_topic(topic_id: int, user_id: str, settings: Settings) -> None:
    from app.database.session import session_scope

    with session_scope(settings) as db:
        topic = db.scalar(
            select(MonitoringTopic).where(
                MonitoringTopic.id == topic_id,
                MonitoringTopic.user_id == user_id,
                MonitoringTopic.is_active.is_(True),
            )
        )
        if not topic:
            return

        try:
            after = topic.last_checked_at
            if topic.published_within_days:
                period_start = datetime.now(UTC) - timedelta(days=topic.published_within_days)
                after = max(after, period_start) if after else period_start
            _set_run_state(
                topic,
                status_value="running",
                stage="searching",
                progress=12,
                message="Ищем свежие видео по ключевым словам",
            )
            db.commit()

            service = YouTubeMonitoringService(settings)
            try:
                videos = service.searchVideosByKeywords(
                    topic.keywords, after, topic.language, topic.region_code
                )
                _set_run_state(
                    topic,
                    status_value="running",
                    stage="channels",
                    progress=34,
                    message="Проверяем добавленные YouTube-каналы",
                )
                db.commit()

                channels = db.scalars(
                    select(MonitoredChannel).where(
                        MonitoredChannel.user_id == user_id,
                        MonitoredChannel.is_active.is_(True),
                    )
                ).all()
                for channel_index, channel in enumerate(channels, start=1):
                    videos.extend(
                        service.getLatestChannelVideos(
                            channel.channel_id, channel.uploads_playlist_id, after
                        )
                    )
                    channel_progress = 34 + round(channel_index / max(len(channels), 1) * 10)
                    _set_run_state(
                        topic,
                        status_value="running",
                        stage="channels",
                        progress=channel_progress,
                        message=f"Проверено каналов: {channel_index} из {len(channels)}",
                    )
                    db.commit()
            finally:
                service.close()

            unique: dict[str, dict[str, Any]] = {
                item["externalId"]: item for item in videos if item.get("externalId")
            }
            raw_total = len(unique)
            filtered_videos = _filter_topic_videos(list(unique.values()), topic)
            total = len(filtered_videos)
            _set_run_state(
                topic,
                status_value="running",
                stage="processing",
                progress=46,
                message=f"Под фильтры подошло видео: {total} из {raw_total}",
            )
            db.commit()

            for video_index, data in enumerate(filtered_videos, start=1):
                video = db.scalar(
                    select(MonitoredVideo).where(
                        MonitoredVideo.platform == "youtube",
                        MonitoredVideo.external_id == data["externalId"],
                    )
                )
                model_values = _video_model_values(data)
                if not video:
                    video = MonitoredVideo(platform="youtube", **model_values)
                    db.add(video)
                    db.flush()
                else:
                    for key, value in model_values.items():
                        setattr(video, key, value)

                video.views_per_hour = views_per_hour(video.view_count, video.published_at)
                video.engagement_rate = engagement_rate(
                    video.like_count, video.comment_count, video.view_count
                )
                analysis = fallback_analysis(
                    video.title, video.description or "", topic.keywords, topic.negative_keywords
                )
                video.relevance_score = analysis["relevanceScore"]
                video.ai_score = analysis["aiScore"]
                video.why_it_works = analysis["whyItWorks"]
                video.recommendation = analysis["recommendation"]
                video.velocity_score = min(
                    100, (video.views_per_hour or 0) / max(1, video.view_count / 1000) * 10
                )
                video.engagement_score = min(100, (video.engagement_rate or 0) * 20)
                video.competitor_score = (
                    80
                    if any(channel.channel_id == video.channel_id for channel in channels)
                    else 35
                )
                video.final_score = calculate_final_score(
                    video.relevance_score,
                    video.velocity_score,
                    video.engagement_score,
                    video.competitor_score,
                    video.ai_score,
                )
                video.category = category_for_score(video.final_score)
                if video.status != "saved":
                    video.status = "recommended" if video.final_score >= 85 else "analyzed"
                db.add(
                    VideoStatisticsSnapshot(
                        video_id=video.id,
                        view_count=video.view_count,
                        like_count=video.like_count,
                        comment_count=video.comment_count,
                    )
                )
                link = db.scalar(
                    select(TopicVideo).where(
                        TopicVideo.topic_id == topic.id, TopicVideo.video_id == video.id
                    )
                )
                if not link:
                    link = TopicVideo(topic_id=topic.id, video_id=video.id)
                    db.add(link)
                    db.flush()
                if (
                    video.final_score is not None
                    and video.final_score >= topic.minimum_score
                    and link.notified_at is None
                ):
                    link.notified_at = datetime.now(UTC)

                progress = 46 + round(video_index / max(total, 1) * 48)
                _set_run_state(
                    topic,
                    status_value="running",
                    stage="processing",
                    progress=progress,
                    message=f"Обработано видео: {video_index} из {total}",
                )
                db.commit()

            topic.last_checked_at = datetime.now(UTC)
            _set_run_state(
                topic,
                status_value="completed",
                stage="completed",
                progress=100,
                message=f"Готово: обработано {total} видео",
                finished=True,
            )
            db.commit()
        except Exception as exc:
            db.rollback()
            failed_topic = db.scalar(
                select(MonitoringTopic).where(
                    MonitoringTopic.id == topic_id,
                    MonitoringTopic.user_id == user_id,
                )
            )
            if failed_topic:
                _set_run_state(
                    failed_topic,
                    status_value="failed",
                    stage="failed",
                    progress=failed_topic.run_progress,
                    message="Проверка остановлена из-за ошибки",
                    error=str(exc)[:2000],
                    finished=True,
                )
                db.commit()
            logger.exception("YouTube monitoring run failed for topic %s", topic_id)


@router.post("/topics/{topic_id}/run", status_code=202)
def run_topic_endpoint(
    topic_id: int,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Annotated[Session, Depends(DbSession)],
    user_id: Annotated[str, Depends(user_scope)],
) -> dict[str, str]:
    topic = db.scalar(
        select(MonitoringTopic).where(
            MonitoringTopic.id == topic_id, MonitoringTopic.user_id == user_id
        )
    )
    if not topic:
        raise HTTPException(404, "Тема мониторинга не найдена")
    if topic.run_status in {"queued", "running"}:
        return {"status": topic.run_status, "message": "Проверка уже выполняется"}

    topic.run_status = "queued"
    topic.run_stage = "queued"
    topic.run_progress = 5
    topic.run_message = "Проверка поставлена в очередь"
    topic.run_error = None
    topic.run_started_at = datetime.now(UTC)
    topic.run_finished_at = None
    db.commit()
    settings = getattr(request.app.state, "settings", None) or get_settings()
    background_tasks.add_task(run_topic, topic_id, user_id, settings)
    return {"status": "queued", "message": "Проверка поставлена в очередь"}
