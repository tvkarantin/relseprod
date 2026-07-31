"""Transcription service for managing ReelTranscription lifecycle."""

from __future__ import annotations

import dataclasses
import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import (
    ActiveTranscriptionAlreadyExistsError,
    InvalidTranscriptionStateError,
    ReelNotFoundError,
    ReelVideoUnavailableError,
    TranscriptionNotFoundError,
)
from app.models.enums import TranscriptionStatus
from app.models.reel import Reel
from app.models.reel_transcription import ReelTranscription
from app.services.deepgram import DeepgramTranscript

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Manages transcription creation, status queries, and state transitions."""

    def __init__(self, db: Session, settings: Settings | None = None) -> None:
        self.db = db
        self.settings = settings or get_settings()

    def get_reel(self, reel_id: int) -> Reel:
        reel = self.db.get(Reel, reel_id)
        if not reel:
            raise ReelNotFoundError(details={"reelId": reel_id})
        return reel

    def get_transcription(self, reel_id: int) -> ReelTranscription | None:
        self.get_reel(reel_id)
        return self.db.query(ReelTranscription).filter(ReelTranscription.reel_id == reel_id).first()

    def start_transcription(self, reel_id: int) -> ReelTranscription:
        reel = self.get_reel(reel_id)
        if not reel.video_url:
            raise ReelVideoUnavailableError(details={"reelId": reel_id})

        transcription = self.get_transcription(reel_id)
        if transcription:
            if transcription.status in {
                TranscriptionStatus.QUEUED,
                TranscriptionStatus.PROCESSING,
            }:
                raise ActiveTranscriptionAlreadyExistsError(
                    details={"reelId": reel_id, "status": transcription.status}
                )
            transcription.status = TranscriptionStatus.QUEUED
            transcription.provider = "deepgram"
            transcription.model = self.settings.deepgram_model
            transcription.transcript = None
            transcription.dominant_language = None
            transcription.languages_json = None
            transcription.confidence = None
            transcription.words_json = None
            transcription.utterances_json = None
            transcription.paragraphs_json = None
            transcription.provider_request_id = None
            transcription.provider_duration = None
            transcription.error_code = None
            transcription.error_message = None
            transcription.started_at = None
            transcription.completed_at = None
        else:
            transcription = ReelTranscription(
                reel_id=reel_id,
                status=TranscriptionStatus.QUEUED,
                provider="deepgram",
                model=self.settings.deepgram_model,
            )
            self.db.add(transcription)

        self.db.commit()
        self.db.refresh(transcription)
        return transcription

    def retry_transcription(self, reel_id: int) -> ReelTranscription:
        reel = self.get_reel(reel_id)
        if not reel.video_url:
            raise ReelVideoUnavailableError(details={"reelId": reel_id})

        transcription = self.get_transcription(reel_id)
        if not transcription:
            raise TranscriptionNotFoundError(details={"reelId": reel_id})

        if transcription.status != TranscriptionStatus.FAILED:
            raise InvalidTranscriptionStateError(
                "Повторить можно только неудачную (failed) транскрибацию",
                details={"reelId": reel_id, "status": transcription.status},
            )

        transcription.status = TranscriptionStatus.QUEUED
        transcription.transcript = None
        transcription.dominant_language = None
        transcription.languages_json = None
        transcription.confidence = None
        transcription.words_json = None
        transcription.utterances_json = None
        transcription.paragraphs_json = None
        transcription.provider_request_id = None
        transcription.provider_duration = None
        transcription.error_code = None
        transcription.error_message = None
        transcription.started_at = None
        transcription.completed_at = None

        self.db.commit()
        self.db.refresh(transcription)
        return transcription

    def mark_processing(self, transcription_id: int) -> ReelTranscription:
        t = self.db.get(ReelTranscription, transcription_id)
        if t:
            t.status = TranscriptionStatus.PROCESSING
            t.started_at = datetime.now(UTC)
            self.db.commit()
            self.db.refresh(t)
        return t  # type: ignore[return-value]

    def save_success(self, transcription_id: int, result: DeepgramTranscript) -> ReelTranscription:
        t = self.db.get(ReelTranscription, transcription_id)
        if t:
            t.status = TranscriptionStatus.COMPLETED
            t.completed_at = datetime.now(UTC)
            t.model = result.model
            t.transcript = result.transcript
            t.dominant_language = result.dominant_language
            t.languages_json = result.languages
            t.confidence = result.confidence
            t.words_json = [dataclasses.asdict(w) for w in result.words]
            t.utterances_json = [dataclasses.asdict(u) for u in result.utterances]
            t.paragraphs_json = [dataclasses.asdict(p) for p in result.paragraphs]
            t.provider_request_id = result.request_id
            t.provider_duration = result.duration
            t.error_code = None
            t.error_message = None
            self.db.commit()
            self.db.refresh(t)
        return t  # type: ignore[return-value]

    def save_error(
        self, transcription_id: int, error_code: str, error_message: str
    ) -> ReelTranscription:
        t = self.db.get(ReelTranscription, transcription_id)
        if t:
            t.status = TranscriptionStatus.FAILED
            t.completed_at = datetime.now(UTC)
            t.error_code = error_code
            t.error_message = error_message
            self.db.commit()
            self.db.refresh(t)
        return t  # type: ignore[return-value]
