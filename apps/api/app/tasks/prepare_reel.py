"""One-click transcription, translation, analysis and personalized rewrite."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.core.errors import ActiveAnalysisAlreadyExistsError, AppError, InvalidAnalysisStateError
from app.database.session import get_session_factory
from app.models.enums import TranscriptionStatus
from app.models.reel import Reel
from app.services.reel_analysis import ReelAnalysisService
from app.services.transcriptions import TranscriptionService
from app.tasks.analyze_reel import analyze_reel_task
from app.tasks.transcribe_reel import transcribe_reel_job

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.core.config import Settings


def prepare_reel_task(
    reel_id: int,
    settings: Settings,
    creator_profile: dict[str, Any] | None = None,
    *,
    apply_to_content: bool = True,
) -> None:
    """Run every preparation stage sequentially, safely reusing completed work.

    The task is intentionally self-starting: callers only need a reel id. A
    missing transcription is created, and a failed one is re-queued, before
    Deepgram and OpenRouter are invoked.
    """
    session_factory = get_session_factory(settings)
    session = session_factory()
    try:
        reel = session.get(Reel, reel_id)
        if reel is None:
            return

        transcription = reel.transcription
        transcription_service = TranscriptionService(session, settings)
        try:
            if transcription is None:
                transcription = transcription_service.start_transcription(reel_id)
            elif transcription.status == TranscriptionStatus.FAILED:
                transcription = transcription_service.retry_transcription(reel_id)
        except AppError as exc:
            logger.warning(
                "Could not queue automatic transcription for reel %s: %s",
                reel_id,
                exc.code,
            )
            return

        transcription_id = transcription.id
        transcription_status = transcription.status
    finally:
        session.close()

    if transcription_status == TranscriptionStatus.QUEUED:
        transcribe_reel_job(transcription_id, settings)

    session = session_factory()
    try:
        reel = session.get(Reel, reel_id)
        if (
            reel is None
            or reel.transcription is None
            or reel.transcription.status != TranscriptionStatus.COMPLETED
        ):
            return

        service = ReelAnalysisService(session, settings)
        try:
            analysis = service.create_or_retry_analysis(reel_id, creator_profile)
        except InvalidAnalysisStateError:
            if apply_to_content:
                service.apply_existing_result_to_content(reel_id)
            return
        except ActiveAnalysisAlreadyExistsError:
            return
        analysis_id = analysis.id
    except Exception:
        logger.exception("Could not start automatic reel analysis: reel_id=%s", reel_id)
        return
    finally:
        session.close()

    analyze_reel_task(
        analysis_id,
        settings,
        creator_profile=creator_profile,
        apply_to_content=apply_to_content,
    )
