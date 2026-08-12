"""API v1 router: infrastructure endpoints plus the feature routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import __version__
from app.api.deps import DbSession, check_database
from app.api.v1 import analysis, auth, competitors, dashboard, jobs, monitoring, reels, transcriptions
from app.schemas.common import HealthResponse, ServiceInfo

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(competitors.router)
api_router.include_router(jobs.router)
api_router.include_router(reels.router)
api_router.include_router(transcriptions.router)
api_router.include_router(analysis.router)
api_router.include_router(dashboard.router)
api_router.include_router(monitoring.router)


@api_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Проверка состояния API и базы данных",
    tags=["system"],
)
def health(db: Annotated[Session, Depends(DbSession)]) -> HealthResponse:
    """Execute ``SELECT 1`` against the database and report the result."""
    check_database(db)
    return HealthResponse(status="ok", database="connected")


@api_router.get(
    "/info",
    response_model=ServiceInfo,
    summary="Информация о сервисе",
    tags=["system"],
)
def info() -> ServiceInfo:
    """Return service name, version and docs location."""
    return ServiceInfo(name="Reels Finder API", version=__version__, docs="/docs")
