"""Competitor API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.models.enums import CompetitorStatus
from app.schemas.base import APIModel

PROFILE_MAX_LENGTH = 500


class CompetitorCreate(APIModel):
    """Payload used to start tracking a competitor.

    ``profile`` accepts a username, ``@username`` or any Instagram profile URL;
    it is normalized by :func:`app.services.instagram.normalize_instagram_profile`.
    """

    profile: str = Field(
        min_length=1,
        max_length=PROFILE_MAX_LENGTH,
        description="Instagram username, @username или ссылка на профиль",
        examples=["@example", "https://www.instagram.com/example/"],
    )

    @field_validator("profile")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            msg = "profile must not be empty"
            raise ValueError(msg)
        return value


class CompetitorUpdate(APIModel):
    """Partial update of a tracked competitor."""

    status: CompetitorStatus | None = None
    reels_count: int | None = Field(default=None, ge=0)
    last_parsed_at: datetime | None = None


class CompetitorRead(APIModel):
    """Competitor representation returned by the API."""

    id: int
    active_job_id: int | None = Field(default=None, gt=0)
    latest_job_id: int | None = Field(default=None, gt=0)
    instagram_username: str = Field(max_length=30)
    profile_url: str = Field(max_length=PROFILE_MAX_LENGTH)
    status: CompetitorStatus
    reels_count: int = Field(ge=0)
    last_parsed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CompetitorBrief(APIModel):
    """Compact competitor used inside reel payloads."""

    id: int
    instagram_username: str = Field(max_length=30)
    profile_url: str = Field(max_length=PROFILE_MAX_LENGTH)


class CompetitorList(APIModel):
    """Paginated collection of competitors."""

    items: list[CompetitorRead]
    total: int = Field(ge=0)
