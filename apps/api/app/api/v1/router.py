"""API v1 router.

Only infrastructure endpoints exist at this stage. Feature routers (competitors,
reels, parsing jobs) will be included here in the next stage.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import __version__
from app.api.deps import DbSession, check_database
from app.schemas.common import HealthResponse, ServiceInfo

api_router = APIRouter()


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
