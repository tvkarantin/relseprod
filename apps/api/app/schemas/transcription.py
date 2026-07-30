"""Transcription API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.base import APIModel


class TranscriptionWord(APIModel):
    word: str
    punctuated_word: str | None = None
    start: float = 0.0
    end: float = 0.0
    confidence: float = 0.0
    language: str | None = None
    speaker: int | None = None


class TranscriptionUtterance(APIModel):
    start: float = 0.0
    end: float = 0.0
    confidence: float = 0.0
    channel: int | None = None
    transcript: str = ""
    speaker: int | None = None
    words: list[TranscriptionWord] = Field(default_factory=list)


class TranscriptionParagraph(APIModel):
    start: float = 0.0
    end: float = 0.0
    sentences: list[Any] = Field(default_factory=list)
    transcript: str = ""


class TranscriptionSummary(APIModel):
    id: int
    status: str
    dominant_language: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    updated_at: datetime | None = None


class TranscriptionView(APIModel):
    id: int
    status: str
    provider: str
    model: str | None = None
    transcript: str | None = None
    dominant_language: str | None = None
    languages: list[str] | None = None
    confidence: float | None = None
    words: list[TranscriptionWord] | None = None
    utterances: list[TranscriptionUtterance] | None = None
    paragraphs: list[TranscriptionParagraph] | None = None
    provider_request_id: str | None = None
    provider_duration: float | None = None
    error_code: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
