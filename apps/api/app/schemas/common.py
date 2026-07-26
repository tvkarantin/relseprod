"""Schemas shared across endpoints (health, root, error envelope)."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.core.errors import ErrorCode
from app.schemas.base import APIModel


class ServiceInfo(APIModel):
    """Response of ``GET /``."""

    name: str
    version: str
    docs: str


class HealthResponse(APIModel):
    """Response of ``GET /health``."""

    status: str = Field(examples=["ok"])
    database: str = Field(examples=["connected"])


class DashboardSummary(APIModel):
    """Real counters shown on the dashboard (no analytics, no trends)."""

    competitors_count: int = Field(ge=0)
    reels_count: int = Field(ge=0)
    ideas_count: int = Field(ge=0)
    scripts_count: int = Field(ge=0)
    ready_count: int = Field(ge=0)
    active_jobs_count: int = Field(ge=0)


class ErrorDetail(APIModel):
    """Body of the unified error envelope."""

    code: ErrorCode
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(APIModel):
    """Unified error response returned by every failing endpoint."""

    error: ErrorDetail
