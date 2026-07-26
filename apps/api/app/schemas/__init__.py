"""Pydantic request/response schemas."""

from app.schemas.base import APIModel
from app.schemas.common import ErrorDetail, ErrorResponse, HealthResponse, ServiceInfo
from app.schemas.competitor import (
    CompetitorCreate,
    CompetitorList,
    CompetitorRead,
    CompetitorUpdate,
)
from app.schemas.parsing_job import ParsingJobList, ParsingJobRead
from app.schemas.reel import ReelCreate, ReelList, ReelRead
from app.schemas.reel_content import ReelContentRead, ReelContentUpdate

__all__ = [
    "APIModel",
    "CompetitorCreate",
    "CompetitorList",
    "CompetitorRead",
    "CompetitorUpdate",
    "ErrorDetail",
    "ErrorResponse",
    "HealthResponse",
    "ParsingJobList",
    "ParsingJobRead",
    "ReelContentRead",
    "ReelContentUpdate",
    "ReelCreate",
    "ReelList",
    "ReelRead",
    "ServiceInfo",
]
