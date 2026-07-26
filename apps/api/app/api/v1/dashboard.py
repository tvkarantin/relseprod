"""Dashboard counters."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.schemas.common import DashboardSummary
from app.services.reel_content import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Реальные счётчики по базе",
)
def dashboard_summary(db: Annotated[Session, Depends(DbSession)]) -> DashboardSummary:
    """Return plain ``COUNT`` values — not analytics."""
    return DashboardSummary(**DashboardService(db).summary())
