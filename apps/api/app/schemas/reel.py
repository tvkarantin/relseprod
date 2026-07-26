"""Reel API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.base import APIModel
from app.schemas.reel_content import ReelContentRead


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
    """Reel representation returned by the API.

    ``raw_data`` is deliberately not exposed: it holds the untrusted upstream
    payload and is only useful for debugging.
    """

    id: int
    competitor_id: int
    created_at: datetime
    updated_at: datetime
    content: ReelContentRead | None = None


class ReelList(APIModel):
    """Paginated collection of reels."""

    items: list[ReelRead]
    total: int = Field(ge=0)
