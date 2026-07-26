"""Pydantic request/response schemas."""

from app.schemas.base import APIModel
from app.schemas.common import (
    DashboardSummary,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
    ServiceInfo,
)
from app.schemas.competitor import (
    CompetitorBrief,
    CompetitorCreate,
    CompetitorList,
    CompetitorRead,
    CompetitorUpdate,
)
from app.schemas.parsing_job import ParsingJobList, ParsingJobRead, ParsingJobStart
from app.schemas.reel import ReelCreate, ReelList, ReelPage, ReelRead, ReelView
from app.schemas.reel_content import (
    ReelContentRead,
    ReelContentSaved,
    ReelContentUpdate,
    ReelContentView,
    ReelContentWrite,
)

__all__ = [
    "APIModel",
    "CompetitorBrief",
    "CompetitorCreate",
    "CompetitorList",
    "CompetitorRead",
    "CompetitorUpdate",
    "DashboardSummary",
    "ErrorDetail",
    "ErrorResponse",
    "HealthResponse",
    "ParsingJobList",
    "ParsingJobRead",
    "ParsingJobStart",
    "ReelContentRead",
    "ReelContentSaved",
    "ReelContentUpdate",
    "ReelContentView",
    "ReelContentWrite",
    "ReelCreate",
    "ReelList",
    "ReelPage",
    "ReelRead",
    "ReelView",
    "ServiceInfo",
]
