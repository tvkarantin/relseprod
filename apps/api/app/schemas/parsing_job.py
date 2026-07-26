"""ParsingJob API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.models.enums import ParsingJobStatus
from app.schemas.base import APIModel


class ParsingJobRead(APIModel):
    """Parsing job representation returned by the API."""

    id: int
    competitor_id: int
    apify_run_id: str | None = Field(default=None, max_length=128)
    status: ParsingJobStatus
    progress: int = Field(ge=0, le=100)
    reels_created: int = Field(ge=0)
    reels_updated: int = Field(ge=0)
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class ParsingJobStart(APIModel):
    """Response returned when a job is queued (``202 Accepted``)."""

    job_id: int = Field(gt=0)
    status: ParsingJobStatus


class ParsingJobList(APIModel):
    """Collection of parsing jobs."""

    items: list[ParsingJobRead]
    total: int = Field(ge=0)
