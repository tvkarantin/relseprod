"""Telegram-first registration, login and session endpoints."""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.auth_deps import CurrentUser
from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.models.auth import AppUser, AuthSession
from app.schemas.auth import (
    AuthConfigResponse,
    AuthSessionResponse,
    AuthUserResponse,
    TelegramExchangeRequest,
    TelegramWebhookResponse,
)
from app.services.telegram_auth import (
    TelegramUserData,
    build_login_url,
    create_login_challenge,
    exchange_login_challenge,
    get_latest_avatar_file_id,
    get_telegram_avatar,
    hash_token,
    send_registration_button,
    send_start_hint,
    to_user_response,
)

router = APIRouter(prefix="/auth", tags=["auth"])
Database = Annotated[Session, Depends(DbSession)]


def _settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", None) or get_settings()


def _raw_bearer(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "").strip()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


@router.get("/config", response_model=AuthConfigResponse)
def auth_config(request: Request) -> AuthConfigResponse:
    settings = _settings(request)
    username = settings.telegram_bot_username.strip().lstrip("@") or None
    enabled = settings.telegram_configured
    return AuthConfigResponse(
        auth_required=settings.auth_required,
        telegram_enabled=enabled,
        bot_username=username,
        bot_url=f"https://t.me/{username}?start=web" if username else None,
    )


@router.post("/telegram/webhook", response_model=TelegramWebhookResponse)
def telegram_webhook(
    request: Request,
    db: Database,
    payload: dict[str, object],
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> TelegramWebhookResponse:
    settings = _settings(request)
    if not settings.telegram_configured:
        raise HTTPException(status_code=503, detail="Telegram auth is not configured")
    if not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token,
        settings.telegram_webhook_secret,
    ):
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret")

    message = payload.get("message")
    if not isinstance(message, dict):
        return TelegramWebhookResponse()
    chat = message.get("chat")
    sender = message.get("from")
    if not isinstance(chat, dict) or not isinstance(sender, dict):
        return TelegramWebhookResponse()
    chat_id = chat.get("id")
    telegram_id = sender.get("id")
    if not isinstance(chat_id, int) or not isinstance(telegram_id, int):
        return TelegramWebhookResponse()

    text = message.get("text")
    command = text.split(maxsplit=1)[0].split("@", maxsplit=1)[0] if isinstance(text, str) else ""
    if command != "/start":
        send_start_hint(settings, chat_id=chat_id)
        return TelegramWebhookResponse()

    first_name = sender.get("first_name")
    username = sender.get("username")
    last_name = sender.get("last_name")
    language_code = sender.get("language_code")
    telegram_user = TelegramUserData(
        telegram_id=telegram_id,
        username=username if isinstance(username, str) else None,
        first_name=first_name if isinstance(first_name, str) and first_name else "Telegram",
        last_name=last_name if isinstance(last_name, str) else None,
        language_code=language_code if isinstance(language_code, str) else None,
    )
    avatar_file_id = get_latest_avatar_file_id(settings, telegram_id)
    existing_user = (
        db.scalar(select(AppUser.id).where(AppUser.telegram_id == telegram_id)) is not None
    )
    raw_code = create_login_challenge(
        db,
        settings,
        telegram_user,
        avatar_file_id=avatar_file_id,
    )
    send_registration_button(
        settings,
        chat_id=chat_id,
        login_url=build_login_url(settings, raw_code),
        existing_user=existing_user,
    )
    return TelegramWebhookResponse()


@router.post("/telegram/exchange", response_model=AuthSessionResponse)
def telegram_exchange(
    request: Request,
    db: Database,
    body: TelegramExchangeRequest,
) -> AuthSessionResponse:
    settings = _settings(request)
    result = exchange_login_challenge(db, settings, body.code)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Ссылка для входа недействительна или уже использована. "
                "Нажми /start в боте ещё раз."
            ),
        )
    return result


@router.get("/me", response_model=AuthUserResponse)
def auth_me(user: CurrentUser) -> AuthUserResponse:
    return to_user_response(user)


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: Database, _user: CurrentUser) -> Response:
    token = _raw_bearer(request)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/avatar")
def auth_avatar(request: Request, user: CurrentUser) -> Response:
    if not user.telegram_avatar_file_id:
        raise HTTPException(status_code=404, detail="У Telegram-профиля нет аватара")
    content, content_type = get_telegram_avatar(
        _settings(request),
        user.telegram_avatar_file_id,
    )
    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
