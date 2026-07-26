"""ReelContent API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

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


class ReelContentWrite(APIModel):
    """Full editor payload sent by ``PUT /reels/{id}/content``.

    The editor always submits every field, so strings (including empty ones)
    are used instead of ``None``: the API and the UI share one representation
    of "no text". Line breaks and leading whitespace are preserved verbatim —
    only a trailing newline run is normalized away.
    """

    hook: str = Field(default="", max_length=HOOK_MAX_LENGTH)
    script: str = Field(default="", max_length=SCRIPT_MAX_LENGTH)
    cta: str = Field(default="", max_length=CTA_MAX_LENGTH)
    notes: str = Field(default="", max_length=NOTES_MAX_LENGTH)
    content_status: ContentStatus = ContentStatus.NEW

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
        # Never strip user text: newlines and indentation are meaningful.
        str_strip_whitespace=False,
        validate_assignment=True,
    )


class ReelContentSaved(APIModel):
    """Response of ``PUT /reels/{id}/content``."""

    reel_id: int
    hook: str
    script: str
    cta: str
    notes: str
    content_status: ContentStatus
    updated_at: datetime


class ReelContentView(APIModel):
    """Content as embedded into reel payloads (always strings, never null)."""

    hook: str = ""
    script: str = ""
    cta: str = ""
    notes: str = ""
    content_status: ContentStatus = ContentStatus.NEW
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ReelContentRead(ReelContentBase):
    """Content representation returned by the API."""

    id: int
    reel_id: int
    content_status: ContentStatus
    created_at: datetime
    updated_at: datetime
