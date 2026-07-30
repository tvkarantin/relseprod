"""Reel Analysis service for orchestrating state transitions."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import (
    ActiveAnalysisAlreadyExistsError,
    AnalysisNotFoundError,
    InvalidAnalysisStateError,
    ReelNotFoundError,
    TranscriptionEmptyError,
    TranscriptionNotCompletedError,
    TranscriptionRequiredError,
)
from app.models.enums import ReelAnalysisStatus, TranscriptionStatus
from app.models.reel import Reel
from app.models.reel_analysis import ReelAnalysis
from app.services.openrouter import OpenRouterAnalysisResult

logger = logging.getLogger(__name__)


def _compute_input_hash(transcript: str, utterances: list[dict[str, Any]]) -> str:
    """Compute a stable hash of the input data."""
    data = {"t": transcript, "u": utterances}
    encoded = json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _calculate_segment_timecodes(segment: Any, utterances: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not segment:
        return None

    start_times = []
    end_times = []

    for idx in segment.source_utterance_indexes:
        # Find the utterance
        u = next((u for u in utterances if u.get("index") == idx), None)
        if u:
            if "start" in u:
                start_times.append(float(u["start"]))
            if "end" in u:
                end_times.append(float(u["end"]))

    start = min(start_times) if start_times else 0.0
    end = max(end_times) if end_times else 0.0

    return {
        "text": segment.text,
        "sourceUtteranceIndexes": segment.source_utterance_indexes,
        "start": start,
        "end": end,
    }


class ReelAnalysisService:
    def __init__(self, session: Session, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()

    def get_analysis_by_reel(self, reel_id: int) -> ReelAnalysis | None:
        stmt = select(ReelAnalysis).where(ReelAnalysis.reel_id == reel_id)
        return self.session.scalars(stmt).first()

    def create_or_retry_analysis(self, reel_id: int) -> ReelAnalysis:
        # 1. Verify Reel
        reel = self.session.get(Reel, reel_id)
        if not reel:
            raise ReelNotFoundError()

        # 2. Verify Transcription
        transcription = reel.transcription
        if not transcription:
            raise TranscriptionRequiredError()

        if transcription.status != TranscriptionStatus.COMPLETED:
            raise TranscriptionNotCompletedError()

        if not transcription.transcript or not transcription.transcript.strip():
            raise TranscriptionEmptyError()

        utterances = transcription.utterances_json or []
        # if no utterances, we will create one segment later, but for input hash we need it
        normalized_utterances = []
        if utterances:
            normalized_utterances = [
                {
                    "index": i,
                    "start": u.get("start", 0.0),
                    "end": u.get("end", 0.0),
                    "text": u.get("transcript", ""),
                }
                for i, u in enumerate(utterances)
            ]
        else:
            normalized_utterances = [
                {
                    "index": 0,
                    "start": 0.0,
                    "end": transcription.provider_duration or reel.duration or 0.0,
                    "text": transcription.transcript,
                }
            ]

        input_hash = _compute_input_hash(transcription.transcript, normalized_utterances)

        # 3. Check existing analysis
        analysis = self.get_analysis_by_reel(reel_id)
        if analysis:
            if analysis.status in (ReelAnalysisStatus.QUEUED, ReelAnalysisStatus.PROCESSING):
                raise ActiveAnalysisAlreadyExistsError()

            if (
                analysis.status == ReelAnalysisStatus.COMPLETED
                and analysis.input_hash == input_hash
            ):
                raise InvalidAnalysisStateError("Анализ уже успешно завершен для этой транскрибации")

            # If failed, or completed but input changed, we reset it
            analysis.status = ReelAnalysisStatus.QUEUED
            analysis.transcription_id = transcription.id
            analysis.requested_model = self.settings.openrouter_model
            analysis.prompt_version = "v1"
            analysis.input_hash = input_hash
            analysis.error_code = None
            analysis.error_message = None
            analysis.completed_at = None
        else:
            analysis = ReelAnalysis(
                reel_id=reel_id,
                transcription_id=transcription.id,
                status=ReelAnalysisStatus.QUEUED,
                requested_model=self.settings.openrouter_model,
                prompt_version="v1",
                input_hash=input_hash,
            )
            self.session.add(analysis)

        self.session.commit()
        return analysis

    def mark_processing(self, analysis_id: int) -> None:
        analysis = self.session.get(ReelAnalysis, analysis_id)
        if not analysis:
            raise AnalysisNotFoundError()
        if analysis.status != ReelAnalysisStatus.QUEUED:
            raise InvalidAnalysisStateError()

        analysis.status = ReelAnalysisStatus.PROCESSING
        analysis.started_at = datetime.now(UTC)
        self.session.commit()

    def save_result(
        self, analysis_id: int, result: OpenRouterAnalysisResult, utterances: list[dict[str, Any]]
    ) -> None:
        analysis = self.session.get(ReelAnalysis, analysis_id)
        if not analysis:
            raise AnalysisNotFoundError()

        analysis.status = ReelAnalysisStatus.COMPLETED
        analysis.completed_at = datetime.now(UTC)
        analysis.resolved_model = result.metadata.resolved_model
        analysis.provider_request_id = result.metadata.provider_request_id

        analysis.usage_prompt_tokens = result.metadata.usage.prompt_tokens
        analysis.usage_completion_tokens = result.metadata.usage.completion_tokens
        analysis.usage_reasoning_tokens = result.metadata.usage.reasoning_tokens
        analysis.usage_total_tokens = result.metadata.usage.total_tokens

        analysis.source_language = result.source_language
        analysis.russian_transcript = result.russian_transcript
        analysis.title = result.title
        analysis.topic = result.topic
        analysis.summary = result.summary

        hook_dict = _calculate_segment_timecodes(result.hook, utterances)
        analysis.hook_json = hook_dict

        main_part_list_raw = [_calculate_segment_timecodes(seg, utterances) for seg in result.main_part]
        main_part_clean: list[dict[str, Any]] = [x for x in main_part_list_raw if x is not None]
        analysis.main_part_json = main_part_clean

        conclusion_dict = _calculate_segment_timecodes(result.conclusion, utterances)
        analysis.conclusion_json = conclusion_dict

        cta_dict = _calculate_segment_timecodes(result.cta, utterances)
        analysis.cta_json = cta_dict

        # Suggested fields
        analysis.suggested_hook = result.hook.text if result.hook else ""
        analysis.suggested_cta = result.cta.text if result.cta else ""

        script_parts = []
        for p in result.main_part:
            script_parts.append(p.text)
        if result.conclusion:
            script_parts.append(result.conclusion.text)

        analysis.suggested_script = "\n\n".join(script_parts)

        self.session.commit()

    def mark_failed(self, analysis_id: int, error_code: str, error_message: str) -> None:
        analysis = self.session.get(ReelAnalysis, analysis_id)
        if not analysis:
            return

        analysis.status = ReelAnalysisStatus.FAILED
        analysis.completed_at = datetime.now(UTC)
        analysis.error_code = error_code
        analysis.error_message = error_message
        self.session.commit()
