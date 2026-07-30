"""API schemas for reel analysis."""

from datetime import datetime

from app.models.enums import ReelAnalysisStatus
from app.schemas.base import APIModel


class ReelAnalysisSegment(APIModel):
    text: str
    source_utterance_indexes: list[int]
    start: float
    end: float


class ReelAnalysisUsage(APIModel):
    prompt_tokens: int | None
    completion_tokens: int | None
    reasoning_tokens: int | None
    total_tokens: int | None


class ReelAnalysisSummary(APIModel):
    id: int
    status: ReelAnalysisStatus
    topic: str | None = None
    error_code: str | None = None
    updated_at: datetime | None = None


class ReelAnalysisView(APIModel):
    id: int
    reel_id: int
    transcription_id: int
    status: ReelAnalysisStatus
    provider: str
    requested_model: str
    resolved_model: str | None = None
    prompt_version: str

    source_language: str | None = None
    russian_transcript: str | None = None
    title: str | None = None
    topic: str | None = None
    summary: str | None = None

    hook: ReelAnalysisSegment | None = None
    main_part: list[ReelAnalysisSegment] | None = None
    conclusion: ReelAnalysisSegment | None = None
    cta: ReelAnalysisSegment | None = None

    suggested_hook: str | None = None
    suggested_script: str | None = None
    suggested_cta: str | None = None

    usage: ReelAnalysisUsage | None = None

    error_code: str | None = None
    error_message: str | None = None

    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
