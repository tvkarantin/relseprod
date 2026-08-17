from __future__ import annotations

import time

import pytest

from app.services.telegram_login import (
    InvalidTelegramToken,
    TelegramConfig,
    create_login_code,
    decode_session,
    exchange_login_code,
)


def make_config() -> TelegramConfig:
    return TelegramConfig(
        bot_token="123456:test-token",
        webhook_secret="telegram_test_secret_123456",
        frontend_url="https://example.test",
        public_api_url="https://api.example.test",
        bot_avatar_url="https://example.test/avatar.png",
    )


def test_signed_telegram_login_creates_session() -> None:
    config = make_config()
    code = create_login_code(
        config,
        {
            "id": 424242,
            "username": "andrey_test",
            "first_name": "Андрей",
            "last_name": "Тест",
        },
    )

    session_token, expires_at, user = exchange_login_code(config, code)

    assert expires_at > int(time.time())
    assert user["telegram_id"] == 424242
    assert user["telegram_username"] == "andrey_test"
    assert user["display_name"] == "Андрей Тест"
    session = decode_session(config, session_token)
    assert session["tg"] == 424242
    assert session["un"] == "andrey_test"


def test_tampered_telegram_login_is_rejected() -> None:
    config = make_config()
    code = create_login_code(config, {"id": 7, "first_name": "User"})
    payload, signature = code.split(".", maxsplit=1)
    replacement = "A" if payload[-1] != "A" else "B"
    tampered = f"{payload[:-1]}{replacement}.{signature}"

    with pytest.raises(InvalidTelegramToken):
        exchange_login_code(config, tampered)


def test_session_is_bound_to_server_secret() -> None:
    config = make_config()
    code = create_login_code(config, {"id": 99, "first_name": "User"})
    session_token, _, _ = exchange_login_code(config, code)
    other_config = TelegramConfig(
        bot_token=config.bot_token,
        webhook_secret="another_valid_secret_123456",
        frontend_url=config.frontend_url,
        public_api_url=config.public_api_url,
        bot_avatar_url=config.bot_avatar_url,
    )

    with pytest.raises(InvalidTelegramToken):
        decode_session(other_config, session_token)
