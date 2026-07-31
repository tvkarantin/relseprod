"""Status enums shared by ORM models and API schemas."""

from __future__ import annotations

from enum import StrEnum


class CompetitorStatus(StrEnum):
    """Lifecycle of a tracked competitor profile."""

    IDLE = "idle"
    QUEUED = "queued"
    PARSING = "parsing"
    READY = "ready"
    ERROR = "error"


class ContentStatus(StrEnum):
    """Lifecycle of the user-authored content attached to a reel."""

    NEW = "new"
    IDEA = "idea"
    SCRIPT = "script"
    READY = "ready"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ParsingJobStatus(StrEnum):
    """Lifecycle of a parsing job."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

    @classmethod
    def active_statuses(cls) -> tuple[ParsingJobStatus, ...]:
        """Statuses that mean the job is not finished yet."""
        return (cls.QUEUED, cls.RUNNING)


class ReelImportMode(StrEnum):
    """How a parsing job chooses reels from the Apify candidate pool."""

    POPULAR = "popular"
    LATEST = "latest"


class TranscriptionStatus(StrEnum):
    """Lifecycle of a speech transcription task."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ReelAnalysisStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
