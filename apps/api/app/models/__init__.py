"""ORM models.

Importing this package registers every model on ``Base.metadata`` which is what
Alembic autogenerate relies on.
"""

from app.database.base import Base
from app.models.auth import AppUser, AuthSession, TelegramLoginChallenge
from app.models.competitor import Competitor
from app.models.enums import (
    CompetitorStatus,
    ContentStatus,
    ParsingJobStatus,
    ReelImportMode,
    TranscriptionStatus,
)
from app.models.monitoring import (
    MonitoredChannel,
    MonitoredVideo,
    MonitoringTopic,
    TopicVideo,
    VideoStatisticsSnapshot,
    YouTubeQuotaLog,
)
from app.models.parsing_job import ParsingJob
from app.models.reel import Reel
from app.models.reel_analysis import ReelAnalysis
from app.models.reel_content import ReelContent
from app.models.reel_transcription import ReelTranscription

__all__ = [
    "AppUser",
    "AuthSession",
    "Base",
    "Competitor",
    "CompetitorStatus",
    "ContentStatus",
    "MonitoredChannel",
    "MonitoredVideo",
    "MonitoringTopic",
    "ParsingJob",
    "ParsingJobStatus",
    "Reel",
    "ReelAnalysis",
    "ReelContent",
    "ReelImportMode",
    "ReelTranscription",
    "TelegramLoginChallenge",
    "TopicVideo",
    "TranscriptionStatus",
    "VideoStatisticsSnapshot",
    "YouTubeQuotaLog",
]
