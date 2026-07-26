"""ReelContent ORM model — user-authored script attached to a reel."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.enums import ContentStatus

if TYPE_CHECKING:
    from app.models.reel import Reel


class ReelContent(TimestampMixin, Base):
    """One-to-one user content for a reel.

    Convention for user text fields: ``NULL`` means "not filled in yet". Empty
    strings are normalized to ``NULL`` by the API schemas, so the whole project
    has a single representation of "no value".
    """

    __tablename__ = "reel_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reel_id: Mapped[int] = mapped_column(
        ForeignKey("reels.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    hook: Mapped[str | None] = mapped_column(Text, nullable=True)
    script: Mapped[str | None] = mapped_column(Text, nullable=True)
    cta: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    content_status: Mapped[ContentStatus] = mapped_column(
        SAEnum(
            ContentStatus,
            name="content_status",
            native_enum=False,
            length=16,
            validate_strings=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=ContentStatus.NEW,
        server_default=ContentStatus.NEW.value,
    )

    reel: Mapped[Reel] = relationship(back_populates="content")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<ReelContent id={self.id} reel_id={self.reel_id} status={self.content_status}>"
