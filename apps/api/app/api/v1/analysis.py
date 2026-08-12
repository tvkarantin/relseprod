"""Reel Analysis endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Response, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.core.errors import InvalidAnalysisStateError
from app.models.enums import ReelAnalysisStatus
from app.models.reel_analysis import ReelAnalysis
from app.schemas.analysis import ReelAnalysisSegment, ReelAnalysisUsage, ReelAnalysisView
from app.schemas.reel import CreatorProfile
from app.services.reel_analysis import ReelAnalysisService
from app.tasks.analyze_reel import analyze_reel_task

router = APIRouter(prefix="/reels/{reel_id}/analysis", tags=["analysis"])

ReelId = Annotated[int, Path(gt=0, description="Идентификатор рилса")]


def _to_view(a: ReelAnalysis) -> ReelAnalysisView:
    usage = None
    if a.usage_prompt_tokens is not None or a.usage_total_tokens is not None:
        usage = ReelAnalysisUsage(
            prompt_tokens=a.usage_prompt_tokens,
            completion_tokens=a.usage_completion_tokens,
            reasoning_tokens=a.usage_reasoning_tokens,
            total_tokens=a.usage_total_tokens,
        )

    def _map_segment(raw: dict[str, Any] | None) -> ReelAnalysisSegment | None:
        if not raw:
            return None
        return ReelAnalysisSegment(
            text=raw.get("text", ""),
            source_utterance_indexes=raw.get("sourceUtteranceIndexes", []),
            start=float(raw.get("start", 0.0)),
            end=float(raw.get("end", 0.0)),
        )

    main_part = []
    if a.main_part_json:
        mapped = [_map_segment(s) for s in a.main_part_json if s]
        main_part = [m for m in mapped if m is not None]

    return ReelAnalysisView(
        id=a.id,
        reel_id=a.reel_id,
        transcription_id=a.transcription_id,
        status=a.status,
        provider=a.provider,
        requested_model=a.requested_model,
        resolved_model=a.resolved_model,
        prompt_version=a.prompt_version,
        source_language=a.source_language,
        russian_transcript=a.russian_transcript,
        title=a.title,
        topic=a.topic,
        summary=a.summary,
        hook=_map_segment(a.hook_json),
        main_part=main_part,
        conclusion=_map_segment(a.conclusion_json),
        cta=_map_segment(a.cta_json),
        suggested_hook=a.suggested_hook,
        suggested_script=a.suggested_script,
        suggested_cta=a.suggested_cta,
        usage=usage,
        error_code=a.error_code,
        error_message=a.error_message,
        started_at=a.started_at,
        completed_at=a.completed_at,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


def _profile_payload(profile: CreatorProfile | None) -> dict[str, Any] | None:
    return profile.model_dump(mode="json") if profile is not None else None


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запустить AI-анализ рилса",
)
def start_analysis(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
    settings: Annotated[Settings, Depends(get_settings)],
    background_tasks: BackgroundTasks,
    profile: CreatorProfile | None = None,
) -> Response:
    creator_profile = _profile_payload(profile)
    service = ReelAnalysisService(db, settings)
    analysis = service.create_or_retry_analysis(reel_id, creator_profile)

    background_tasks.add_task(
        analyze_reel_task,
        analysis.id,
        settings,
        creator_profile,
    )
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/retry",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Повторить AI-анализ рилса",
)
def retry_analysis(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
    settings: Annotated[Settings, Depends(get_settings)],
    background_tasks: BackgroundTasks,
    profile: CreatorProfile | None = None,
) -> Response:
    service = ReelAnalysisService(db, settings)

    analysis = service.get_analysis_by_reel(reel_id)
    if not analysis or analysis.status != ReelAnalysisStatus.FAILED:
        raise InvalidAnalysisStateError("Повторный запуск разрешен только для неудачного анализа")

    creator_profile = _profile_payload(profile)
    analysis = service.create_or_retry_analysis(reel_id, creator_profile)
    background_tasks.add_task(
        analyze_reel_task,
        analysis.id,
        settings,
        creator_profile,
    )
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.get(
    "",
    response_model=ReelAnalysisView | None,
    summary="Получить статус и результат анализа",
)
def get_analysis(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
) -> ReelAnalysisView | None:
    service = ReelAnalysisService(db)
    analysis = service.get_analysis_by_reel(reel_id)
    if not analysis:
        return None
    return _to_view(analysis)
