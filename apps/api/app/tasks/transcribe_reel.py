"""Background execution of a speech transcription task."""

from __future__ import annotations

import logging

from app.core.config import Settings, get_settings
from app.core.errors import AppError, DeepgramRequestFailedError
from app.database.session import get_session_factory
from app.models.reel import Reel
from app.models.reel_transcription import ReelTranscription
from app.services.deepgram import DeepgramService
from app.services.media_refresh import refresh_reel_media
from app.services.transcriptions import TranscriptionService

logger = logging.getLogger(__name__)


def transcribe_reel_job(transcription_id: int, settings: Settings | None = None) -> None:
    """Run the Deepgram transcription pipeline for ``transcription_id``."""
    active_settings = settings or get_settings()
    session = get_session_factory(active_settings)()
    deepgram = DeepgramService(active_settings)

    try:
        service = TranscriptionService(session, settings=active_settings)
        transcription = session.get(ReelTranscription, transcription_id)
        if not transcription:
            logger.warning("Transcription task %s not found", transcription_id)
            return

        reel = session.get(Reel, transcription.reel_id)
        if not reel or not reel.video_url:
            logger.warning("Transcription task %s missing reel or video URL", transcription_id)
            return

        service.mark_processing(transcription_id)
        try:
            result = deepgram.transcribe_url(reel.video_url)
        except DeepgramRequestFailedError as exc:
            if exc.details.get("providerCode") != "REMOTE_CONTENT_ERROR":
                raise
            logger.info(
                "Refreshing expired Instagram media URL for transcription task %s",
                transcription_id,
            )
            fresh_media_url = refresh_reel_media(session, reel, active_settings)
            result = deepgram.transcribe_url(fresh_media_url)
        service.save_success(transcription_id, result)
        logger.info("Transcription task %s completed successfully", transcription_id)
    except AppError as exc:
        logger.warning(
            "Transcription task %s failed with AppError: %s (%s)",
            transcription_id,
            exc.code,
            exc.message,
        )
        service = TranscriptionService(session, settings=active_settings)
        service.save_error(transcription_id, str(exc.code), exc.message)
    except Exception:
        logger.warning("Transcription task %s failed with unexpected error", transcription_id)
        service = TranscriptionService(session, settings=active_settings)
        service.save_error(
            transcription_id,
            "DEEPGRAM_REQUEST_FAILED",
            "Ошибка при обработке расшифровки",
        )
    finally:
        deepgram.close()
        session.close()
