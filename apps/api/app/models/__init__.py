"""ORM models.

Importing this package registers every model on ``Base.metadata`` which is what
Alembic autogenerate relies on.
"""

from app.database.base import Base
from app.models.competitor import Competitor
from app.models.enums import CompetitorStatus, ContentStatus, ParsingJobStatus
from app.models.parsing_job import ParsingJob
from app.models.reel import Reel
from app.models.reel_content import ReelContent

__all__ = [
    "Base",
    "Competitor",
    "CompetitorStatus",
    "ContentStatus",
    "ParsingJob",
    "ParsingJobStatus",
    "Reel",
    "ReelContent",
]
