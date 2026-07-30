"""ReelTranscription ORM model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database.base import Base, TimestampMixin
from app.database.types import UTCDateTime
from app.models.enums import TranscriptionStatus

if TYPE_CHECKING:
    from app.models.reel import Reel
    from app.models.reel_analysis import ReelAnalysis


class ReelTranscription(TimestampMixin, Base):
    """Deepgram speech transcription result for a reel."""

    __tablename__ = "reel_transcriptions"
    __table_args__ = (
        UniqueConstraint("reel_id", name="uq_reel_transcriptions_reel_id"),
        Index("ix_reel_transcriptions_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reel_id: Mapped[int] = mapped_column(
        ForeignKey("reels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,
    )

    status: Mapped[TranscriptionStatus] = mapped_column(
        String(32),
        nullable=False,
        default=TranscriptionStatus.QUEUED,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="deepgram")
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    dominant_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    languages_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    words_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    utterances_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    paragraphs_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)

    provider_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_duration: Mapped[float | None] = mapped_column(Float, nullable=True)

    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    reel: Mapped[Reel] = relationship(back_populates="transcription")
    analysis: Mapped[ReelAnalysis | None] = relationship(
        back_populates="transcription",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ReelTranscription id={self.id} reel_id={self.reel_id} status={self.status!r}>"
