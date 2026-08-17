"""Configure the production Telegram bot profile and webhook."""

from __future__ import annotations

import sys

import httpx

from app.core.config import get_settings

BOT_NAME = "RealsFinder"
BOT_DESCRIPTION = (
    "Этот бот используется для регистрации и входа в RealsFinder через Telegram. "
    "Нажми /start, чтобы подтвердить свой Telegram-аккаунт и вернуться в сервис."
)
BOT_SHORT_DESCRIPTION = "Регистрация и вход в RealsFinder через Telegram."


def _telegram_method(token: str, method: str, payload: dict[str, object]) -> None:
    api_url = f"https://api.telegram.org/bot{token}/{method}"
    response = httpx.post(api_url, json=payload, timeout=20)
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict) or body.get("ok") is not True:
        raise RuntimeError(f"Telegram rejected {method}")


def main() -> int:
    settings = get_settings()
    if not settings.telegram_configured:
        print(
            "Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET first."
        )
        return 1

    token = settings.telegram_bot_token
    _telegram_method(token, "setMyName", {"name": BOT_NAME})
    _telegram_method(token, "setMyDescription", {"description": BOT_DESCRIPTION})
    _telegram_method(
        token,
        "setMyShortDescription",
        {"short_description": BOT_SHORT_DESCRIPTION},
    )
    _telegram_method(
        token,
        "setMyCommands",
        {
            "commands": [
                {"command": "start", "description": "Регистрация или вход"},
            ]
        },
    )

    webhook_url = f"{settings.public_api_url.rstrip('/')}/api/v1/auth/telegram/webhook"
    _telegram_method(
        token,
        "setWebhook",
        {
            "url": webhook_url,
            "secret_token": settings.telegram_webhook_secret,
            "allowed_updates": ["message", "callback_query"],
            "drop_pending_updates": False,
        },
    )

    print(f"Telegram bot profile configured: @{settings.telegram_bot_username.lstrip('@')}")
    print(f"Telegram webhook configured: {webhook_url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
