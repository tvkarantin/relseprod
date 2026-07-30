"""Speech transcription endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.models.reel_transcription import ReelTranscription
from app.schemas.common import ErrorResponse
from app.schemas.transcription import (
    TranscriptionParagraph,
    TranscriptionUtterance,
    TranscriptionView,
    TranscriptionWord,
)
from app.services.transcriptions import TranscriptionService
from app.tasks.transcribe_reel import transcribe_reel_job

router = APIRouter(prefix="/reels/{reel_id}/transcription", tags=["transcription"])

ReelId = Annotated[int, Path(gt=0, description="Идентификатор рилса")]


def _to_view(t: ReelTranscription | None) -> TranscriptionView | None:
    if not t:
        return None
    return TranscriptionView(
        id=t.id,
        status=t.status,
        provider=t.provider,
        model=t.model,
        transcript=t.transcript,
        dominant_language=t.dominant_language,
        languages=t.languages_json,
        confidence=t.confidence,
        words=[TranscriptionWord(**w) for w in (t.words_json or [])],
        utterances=[
            TranscriptionUtterance(
                start=u.get("start", 0.0),
                end=u.get("end", 0.0),
                confidence=u.get("confidence", 0.0),
                channel=u.get("channel"),
                transcript=u.get("transcript", ""),
                speaker=u.get("speaker"),
                words=[TranscriptionWord(**ww) for ww in u.get("words", [])],
            )
            for u in (t.utterances_json or [])
        ],
        paragraphs=[
            TranscriptionParagraph(
                start=p.get("start", 0.0),
                end=p.get("end", 0.0),
                sentences=p.get("sentences", []),
                transcript=p.get("transcript", ""),
            )
            for p in (t.paragraphs_json or [])
        ],
        provider_request_id=t.provider_request_id,
        provider_duration=t.provider_duration,
        error_code=t.error_code,
        error_message=t.error_message,
        started_at=t.started_at,
        completed_at=t.completed_at,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get(
    "",
    response_model=TranscriptionView | None,
    summary="Получить статус и результат расшифровки",
    responses={404: {"model": ErrorResponse, "description": "Рилс не найден"}},
)
def get_transcription(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
) -> TranscriptionView | None:
    """Return current transcription state and result."""
    service = TranscriptionService(db)
    t = service.get_transcription(reel_id)
    return _to_view(t)


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=TranscriptionView,
    summary="Запустить расшифровку видео",
    responses={
        404: {"model": ErrorResponse, "description": "Рилс не найден"},
        409: {"model": ErrorResponse, "description": "Расшифровка уже выполняется"},
        422: {"model": ErrorResponse, "description": "Ссылка на видео недоступна"},
        503: {"model": ErrorResponse, "description": "Deepgram не настроен"},
    },
)
def start_transcription(
    reel_id: ReelId,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(DbSession)],
) -> TranscriptionView:
    """Create or reset transcription task and schedule background processing."""
    service = TranscriptionService(db)
    t = service.start_transcription(reel_id)
    background_tasks.add_task(transcribe_reel_job, t.id, service.settings)
    return _to_view(t)  # type: ignore[return-value]


@router.post(
    "/retry",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=TranscriptionView,
    summary="Повторить неудачную расшифровку",
    responses={
        404: {"model": ErrorResponse, "description": "Рилс или транскрибация не найдены"},
        409: {"model": ErrorResponse, "description": "Недопустимое состояние"},
        422: {"model": ErrorResponse, "description": "Ссылка на видео недоступна"},
    },
)
def retry_transcription(
    reel_id: ReelId,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(DbSession)],
) -> TranscriptionView:
    """Retry a failed transcription task."""
    service = TranscriptionService(db)
    t = service.retry_transcription(reel_id)
    background_tasks.add_task(transcribe_reel_job, t.id, service.settings)
    return _to_view(t)  # type: ignore[return-value]
