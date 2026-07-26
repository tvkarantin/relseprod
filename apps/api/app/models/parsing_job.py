"""ParsingJob ORM model — one Apify parsing run for a competitor."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin
from app.database.types import UTCDateTime
from app.models.enums import ParsingJobStatus

if TYPE_CHECKING:
    from app.models.competitor import Competitor


class ParsingJob(CreatedAtMixin, Base):
    """A parsing job tracking the import of reels for one competitor."""

    __tablename__ = "parsing_jobs"
    __table_args__ = (
        Index("ix_parsing_jobs_competitor_id", "competitor_id"),
        Index("ix_parsing_jobs_status", "status"),
        Index("ix_parsing_jobs_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    competitor_id: Mapped[int] = mapped_column(
        ForeignKey("competitors.id", ondelete="CASCADE"),
        nullable=False,
    )
    apify_run_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    status: Mapped[ParsingJobStatus] = mapped_column(
        SAEnum(
            ParsingJobStatus,
            name="parsing_job_status",
            native_enum=False,
            length=16,
            validate_strings=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=ParsingJobStatus.QUEUED,
        server_default=ParsingJobStatus.QUEUED.value,
    )
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reels_created: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    reels_updated: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    competitor: Mapped[Competitor] = relationship(back_populates="parsing_jobs")

    @property
    def is_active(self) -> bool:
        """Whether the job is still queued or running."""
        return self.status in ParsingJobStatus.active_statuses()

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<ParsingJob id={self.id} competitor_id={self.competitor_id} status={self.status}>"
