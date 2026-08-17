"""Telegram registration/login routes backed by the Telegram Bot API."""

from __future__ import annotations

import hmac
from datetime import UTC, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response
from pydantic import Field

from app.schemas.base import APIModel
from app.services.telegram_login import (
    REGISTER_CALLBACK,
    InvalidTelegramToken,
    answer_callback,
    build_confirmation_url,
    create_login_code,
    decode_session,
    ensure_bot_ready,
    exchange_login_code,
    get_telegram_config,
    send_confirmation_screen,
    send_start_hint,
    send_start_screen,
    telegram_avatar,
    telegram_status,
    user_from_claims,
)

router = APIRouter(prefix="/auth/telegram", tags=["auth"])


class TelegramExchangeRequest(APIModel):
    code: str = Field(min_length=20, max_length=1024)


class TelegramUserResponse(APIModel):
    telegram_id: int
    telegram_username: str | None
    first_name: str
    last_name: str | None
    display_name: str
    has_avatar: bool


class TelegramExchangeResponse(APIModel):
    token: str
    expires_at: datetime
    user: TelegramUserResponse


class TelegramStatusResponse(APIModel):
    configured: bool
    bot_username: str | None
    webhook_url: str | None
    webhook_ok: bool
    pending_updates: int | None
    last_error: str | None


class TelegramWebhookResponse(APIModel):
    ok: bool = True


def _telegram_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, httpx.HTTPStatusError):
        detail = f"Telegram API rejected the request (HTTP {exc.response.status_code})"
    else:
        detail = str(exc) or "Telegram bot is unavailable"
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def _bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "").strip()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


@router.get("/start")
def telegram_start() -> RedirectResponse:
    """Configure the bot/webhook if needed and redirect to the actual bot username."""
    config = get_telegram_config()
    try:
        username = ensure_bot_ready(config)
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        raise _telegram_http_error(exc) from exc
    return RedirectResponse(url=f"https://t.me/{username}?start=web", status_code=302)


@router.get("/status", response_model=TelegramStatusResponse)
def telegram_live_status() -> TelegramStatusResponse:
    """Expose only non-secret bot/webhook status for production checks."""
    config = get_telegram_config()
    try:
        payload = telegram_status(config)
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        return TelegramStatusResponse(
            configured=config.configured,
            bot_username=None,
            webhook_url=config.webhook_url,
            webhook_ok=False,
            pending_updates=None,
            last_error=str(exc),
        )
    return TelegramStatusResponse(**payload)


@router.post("/webhook", response_model=TelegramWebhookResponse)
def telegram_webhook(
    payload: dict[str, object],
    x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None,
) -> TelegramWebhookResponse:
    """Handle /start and registration button callbacks from Telegram."""
    config = get_telegram_config()
    if not config.configured:
        raise HTTPException(status_code=503, detail="Telegram bot is not configured")
    if not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token,
        config.webhook_secret,
    ):
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret")

    try:
        callback_query = payload.get("callback_query")
        if isinstance(callback_query, dict):
            callback_id = callback_query.get("id")
            callback_data = callback_query.get("data")
            sender = callback_query.get("from")
            message = callback_query.get("message")
            if not isinstance(callback_id, str):
                return TelegramWebhookResponse()

            answer_callback(config, callback_query_id=callback_id)
            if callback_data != REGISTER_CALLBACK:
                return TelegramWebhookResponse()
            if not isinstance(sender, dict) or not isinstance(message, dict):
                return TelegramWebhookResponse()

            chat = message.get("chat")
            message_id = message.get("message_id")
            if not isinstance(chat, dict) or not isinstance(message_id, int):
                return TelegramWebhookResponse()
            chat_id = chat.get("id")
            if not isinstance(chat_id, int):
                return TelegramWebhookResponse()

            login_code = create_login_code(config, sender)
            send_confirmation_screen(
                config,
                chat_id=chat_id,
                message_id=message_id,
                confirmation_url=build_confirmation_url(config, login_code),
            )
            return TelegramWebhookResponse()

        message = payload.get("message")
        if not isinstance(message, dict):
            return TelegramWebhookResponse()
        chat = message.get("chat")
        sender = message.get("from")
        if not isinstance(chat, dict) or not isinstance(sender, dict):
            return TelegramWebhookResponse()
        chat_id = chat.get("id")
        if not isinstance(chat_id, int):
            return TelegramWebhookResponse()

        text = message.get("text")
        command = text.split(maxsplit=1)[0].split("@", maxsplit=1)[0] if isinstance(text, str) else ""
        if command == "/start":
            send_start_screen(config, chat_id=chat_id)
        else:
            send_start_hint(config, chat_id=chat_id)
        return TelegramWebhookResponse()
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        raise _telegram_http_error(exc) from exc


@router.post("/exchange", response_model=TelegramExchangeResponse)
def telegram_exchange(body: TelegramExchangeRequest) -> TelegramExchangeResponse:
    """Exchange the signed Telegram confirmation for a long-lived browser session."""
    config = get_telegram_config()
    try:
        token, expires_at, user = exchange_login_code(config, body.code)
    except InvalidTelegramToken as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка Telegram недействительна или истекла. Открой бота ещё раз.",
        ) from exc
    except RuntimeError as exc:
        raise _telegram_http_error(exc) from exc

    return TelegramExchangeResponse(
        token=token,
        expires_at=datetime.fromtimestamp(expires_at, tz=UTC),
        user=TelegramUserResponse(**user),
    )


@router.get("/me", response_model=TelegramUserResponse)
def telegram_me(request: Request) -> TelegramUserResponse:
    """Return the Telegram profile embedded in the signed browser session."""
    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    config = get_telegram_config()
    try:
        claims = decode_session(config, token)
    except (InvalidTelegramToken, RuntimeError) as exc:
        raise HTTPException(status_code=401, detail="Session is invalid or expired") from exc
    return TelegramUserResponse(**user_from_claims(claims))


@router.get("/me/avatar")
def telegram_me_avatar(request: Request) -> Response:
    """Proxy the current Telegram avatar without exposing the bot token."""
    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    config = get_telegram_config()
    try:
        claims = decode_session(config, token)
        telegram_id = claims.get("tg")
        if not isinstance(telegram_id, int):
            raise InvalidTelegramToken("Invalid Telegram user")
        content, content_type = telegram_avatar(config, telegram_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="У Telegram-профиля нет аватара") from exc
    except InvalidTelegramToken as exc:
        raise HTTPException(status_code=401, detail="Session is invalid or expired") from exc
    except (httpx.HTTPError, RuntimeError) as exc:
        raise _telegram_http_error(exc) from exc

    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
