"""ReelAnalysis ORM model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database.base import Base, TimestampMixin
from app.database.types import UTCDateTime
from app.models.enums import ReelAnalysisStatus

if TYPE_CHECKING:
    from app.models.reel import Reel
    from app.models.reel_transcription import ReelTranscription


class ReelAnalysis(TimestampMixin, Base):
    """OpenRouter analysis result for a reel transcription."""

    __tablename__ = "reel_analyses"
    __table_args__ = (
        UniqueConstraint("reel_id", name="uq_reel_analyses_reel_id"),
        Index("ix_reel_analyses_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reel_id: Mapped[int] = mapped_column(
        ForeignKey("reels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,
    )
    transcription_id: Mapped[int] = mapped_column(
        ForeignKey("reel_transcriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[ReelAnalysisStatus] = mapped_column(
        String(32),
        nullable=False,
        default=ReelAnalysisStatus.QUEUED,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="openrouter")
    requested_model: Mapped[str] = mapped_column(String(128), nullable=False)
    resolved_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    source_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    russian_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    hook_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    main_part_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    conclusion_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    cta_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    suggested_hook: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_cta: Mapped[str | None] = mapped_column(Text, nullable=True)

    usage_prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_reasoning_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    provider_request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    reel: Mapped[Reel] = relationship(back_populates="analysis")
    transcription: Mapped[ReelTranscription] = relationship(back_populates="analysis")

    def __repr__(self) -> str:
        return f"<ReelAnalysis id={self.id} reel_id={self.reel_id} status={self.status!r}>"
