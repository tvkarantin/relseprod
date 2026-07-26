"""Parsing job endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Request, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.schemas.common import ErrorResponse
from app.schemas.parsing_job import ParsingJobRead, ParsingJobStart
from app.services.parsing import ParsingService
from app.tasks.parse_competitor import parse_competitor_job

router = APIRouter(prefix="/jobs", tags=["jobs"])

JobId = Annotated[int, Path(gt=0, description="Идентификатор задачи импорта")]


def _settings(request: Request) -> Settings:
    """Settings of the running application (falls back to the cached ones)."""
    return getattr(request.app.state, "settings", None) or get_settings()


@router.get(
    "/{job_id}",
    response_model=ParsingJobRead,
    summary="Состояние задачи импорта",
    responses={404: {"model": ErrorResponse, "description": "Задача не найдена"}},
)
def get_job(
    job_id: JobId,
    db: Annotated[Session, Depends(DbSession)],
) -> ParsingJobRead:
    """Return the current state of a parsing job."""
    job = ParsingService(db).get_job(job_id)
    return ParsingJobRead.model_validate(job)


@router.post(
    "/{job_id}/retry",
    response_model=ParsingJobStart,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Повторить неудачную задачу",
    responses={
        404: {"model": ErrorResponse, "description": "Задача не найдена"},
        409: {
            "model": ErrorResponse,
            "description": "Задача не в статусе failed или уже есть активная задача",
        },
    },
)
def retry_job(
    job_id: JobId,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Annotated[Session, Depends(DbSession)],
) -> ParsingJobStart:
    """Create and queue a new job replaying a failed one.

    The original job is left untouched so the failure remains auditable.
    """
    settings = _settings(request)
    retry = ParsingService(db, settings=settings).create_retry_job(job_id)
    background_tasks.add_task(parse_competitor_job, retry.id, settings)
    return ParsingJobStart(job_id=retry.id, status=retry.status)
