"""Telegram Bot API integration and one-time login/session lifecycle."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING
from urllib.parse import quote

import httpx
from sqlalchemy import select

from app.database.base import utcnow
from app.models.auth import AppUser, AuthSession, TelegramLoginChallenge
from app.schemas.auth import AuthSessionResponse, AuthUserResponse

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.core.config import Settings

TELEGRAM_API_BASE = "https://api.telegram.org"


@dataclass(slots=True, frozen=True)
class TelegramUserData:
    telegram_id: int
    username: str | None
    first_name: str
    last_name: str | None
    language_code: str | None


def hash_token(token: str) -> str:
    """Return a deterministic hash so raw login/session tokens never reach the DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _telegram_call(settings: Settings, method: str, payload: dict[str, object]) -> dict[str, object]:
    if not settings.telegram_bot_token:
        raise RuntimeError("Telegram bot is not configured")
    url = f"{TELEGRAM_API_BASE}/bot{settings.telegram_bot_token}/{method}"
    with httpx.Client(timeout=20) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict) or body.get("ok") is not True:
        raise RuntimeError(f"Telegram API method {method} failed")
    result = body.get("result")
    return result if isinstance(result, dict) else {}


def get_latest_avatar_file_id(settings: Settings, telegram_id: int) -> str | None:
    """Return the largest size of the user's current Telegram profile photo."""
    result = _telegram_call(
        settings,
        "getUserProfilePhotos",
        {"user_id": telegram_id, "offset": 0, "limit": 1},
    )
    photos = result.get("photos")
    if not isinstance(photos, list) or not photos:
        return None
    first_photo = photos[0]
    if not isinstance(first_photo, list) or not first_photo:
        return None
    largest = first_photo[-1]
    if not isinstance(largest, dict):
        return None
    file_id = largest.get("file_id")
    return file_id if isinstance(file_id, str) and file_id else None


def create_login_challenge(
    db: Session,
    settings: Settings,
    telegram_user: TelegramUserData,
    *,
    avatar_file_id: str | None,
) -> str:
    """Create and persist a short-lived one-time login code."""
    raw_code = secrets.token_urlsafe(32)
    challenge = TelegramLoginChallenge(
        token_hash=hash_token(raw_code),
        telegram_id=telegram_user.telegram_id,
        telegram_username=telegram_user.username,
        first_name=telegram_user.first_name,
        last_name=telegram_user.last_name,
        language_code=telegram_user.language_code,
        telegram_avatar_file_id=avatar_file_id,
        expires_at=utcnow() + timedelta(seconds=settings.telegram_login_ttl_seconds),
    )
    db.add(challenge)
    db.commit()
    return raw_code


def build_login_url(settings: Settings, raw_code: str) -> str:
    """Put the one-time code in the URL fragment so it is not sent as a Referer/query."""
    return (
        f"{settings.frontend_url.rstrip('/')}/auth/telegram"
        f"#code={quote(raw_code, safe='')}"
    )


def send_registration_button(
    settings: Settings,
    *,
    chat_id: int,
    login_url: str,
    existing_user: bool,
) -> None:
    button_text = "Войти в RealsFinder" if existing_user else "Зарегистрироваться"
    text = (
        "Аккаунт уже найден. Нажми кнопку ниже, чтобы войти."
        if existing_user
        else "Готово. Нажми кнопку ниже — Telegram-аккаунт станет твоим профилем RealsFinder."
    )
    _telegram_call(
        settings,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "reply_markup": {
                "inline_keyboard": [[{"text": button_text, "url": login_url}]],
            },
        },
    )


def send_start_hint(settings: Settings, *, chat_id: int) -> None:
    _telegram_call(
        settings,
        "sendMessage",
        {"chat_id": chat_id, "text": "Нажми /start, чтобы войти или зарегистрироваться."},
    )


def _display_name(user: AppUser) -> str:
    parts = [user.first_name, user.last_name or ""]
    return " ".join(part for part in parts if part).strip() or user.telegram_username or "Telegram"


def to_user_response(user: AppUser) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        telegram_username=user.telegram_username,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=_display_name(user),
        has_avatar=bool(user.telegram_avatar_file_id),
    )


def exchange_login_challenge(
    db: Session,
    settings: Settings,
    raw_code: str,
) -> AuthSessionResponse | None:
    """Consume a code exactly once, upsert the user and issue a browser session."""
    now = utcnow()
    challenge = db.scalar(
        select(TelegramLoginChallenge)
        .where(TelegramLoginChallenge.token_hash == hash_token(raw_code))
        .with_for_update()
    )
    if challenge is None or challenge.used_at is not None or challenge.expires_at <= now:
        return None

    user = db.scalar(select(AppUser).where(AppUser.telegram_id == challenge.telegram_id))
    if user is None:
        user = AppUser(
            telegram_id=challenge.telegram_id,
            telegram_username=challenge.telegram_username,
            first_name=challenge.first_name,
            last_name=challenge.last_name,
            language_code=challenge.language_code,
            telegram_avatar_file_id=challenge.telegram_avatar_file_id,
        )
        db.add(user)
        db.flush()
    else:
        user.telegram_username = challenge.telegram_username
        user.first_name = challenge.first_name
        user.last_name = challenge.last_name
        user.language_code = challenge.language_code
        user.telegram_avatar_file_id = challenge.telegram_avatar_file_id

    challenge.used_at = now
    raw_session = secrets.token_urlsafe(48)
    expires_at = now + timedelta(days=settings.auth_session_ttl_days)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(raw_session),
            expires_at=expires_at,
        )
    )
    db.commit()
    db.refresh(user)
    return AuthSessionResponse(
        token=raw_session,
        expires_at=expires_at,
        user=to_user_response(user),
    )


def get_telegram_avatar(settings: Settings, file_id: str) -> tuple[bytes, str]:
    """Download a Telegram profile image without ever exposing the bot token to the browser."""
    result = _telegram_call(settings, "getFile", {"file_id": file_id})
    file_path = result.get("file_path")
    if not isinstance(file_path, str) or not file_path:
        raise RuntimeError("Telegram did not return a file path")
    url = f"{TELEGRAM_API_BASE}/file/bot{settings.telegram_bot_token}/{file_path}"
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
    content_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0]
    return response.content, content_type
