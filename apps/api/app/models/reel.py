"""Reel ORM model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database.base import Base, TimestampMixin
from app.database.types import UTCDateTime

if TYPE_CHECKING:
    from app.models.competitor import Competitor
    from app.models.reel_content import ReelContent
    from app.models.reel_transcription import ReelTranscription


class Reel(TimestampMixin, Base):
    """A single Instagram reel imported for a competitor.

    Only metadata and remote URLs are stored — binary video/image payloads are
    never persisted in SQLite.

    ``instagram_id`` and ``shortcode`` are both nullable at the storage level,
    but the import business logic (next stage) must reject items where both are
    missing, since one of them is required to deduplicate reels.
    """

    __tablename__ = "reels"
    __table_args__ = (
        UniqueConstraint("competitor_id", "shortcode", name="uq_reels_competitor_shortcode"),
        Index("ix_reels_competitor_instagram_id", "competitor_id", "instagram_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    competitor_id: Mapped[int] = mapped_column(
        ForeignKey("competitors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    instagram_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    shortcode: Mapped[str | None] = mapped_column(String(64), nullable=True)
    original_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)

    views_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    duration: Mapped[float | None] = mapped_column(nullable=True)

    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    competitor: Mapped[Competitor] = relationship(back_populates="reels")
    content: Mapped[ReelContent | None] = relationship(
        back_populates="reel",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    transcription: Mapped[ReelTranscription | None] = relationship(
        back_populates="reel",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return (
            f"<Reel id={self.id} competitor_id={self.competitor_id} "
            f"shortcode={self.shortcode!r}>"
        )
