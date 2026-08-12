"""Authentication endpoint tests."""

from __future__ import annotations

from typing import Any

import pytest

from app.api.v1 import auth


class FakeResponse:
    def __init__(self, status_code: int, payload: Any) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class FakeAsyncClient:
    response = FakeResponse(
        200,
        {
            "id": "123456",
            "login": "realsflow-user",
            "default_email": "user@yandex.ru",
            "real_name": "Иван Петров",
            "first_name": "Иван",
            "last_name": "Петров",
        },
    )
    last_headers: dict[str, str] | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> FakeAsyncClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def get(self, *args: Any, **kwargs: Any) -> FakeResponse:
        type(self).last_headers = kwargs.get("headers")
        return type(self).response


def test_yandex_userinfo_requires_bearer_token(client) -> None:
    response = client.get("/api/v1/auth/yandex/userinfo")

    assert response.status_code == 401


def test_yandex_userinfo_normalizes_profile(client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeAsyncClient)
    FakeAsyncClient.response = FakeResponse(
        200,
        {
            "id": "123456",
            "login": "realsflow-user",
            "default_email": "user@yandex.ru",
            "real_name": "Иван Петров",
            "first_name": "Иван",
            "last_name": "Петров",
        },
    )

    response = client.get(
        "/api/v1/auth/yandex/userinfo",
        headers={"Authorization": "Bearer yandex-access-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "sub": "123456",
        "email": "user@yandex.ru",
        "name": "Иван Петров",
        "given_name": "Иван",
        "family_name": "Петров",
        "preferred_username": "realsflow-user",
    }
    assert FakeAsyncClient.last_headers == {"Authorization": "OAuth yandex-access-token"}


def test_yandex_userinfo_requires_email_permission(client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeAsyncClient)
    FakeAsyncClient.response = FakeResponse(200, {"id": "123456", "login": "no-email"})

    response = client.get(
        "/api/v1/auth/yandex/userinfo",
        headers={"Authorization": "Bearer yandex-access-token"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Yandex account did not grant access to email"


def test_yandex_userinfo_rejects_invalid_token(client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeAsyncClient)
    FakeAsyncClient.response = FakeResponse(401, {"error": "invalid_token"})

    response = client.get(
        "/api/v1/auth/yandex/userinfo",
        headers={"Authorization": "Bearer invalid"},
    )

    assert response.status_code == 401
