"""Request and response schemas for Telegram-first authentication."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.base import APIModel


class AuthConfigResponse(APIModel):
    auth_required: bool
    telegram_enabled: bool
    bot_username: str | None = None
    bot_url: str | None = None


class AuthUserResponse(APIModel):
    id: int
    telegram_id: int
    telegram_username: str | None = None
    first_name: str
    last_name: str | None = None
    display_name: str
    has_avatar: bool


class TelegramExchangeRequest(APIModel):
    code: str = Field(min_length=20, max_length=512)


class AuthSessionResponse(APIModel):
    token: str
    expires_at: datetime
    user: AuthUserResponse


class TelegramWebhookResponse(APIModel):
    ok: bool = True
