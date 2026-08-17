"""Telegram bot setup plus signed login/session tokens for the web app."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from urllib.parse import quote

import httpx
from PIL import Image

TELEGRAM_API_BASE = "https://api.telegram.org"
REGISTER_CALLBACK = "register_realsfinder"
DEFAULT_FRONTEND_URL = "https://realsfinder-github.vercel.app"
DEFAULT_PUBLIC_API_URL = "https://realsfinder-api.vercel.app"
DEFAULT_BOT_AVATAR_URL = "https://realsfinder-github.vercel.app/assets/overview-logo.png"
_SECRET_RE = re.compile(r"^[A-Za-z0-9_-]{1,256}$")
logger = logging.getLogger(__name__)


class InvalidTelegramToken(ValueError):
    """Raised when a signed Telegram login/session token is invalid or expired."""


@dataclass(slots=True, frozen=True)
class TelegramConfig:
    """Server-only Telegram configuration."""

    bot_token: str
    webhook_secret: str
    frontend_url: str
    public_api_url: str
    bot_avatar_url: str
    login_ttl_seconds: int = 600
    session_ttl_seconds: int = 30 * 24 * 60 * 60

    @property
    def configured(self) -> bool:
        return bool(self.bot_token and self.webhook_secret)

    @property
    def webhook_url(self) -> str:
        return f"{self.public_api_url.rstrip('/')}/api/v1/auth/telegram/webhook"


def get_telegram_config() -> TelegramConfig:
    """Load Telegram settings directly from Vercel/server environment variables."""
    return TelegramConfig(
        bot_token=os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
        webhook_secret=os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip(),
        frontend_url=(os.getenv("FRONTEND_URL", "").strip() or DEFAULT_FRONTEND_URL).rstrip("/"),
        public_api_url=(os.getenv("PUBLIC_API_URL", "").strip() or DEFAULT_PUBLIC_API_URL).rstrip("/"),
        bot_avatar_url=(
            os.getenv("TELEGRAM_BOT_AVATAR_URL", "").strip() or DEFAULT_BOT_AVATAR_URL
        ),
    )


def _require_config(config: TelegramConfig) -> None:
    if not config.configured:
        raise RuntimeError("TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET is missing")
    if not _SECRET_RE.fullmatch(config.webhook_secret):
        raise RuntimeError(
            "TELEGRAM_WEBHOOK_SECRET contains characters unsupported by Telegram"
        )


def _telegram_call(
    config: TelegramConfig,
    method: str,
    payload: dict[str, object] | None = None,
) -> Any:
    _require_config(config)
    url = f"{TELEGRAM_API_BASE}/bot{config.bot_token}/{method}"
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        response = client.post(url, json=payload or {})
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict) or body.get("ok") is not True:
        description = body.get("description") if isinstance(body, dict) else None
        message = description if isinstance(description, str) else "unknown Telegram API error"
        raise RuntimeError(f"Telegram {method} failed: {message}")
    return body.get("result")


def _bot_identity(config: TelegramConfig) -> tuple[int, str]:
    result = _telegram_call(config, "getMe")
    if not isinstance(result, dict):
        raise RuntimeError("Telegram getMe returned an invalid response")
    bot_id = result.get("id")
    username = result.get("username")
    if not isinstance(bot_id, int) or not isinstance(username, str) or not username:
        raise RuntimeError("Telegram bot has no valid id/username")
    return bot_id, username.lstrip("@")


def _set_bot_avatar_if_missing(config: TelegramConfig, bot_id: int) -> None:
    """Set the RealsFinder logo as bot avatar if the bot does not have one yet."""
    photos = _telegram_call(
        config,
        "getUserProfilePhotos",
        {"user_id": bot_id, "offset": 0, "limit": 1},
    )
    if isinstance(photos, dict) and isinstance(photos.get("total_count"), int):
        if int(photos["total_count"]) > 0:
            return

    with httpx.Client(timeout=20, follow_redirects=True) as client:
        logo_response = client.get(config.bot_avatar_url)
        logo_response.raise_for_status()

    with Image.open(BytesIO(logo_response.content)) as source:
        image = source.convert("RGB")
        width, height = image.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
        output = BytesIO()
        image.save(output, format="JPEG", quality=92, optimize=True)

    url = f"{TELEGRAM_API_BASE}/bot{config.bot_token}/setMyProfilePhoto"
    photo = json.dumps({"type": "static", "photo": "attach://avatar"})
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        response = client.post(
            url,
            data={"photo": photo},
            files={"avatar": ("realsfinder.jpg", output.getvalue(), "image/jpeg")},
        )
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict) or body.get("ok") is not True:
        raise RuntimeError("Telegram setMyProfilePhoto failed")


def _configure_bot_profile(config: TelegramConfig, bot_id: int) -> None:
    operations: tuple[tuple[str, dict[str, object]], ...] = (
        ("setMyName", {"name": "RealsFinder"}),
        (
            "setMyDescription",
            {
                "description": (
                    "Бот RealsFinder используется для быстрой регистрации и входа в сервис "
                    "через Telegram. Пароли и коды вводить не нужно."
                )
            },
        ),
        (
            "setMyShortDescription",
            {"short_description": "Регистрация и вход в RealsFinder через Telegram."},
        ),
        (
            "setMyCommands",
            {
                "commands": [
                    {"command": "start", "description": "Регистрация или вход в RealsFinder"}
                ]
            },
        ),
    )
    for method, payload in operations:
        try:
            _telegram_call(config, method, payload)
        except (httpx.HTTPError, RuntimeError, ValueError):
            logger.warning("Could not configure Telegram profile via %s", method, exc_info=True)

    try:
        _set_bot_avatar_if_missing(config, bot_id)
    except (httpx.HTTPError, OSError, RuntimeError, ValueError):
        logger.warning("Could not configure Telegram bot avatar", exc_info=True)


def ensure_bot_ready(config: TelegramConfig) -> str:
    """Validate token, register webhook and keep the bot profile configured."""
    bot_id, username = _bot_identity(config)
    _telegram_call(
        config,
        "setWebhook",
        {
            "url": config.webhook_url,
            "secret_token": config.webhook_secret,
            "allowed_updates": ["message", "callback_query"],
            "drop_pending_updates": False,
        },
    )
    _configure_bot_profile(config, bot_id)
    return username


def telegram_status(config: TelegramConfig) -> dict[str, object]:
    """Return non-secret live Telegram configuration status."""
    if not config.configured:
        return {
            "configured": False,
            "bot_username": None,
            "webhook_url": config.webhook_url,
            "webhook_ok": False,
            "pending_updates": None,
            "last_error": "Telegram environment variables are missing",
        }

    _, username = _bot_identity(config)
    webhook = _telegram_call(config, "getWebhookInfo")
    webhook_url = webhook.get("url") if isinstance(webhook, dict) else None
    pending = webhook.get("pending_update_count") if isinstance(webhook, dict) else None
    last_error = webhook.get("last_error_message") if isinstance(webhook, dict) else None
    return {
        "configured": True,
        "bot_username": username,
        "webhook_url": webhook_url if isinstance(webhook_url, str) else None,
        "webhook_ok": webhook_url == config.webhook_url,
        "pending_updates": pending if isinstance(pending, int) else None,
        "last_error": last_error if isinstance(last_error, str) else None,
    }


def _b64_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _encode_signed(config: TelegramConfig, claims: dict[str, object]) -> str:
    _require_config(config)
    payload = json.dumps(
        claims,
        separators=(",", ":"),
        sort_keys=True,
        ensure_ascii=False,
    ).encode("utf-8")
    encoded = _b64_encode(payload)
    signature = hmac.new(
        config.webhook_secret.encode("utf-8"),
        encoded.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{encoded}.{_b64_encode(signature)}"


def _decode_signed(
    config: TelegramConfig,
    token: str,
    *,
    expected_kind: str,
) -> dict[str, object]:
    _require_config(config)
    try:
        encoded, signature = token.split(".", maxsplit=1)
        expected_signature = hmac.new(
            config.webhook_secret.encode("utf-8"),
            encoded.encode("ascii"),
            hashlib.sha256,
        ).digest()
        provided_signature = _b64_decode(signature)
        if not hmac.compare_digest(provided_signature, expected_signature):
            raise InvalidTelegramToken("Invalid signature")
        claims = json.loads(_b64_decode(encoded))
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise InvalidTelegramToken("Invalid signed token") from exc

    if not isinstance(claims, dict) or claims.get("k") != expected_kind:
        raise InvalidTelegramToken("Unexpected token kind")
    expires_at = claims.get("exp")
    issued_at = claims.get("iat")
    now = int(time.time())
    if not isinstance(expires_at, int) or expires_at <= now:
        raise InvalidTelegramToken("Token expired")
    if not isinstance(issued_at, int) or issued_at > now + 60:
        raise InvalidTelegramToken("Invalid issue time")
    telegram_id = claims.get("tg")
    if not isinstance(telegram_id, int) or telegram_id <= 0:
        raise InvalidTelegramToken("Invalid Telegram user")
    return claims


def _clean_optional_text(value: object, *, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned[:limit] or None


def create_login_code(config: TelegramConfig, sender: dict[str, object]) -> str:
    """Create a short-lived signed confirmation code from Telegram webhook user data."""
    telegram_id = sender.get("id")
    if not isinstance(telegram_id, int) or telegram_id <= 0:
        raise ValueError("Telegram sender has no valid id")
    now = int(time.time())
    first_name = _clean_optional_text(sender.get("first_name"), limit=64) or "Telegram"
    claims: dict[str, object] = {
        "k": "login",
        "tg": telegram_id,
        "fn": first_name,
        "iat": now,
        "exp": now + config.login_ttl_seconds,
        "n": secrets.token_hex(6),
    }
    username = _clean_optional_text(sender.get("username"), limit=32)
    last_name = _clean_optional_text(sender.get("last_name"), limit=64)
    if username:
        claims["un"] = username
    if last_name:
        claims["ln"] = last_name
    return _encode_signed(config, claims)


def build_confirmation_url(config: TelegramConfig, login_code: str) -> str:
    return f"{config.frontend_url}/auth/telegram#code={quote(login_code, safe='')}"


def exchange_login_code(
    config: TelegramConfig,
    login_code: str,
) -> tuple[str, int, dict[str, object]]:
    """Verify the Telegram confirmation and issue a signed browser session."""
    login = _decode_signed(config, login_code, expected_kind="login")
    now = int(time.time())
    session_claims: dict[str, object] = {
        "k": "session",
        "tg": login["tg"],
        "fn": login.get("fn", "Telegram"),
        "iat": now,
        "exp": now + config.session_ttl_seconds,
    }
    for key in ("un", "ln"):
        value = login.get(key)
        if isinstance(value, str) and value:
            session_claims[key] = value
    session_token = _encode_signed(config, session_claims)
    return session_token, int(session_claims["exp"]), user_from_claims(session_claims)


def decode_session(config: TelegramConfig, token: str) -> dict[str, object]:
    return _decode_signed(config, token, expected_kind="session")


def user_from_claims(claims: dict[str, object]) -> dict[str, object]:
    first_name = claims.get("fn") if isinstance(claims.get("fn"), str) else "Telegram"
    last_name = claims.get("ln") if isinstance(claims.get("ln"), str) else None
    username = claims.get("un") if isinstance(claims.get("un"), str) else None
    parts = [first_name, last_name or ""]
    display_name = " ".join(part for part in parts if part).strip()
    return {
        "telegram_id": claims["tg"],
        "telegram_username": username,
        "first_name": first_name,
        "last_name": last_name,
        "display_name": display_name or username or "Telegram",
        "has_avatar": True,
    }


def send_start_screen(config: TelegramConfig, *, chat_id: int) -> None:
    _telegram_call(
        config,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": (
                "RealsFinder\n\n"
                "Этот бот используется для регистрации и входа в RealsFinder через Telegram.\n\n"
                "Нажми кнопку ниже. Мы получим только имя, @username и аватар твоего "
                "Telegram-профиля — без паролей и кодов."
            ),
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "Зарегистрироваться", "callback_data": REGISTER_CALLBACK}]
                ]
            },
        },
    )


def send_start_hint(config: TelegramConfig, *, chat_id: int) -> None:
    _telegram_call(
        config,
        "sendMessage",
        {"chat_id": chat_id, "text": "Нажми /start, чтобы зарегистрироваться в RealsFinder."},
    )


def answer_callback(config: TelegramConfig, *, callback_query_id: str) -> None:
    _telegram_call(
        config,
        "answerCallbackQuery",
        {"callback_query_id": callback_query_id},
    )


def send_confirmation_screen(
    config: TelegramConfig,
    *,
    chat_id: int,
    message_id: int,
    confirmation_url: str,
) -> None:
    _telegram_call(
        config,
        "editMessageText",
        {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": (
                "Подтверди регистрацию\n\n"
                "Нажимая кнопку ниже, ты подтверждаешь регистрацию в RealsFinder через "
                "этот Telegram-аккаунт.\n\nПосле подтверждения ты вернёшься в RealsFinder."
            ),
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "Подтвердить и вернуться", "url": confirmation_url}]
                ]
            },
        },
    )


def telegram_avatar(config: TelegramConfig, telegram_id: int) -> tuple[bytes, str]:
    """Fetch the current Telegram profile photo without exposing bot credentials."""
    photos = _telegram_call(
        config,
        "getUserProfilePhotos",
        {"user_id": telegram_id, "offset": 0, "limit": 1},
    )
    if not isinstance(photos, dict):
        raise FileNotFoundError("Telegram profile has no photo")
    photo_sets = photos.get("photos")
    if not isinstance(photo_sets, list) or not photo_sets:
        raise FileNotFoundError("Telegram profile has no photo")
    first_set = photo_sets[0]
    if not isinstance(first_set, list) or not first_set:
        raise FileNotFoundError("Telegram profile has no photo")
    largest = first_set[-1]
    if not isinstance(largest, dict):
        raise FileNotFoundError("Telegram profile has no photo")
    file_id = largest.get("file_id")
    if not isinstance(file_id, str) or not file_id:
        raise FileNotFoundError("Telegram profile has no photo")

    file_info = _telegram_call(config, "getFile", {"file_id": file_id})
    file_path = file_info.get("file_path") if isinstance(file_info, dict) else None
    if not isinstance(file_path, str) or not file_path:
        raise FileNotFoundError("Telegram file is unavailable")

    url = f"{TELEGRAM_API_BASE}/file/bot{config.bot_token}/{file_path}"
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
    content_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0]
    return response.content, content_type
