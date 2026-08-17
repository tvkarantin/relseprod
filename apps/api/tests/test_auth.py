"""Telegram auth regression tests."""

from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.base import utcnow
from app.models.auth import AppUser, AuthSession, TelegramLoginChallenge
from app.services.telegram_auth import hash_token


def test_exchange_creates_user_and_single_use_session(
    client: TestClient,
    db_session: Session,
) -> None:
    raw_code = "test-telegram-login-code-1234567890"
    db_session.add(
        TelegramLoginChallenge(
            token_hash=hash_token(raw_code),
            telegram_id=424242,
            telegram_username="andrey_test",
            first_name="Андрей",
            last_name="Тест",
            language_code="ru",
            telegram_avatar_file_id="avatar-file-id",
            expires_at=utcnow() + timedelta(minutes=10),
        )
    )
    db_session.commit()

    response = client.post("/api/v1/auth/telegram/exchange", json={"code": raw_code})
    assert response.status_code == 200
    payload = response.json()
    assert payload["token"]
    assert payload["user"]["telegramId"] == 424242
    assert payload["user"]["telegramUsername"] == "andrey_test"
    assert payload["user"]["displayName"] == "Андрей Тест"
    assert payload["user"]["hasAvatar"] is True

    assert db_session.query(AppUser).count() == 1
    assert db_session.query(AuthSession).count() == 1

    replay = client.post("/api/v1/auth/telegram/exchange", json={"code": raw_code})
    assert replay.status_code == 400

    token = payload["token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["telegramUsername"] == "andrey_test"

    logout = client.delete("/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"})
    assert logout.status_code == 204

    after_logout = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after_logout.status_code == 401


def test_expired_exchange_is_rejected(client: TestClient, db_session: Session) -> None:
    raw_code = "expired-telegram-login-code-123456"
    db_session.add(
        TelegramLoginChallenge(
            token_hash=hash_token(raw_code),
            telegram_id=7,
            telegram_username=None,
            first_name="User",
            last_name=None,
            language_code=None,
            telegram_avatar_file_id=None,
            expires_at=utcnow() - timedelta(seconds=1),
        )
    )
    db_session.commit()

    response = client.post("/api/v1/auth/telegram/exchange", json={"code": raw_code})
    assert response.status_code == 400
    assert db_session.query(AppUser).count() == 0
    assert db_session.query(AuthSession).count() == 0
