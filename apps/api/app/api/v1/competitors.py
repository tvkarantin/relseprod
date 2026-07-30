"""Competitor endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Request, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.repositories.jobs import ParsingJobRepository
from app.schemas.common import ErrorResponse
from app.schemas.competitor import CompetitorCreate, CompetitorRead
from app.schemas.parsing_job import ParsingJobStart
from app.services.competitors import CompetitorService
from app.services.parsing import ParsingService
from app.tasks.parse_competitor import parse_competitor_job

if TYPE_CHECKING:
    from app.models.competitor import Competitor

router = APIRouter(prefix="/competitors", tags=["competitors"])

CompetitorId = Annotated[int, Path(gt=0, description="Идентификатор конкурента")]


def _settings(request: Request) -> Settings:
    """Settings of the running application (falls back to the cached ones)."""
    return getattr(request.app.state, "settings", None) or get_settings()


def _read_competitor(
    competitor: Competitor,
    *,
    active_job_id: int | None = None,
) -> CompetitorRead:
    """Serialize a competitor together with the job the UI should poll."""
    return CompetitorRead.model_validate(competitor).model_copy(
        update={"active_job_id": active_job_id}
    )


@router.get(
    "",
    response_model=list[CompetitorRead],
    summary="Список конкурентов",
)
def list_competitors(db: Annotated[Session, Depends(DbSession)]) -> list[CompetitorRead]:
    """Return every tracked competitor, newest first."""
    competitors = CompetitorService(db).list_competitors()
    active_jobs = ParsingJobRepository(db).get_active_for_competitors(
        [item.id for item in competitors]
    )
    return [
        _read_competitor(
            item,
            active_job_id=active_jobs[item.id].id if item.id in active_jobs else None,
        )
        for item in competitors
    ]


@router.post(
    "",
    response_model=CompetitorRead,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить конкурента",
    responses={
        409: {"model": ErrorResponse, "description": "Конкурент уже добавлен"},
        422: {"model": ErrorResponse, "description": "Некорректный профиль Instagram"},
    },
)
def create_competitor(
    payload: CompetitorCreate,
    db: Annotated[Session, Depends(DbSession)],
) -> CompetitorRead:
    """Normalize the submitted profile and start tracking it."""
    competitor = CompetitorService(db).add_competitor(payload.profile)
    return _read_competitor(competitor)


@router.get(
    "/{competitor_id}",
    response_model=CompetitorRead,
    summary="Получить конкурента",
    responses={404: {"model": ErrorResponse, "description": "Конкурент не найден"}},
)
def get_competitor(
    competitor_id: CompetitorId,
    db: Annotated[Session, Depends(DbSession)],
) -> CompetitorRead:
    """Return a single competitor."""
    competitor = CompetitorService(db).get_competitor(competitor_id)
    active_job = ParsingJobRepository(db).get_active_for_competitor(competitor.id)
    return _read_competitor(
        competitor,
        active_job_id=active_job.id if active_job is not None else None,
    )


@router.delete(
    "/{competitor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить конкурента",
    responses={
        404: {"model": ErrorResponse, "description": "Конкурент не найден"},
        409: {"model": ErrorResponse, "description": "Выполняется импорт"},
    },
)
def delete_competitor(
    competitor_id: CompetitorId,
    db: Annotated[Session, Depends(DbSession)],
) -> None:
    """Delete a competitor together with its reels, content and jobs."""
    CompetitorService(db).delete_competitor(competitor_id)


@router.post(
    "/{competitor_id}/parse",
    response_model=ParsingJobStart,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запустить импорт рилсов",
    responses={
        404: {"model": ErrorResponse, "description": "Конкурент не найден"},
        409: {"model": ErrorResponse, "description": "Импорт уже выполняется"},
    },
)
def start_parsing(
    competitor_id: CompetitorId,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Annotated[Session, Depends(DbSession)],
) -> ParsingJobStart:
    """Queue an import and return immediately.

    The Apify call happens in a background task, so this request never waits for
    the Actor to finish.
    """
    settings = _settings(request)
    job = ParsingService(db, settings=settings).create_job(competitor_id)
    background_tasks.add_task(parse_competitor_job, job.id, settings)
    return ParsingJobStart(job_id=job.id, status=job.status)
