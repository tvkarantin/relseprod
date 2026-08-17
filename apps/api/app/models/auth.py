"""Telegram-first authentication ORM models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, CreatedAtMixin, TimestampMixin
from app.database.types import UTCDateTime


class AppUser(TimestampMixin, Base):
    """A RealsFinder account linked to one Telegram user."""

    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, index=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str] = mapped_column(String(128), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    language_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    telegram_avatar_file_id: Mapped[str | None] = mapped_column(String(512), nullable=True)


class TelegramLoginChallenge(CreatedAtMixin, Base):
    """Short-lived one-time code created when a user presses /start in the bot."""

    __tablename__ = "telegram_login_challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str] = mapped_column(String(128), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    language_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    telegram_avatar_file_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class AuthSession(CreatedAtMixin, Base):
    """Long-lived browser session. Only a SHA-256 token hash is persisted."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
