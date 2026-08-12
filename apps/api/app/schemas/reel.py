"""Reel API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.analysis import ReelAnalysisSummary
from app.schemas.base import APIModel
from app.schemas.competitor import CompetitorBrief
from app.schemas.reel_content import ReelContentRead, ReelContentView
from app.schemas.transcription import TranscriptionSummary


class ViralScore(APIModel):
    """Explainable ranking signal shown to the user."""

    score: int = Field(ge=0, le=100)
    label: str
    primary_reason: str
    reasons: list[str]
    view_multiplier: float = Field(ge=0)
    engagement_rate: float = Field(ge=0)
    views_per_hour: float = Field(ge=0)


class CreatorProfile(APIModel):
    """Personal style constraints used by the automatic rewrite."""

    language: Literal["ru", "en"] = "ru"
    niche: str = Field(default="", max_length=200)
    target_audience: str = Field(default="", max_length=500)
    product: str = Field(default="", max_length=500)
    tone_of_voice: str = Field(default="Спокойный и уверенный", max_length=500)
    video_length_seconds: int = Field(default=45, ge=10, le=300)
    address_form: str = Field(default="ты", pattern="^(ты|вы)$")
    profanity: str = Field(default="без мата", max_length=100)
    expertise: str = Field(default="практик", max_length=300)
    favorite_ctas: list[str] = Field(default_factory=list, max_length=10)


class AdaptationStarted(APIModel):
    reel_id: int
    content_status: str
    transcription_status: str | None = None
    message: str


class ReelBase(APIModel):
    """Fields shared by reel payloads."""

    instagram_id: str | None = Field(default=None, max_length=64)
    shortcode: str | None = Field(default=None, max_length=64)
    original_url: str | None = Field(default=None, max_length=1000)
    video_url: str | None = Field(default=None, max_length=2000)
    thumbnail_url: str | None = Field(default=None, max_length=2000)
    caption: str | None = None
    views_count: int | None = Field(default=None, ge=0)
    likes_count: int | None = Field(default=None, ge=0)
    comments_count: int | None = Field(default=None, ge=0)
    published_at: datetime | None = None
    duration: float | None = Field(default=None, ge=0)


class ReelCreate(ReelBase):
    """Payload used by the importer to persist a reel."""

    competitor_id: int = Field(gt=0)
    raw_data: dict[str, Any] | None = None


class ReelRead(ReelBase):
    """Reel representation used internally and by the importer tests.

    ``raw_data`` is deliberately not exposed: it holds the untrusted upstream
    payload and is only useful for debugging.
    """

    id: int
    competitor_id: int
    created_at: datetime
    updated_at: datetime
    content: ReelContentRead | None = None


class ReelView(ReelBase):
    """Reel as returned by the library endpoints."""

    id: int
    competitor: CompetitorBrief
    content: ReelContentView
    transcription: TranscriptionSummary | None = None
    analysis: ReelAnalysisSummary | None = None
    viral_score: ViralScore | None = None


class ReelPage(APIModel):
    """One page of the reels library."""

    items: list[ReelView]
    page: int = Field(ge=1)
    limit: int = Field(ge=1)
    total: int = Field(ge=0)
    pages: int = Field(ge=0)


class ReelList(APIModel):
    """Simple collection of reels (kept for internal use)."""

    items: list[ReelRead]
    total: int = Field(ge=0)
