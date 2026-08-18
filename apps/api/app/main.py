"""FastAPI application factory and entrypoint.

The database schema is managed exclusively by Alembic — ``create_all()`` is
never called here.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import __version__
from app.api.deps import DbSession, check_database
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.schemas.common import ErrorResponse, HealthResponse, ServiceInfo

logger = logging.getLogger("app.main")

API_V1_PREFIX = "/api/v1"
VERCEL_CORS_ORIGIN_REGEX = r"^https://realsfinder(?:-[a-z0-9-]+)?\.vercel\.app$"

DESCRIPTION = """
Backend для Reels Finder — сервиса поиска и анализа Instagram Reels конкурентов.

Текущий этап: фундамент backend (конфигурация, база данных, модели, миграции,
единый формат ошибок и healthcheck). Интеграция с Apify, CRUD конкурентов и
импорт Reels будут добавлены на следующем этапе.
""".strip()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Log startup/shutdown without touching the database schema."""
    settings: Settings = app.state.settings
    logger.info(
        "Starting Reels Finder API (env=%s, apify_configured=%s, openrouter_configured=%s, openrouter_model=%s)",
        settings.app_env,
        settings.apify_configured,
        settings.openrouter_configured,
        settings.openrouter_model,
    )
    yield
    logger.info("Reels Finder API stopped")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Reels Finder API",
        description=DESCRIPTION,
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
        responses={
            422: {"model": ErrorResponse, "description": "Ошибка валидации"},
            500: {"model": ErrorResponse, "description": "Внутренняя ошибка"},
        },
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=VERCEL_CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type", "X-Requested-With"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=API_V1_PREFIX)

    @app.get("/", response_model=ServiceInfo, tags=["system"], summary="Информация о сервисе")
    def root() -> ServiceInfo:
        return ServiceInfo(name="Reels Finder API", version=__version__, docs="/docs")

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["system"],
        summary="Проверка состояния API и базы данных",
        responses={503: {"model": ErrorResponse, "description": "База данных недоступна"}},
    )
    def health(db: Annotated[Session, Depends(DbSession)]) -> HealthResponse:
        check_database(db)
        return HealthResponse(status="ok", database="connected")

    return app


app = create_app()
