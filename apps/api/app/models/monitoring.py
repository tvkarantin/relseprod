"""YouTube monitoring persistence models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database.base import Base, CreatedAtMixin, TimestampMixin, utcnow
from app.database.types import UTCDateTime


class MonitoringTopic(TimestampMixin, Base):
    __tablename__ = "monitoring_topics"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_monitoring_topics_user_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="local-user")
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    negative_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    language: Mapped[str | None] = mapped_column(String(16))
    region_code: Mapped[str | None] = mapped_column(String(8))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    minimum_score: Mapped[int] = mapped_column(Integer, default=70, server_default="70")
    check_interval_hours: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    last_checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    run_status: Mapped[str] = mapped_column(String(16), default="idle", server_default="idle")
    run_stage: Mapped[str] = mapped_column(String(32), default="idle", server_default="idle")
    run_progress: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    run_message: Mapped[str | None] = mapped_column(String(500))
    run_error: Mapped[str | None] = mapped_column(Text)
    run_started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    run_finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    channels: Mapped[list[MonitoredChannel]] = relationship(
        back_populates="topic", cascade="all, delete-orphan"
    )
    videos: Mapped[list[TopicVideo]] = relationship(
        back_populates="topic", cascade="all, delete-orphan"
    )


class MonitoredChannel(TimestampMixin, Base):
    __tablename__ = "monitored_channels"
    __table_args__ = (
        UniqueConstraint("user_id", "channel_id", name="uq_monitored_channels_user_channel"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="local-user")
    monitoring_topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("monitoring_topics.id", ondelete="CASCADE")
    )
    platform: Mapped[str] = mapped_column(String(32), default="youtube", server_default="youtube")
    channel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    channel_url: Mapped[str] = mapped_column(String(500), nullable=False)
    channel_title: Mapped[str] = mapped_column(String(255), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2000))
    uploads_playlist_id: Mapped[str | None] = mapped_column(String(64))
    subscriber_count: Mapped[int | None] = mapped_column(Integer)
    last_checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    topic: Mapped[MonitoringTopic | None] = relationship(back_populates="channels")


class MonitoredVideo(TimestampMixin, Base):
    __tablename__ = "monitored_videos"
    __table_args__ = (
        UniqueConstraint("platform", "external_id", name="uq_monitored_videos_platform_external"),
        Index("ix_monitored_videos_published", "published_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String(32), default="youtube", server_default="youtube")
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    channel_id: Mapped[str] = mapped_column(String(64), index=True)
    channel_title: Mapped[str] = mapped_column(String(255))
    thumbnail_url: Mapped[str | None] = mapped_column(String(2000))
    published_at: Mapped[datetime] = mapped_column(UTCDateTime)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    content_type: Mapped[str] = mapped_column(
        String(16), default="unknown", server_default="unknown"
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    like_count: Mapped[int | None] = mapped_column(Integer)
    comment_count: Mapped[int | None] = mapped_column(Integer)
    views_per_hour: Mapped[float | None] = mapped_column(Float)
    engagement_rate: Mapped[float | None] = mapped_column(Float)
    relevance_score: Mapped[float | None] = mapped_column(Float)
    velocity_score: Mapped[float | None] = mapped_column(Float)
    engagement_score: Mapped[float | None] = mapped_column(Float)
    competitor_score: Mapped[float | None] = mapped_column(Float)
    ai_score: Mapped[float | None] = mapped_column(Float)
    final_score: Mapped[float | None] = mapped_column(Float)
    category: Mapped[str | None] = mapped_column(String(64))
    hook: Mapped[str | None] = mapped_column(Text)
    format: Mapped[str | None] = mapped_column(String(255))
    target_audience: Mapped[str | None] = mapped_column(String(255))
    why_it_works: Mapped[list[str] | None] = mapped_column(JSON)
    recommendation: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="new", server_default="new")
    first_detected_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_statistics_update_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    snapshots: Mapped[list[VideoStatisticsSnapshot]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )
    topics: Mapped[list[TopicVideo]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )


class TopicVideo(CreatedAtMixin, Base):
    __tablename__ = "monitoring_topic_videos"
    __table_args__ = (UniqueConstraint("topic_id", "video_id", name="uq_topic_video"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("monitoring_topics.id", ondelete="CASCADE"), index=True
    )
    video_id: Mapped[int] = mapped_column(
        ForeignKey("monitored_videos.id", ondelete="CASCADE"), index=True
    )
    is_relevant: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    notified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    topic: Mapped[MonitoringTopic] = relationship(back_populates="videos")
    video: Mapped[MonitoredVideo] = relationship(back_populates="topics")


class VideoStatisticsSnapshot(CreatedAtMixin, Base):
    __tablename__ = "video_statistics_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(
        ForeignKey("monitored_videos.id", ondelete="CASCADE"), index=True
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int | None] = mapped_column(Integer)
    comment_count: Mapped[int | None] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    video: Mapped[MonitoredVideo] = relationship(back_populates="snapshots")


class YouTubeQuotaLog(CreatedAtMixin, Base):
    __tablename__ = "youtube_quota_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operation: Mapped[str] = mapped_column(String(64))
    estimated_cost: Mapped[int] = mapped_column(Integer)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
