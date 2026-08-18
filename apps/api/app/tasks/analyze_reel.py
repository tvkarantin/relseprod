"""Background task for translating and analyzing a Reel transcript."""

import logging
from typing import Any

from app.core.config import Settings
from app.core.errors import AppError, ErrorCode, InternalError
from app.database.session import get_session_factory
from app.models.reel_analysis import ReelAnalysis
from app.models.reel_transcription import ReelTranscription
from app.services.openrouter import OpenRouterService
from app.services.reel_analysis import ReelAnalysisService

logger = logging.getLogger(__name__)


def analyze_reel_task(
    analysis_id: int,
    settings: Settings,
    creator_profile: dict[str, Any] | None = None,
    apply_to_content: bool = False,
) -> None:
    session = get_session_factory(settings)()
    service = ReelAnalysisService(session, settings)
    ai_client = OpenRouterService(settings)

    try:
        service.mark_processing(analysis_id)

        analysis = session.get(ReelAnalysis, analysis_id)
        if not analysis:
            return

        transcription = session.get(ReelTranscription, analysis.transcription_id)
        if not transcription:
            service.mark_failed(
                analysis_id, ErrorCode.TRANSCRIPTION_NOT_FOUND, "Транскрибация не найдена"
            )
            return

        utterances = transcription.utterances_json or []
        normalized_utterances: list[dict[str, Any]] = []
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
                    "end": transcription.provider_duration or 0.0,
                    "text": transcription.transcript,
                }
            ]

        result = ai_client.analyze_transcription(
            transcript=transcription.transcript or "",
            utterances=normalized_utterances,
            detected_language=transcription.dominant_language,
            duration=transcription.provider_duration,
            creator_profile=creator_profile,
        )

        service.save_result(
            analysis_id,
            result,
            normalized_utterances,
            apply_to_content=apply_to_content,
        )

    except AppError as exc:
        logger.warning("Analysis failed with expected error %s: %s", exc.code, exc.message)
        try:
            service.mark_failed(analysis_id, exc.code, exc.message)
        except Exception as inner_exc:
            logger.exception("Failed to mark analysis as failed", exc_info=inner_exc)
    except Exception as exc:
        logger.exception("Analysis failed with unexpected error", exc_info=exc)
        try:
            service.mark_failed(analysis_id, InternalError.code, InternalError.message)
        except Exception as inner_exc:
            logger.exception("Failed to mark analysis as failed", exc_info=inner_exc)
    finally:
        ai_client.close()
        session.close()
