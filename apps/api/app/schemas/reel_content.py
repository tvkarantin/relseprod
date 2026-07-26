"""ReelContent API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.models.enums import ContentStatus
from app.schemas.base import APIModel, empty_to_none

HOOK_MAX_LENGTH = 500
SCRIPT_MAX_LENGTH = 10_000
CTA_MAX_LENGTH = 1_000
NOTES_MAX_LENGTH = 10_000


class ReelContentBase(APIModel):
    """User-authored script fields. Empty strings are normalized to ``None``."""

    hook: str | None = Field(default=None, max_length=HOOK_MAX_LENGTH)
    script: str | None = Field(default=None, max_length=SCRIPT_MAX_LENGTH)
    cta: str | None = Field(default=None, max_length=CTA_MAX_LENGTH)
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)

    @field_validator("hook", "script", "cta", "notes", mode="after")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return empty_to_none(value)


class ReelContentUpdate(ReelContentBase):
    """Partial update of the content attached to a reel."""

    content_status: ContentStatus | None = None


class ReelContentRead(ReelContentBase):
    """Content representation returned by the API."""

    id: int
    reel_id: int
    content_status: ContentStatus
    created_at: datetime
    updated_at: datetime
