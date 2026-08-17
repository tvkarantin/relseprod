"""Register the production Telegram webhook using server-only environment variables."""

from __future__ import annotations

import sys

import httpx

from app.core.config import get_settings


def main() -> int:
    settings = get_settings()
    if not settings.telegram_configured:
        print(
            "Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET first."
        )
        return 1

    webhook_url = f"{settings.public_api_url.rstrip('/')}/api/v1/auth/telegram/webhook"
    api_url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/setWebhook"
    payload = {
        "url": webhook_url,
        "secret_token": settings.telegram_webhook_secret,
        "allowed_updates": ["message"],
        "drop_pending_updates": False,
    }
    response = httpx.post(api_url, json=payload, timeout=20)
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict) or body.get("ok") is not True:
        print("Telegram rejected setWebhook")
        return 1

    print(f"Telegram webhook configured: {webhook_url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
