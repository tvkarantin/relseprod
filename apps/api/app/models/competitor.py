"""Competitor ORM model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.database.types import UTCDateTime
from app.models.enums import CompetitorStatus

if TYPE_CHECKING:
    from app.models.parsing_job import ParsingJob
    from app.models.reel import Reel


class Competitor(TimestampMixin, Base):
    """An Instagram profile tracked by the user.

    ``instagram_username`` is always stored normalized: lowercase, without the
    leading ``@`` (see :func:`app.services.instagram.normalize_instagram_profile`).
    """

    __tablename__ = "competitors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instagram_username: Mapped[str] = mapped_column(
        String(30), nullable=False, unique=True, index=True
    )
    profile_url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[CompetitorStatus] = mapped_column(
        SAEnum(
            CompetitorStatus,
            name="competitor_status",
            native_enum=False,
            length=16,
            validate_strings=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=CompetitorStatus.IDLE,
        server_default=CompetitorStatus.IDLE.value,
    )
    reels_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    last_parsed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    reels: Mapped[list[Reel]] = relationship(
        back_populates="competitor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    parsing_jobs: Mapped[list[ParsingJob]] = relationship(
        back_populates="competitor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Competitor id={self.id} username={self.instagram_username!r}>"
