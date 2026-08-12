"""Authentication compatibility endpoints for external OAuth providers."""

from __future__ import annotations

import logging
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Header, HTTPException, status

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("app.api.auth")

YANDEX_USERINFO_URL = "https://login.yandex.ru/info"
YANDEX_TIMEOUT_SECONDS = 8.0


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required",
        )

    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is required",
        )
    return token.strip()


def _normalize_yandex_user(payload: dict[str, Any]) -> dict[str, Any]:
    user_id = str(payload.get("id") or "").strip()
    email = str(payload.get("default_email") or "").strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Yandex did not return a user id",
        )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yandex account did not grant access to email",
        )

    normalized: dict[str, Any] = {
        "sub": user_id,
        "email": email,
    }

    optional_fields = {
        "name": payload.get("real_name") or payload.get("display_name"),
        "given_name": payload.get("first_name"),
        "family_name": payload.get("last_name"),
        "preferred_username": payload.get("login"),
    }
    normalized.update({key: value for key, value in optional_fields.items() if value})
    return normalized


@router.get(
    "/yandex/userinfo",
    summary="Нормализовать профиль Yandex OAuth для Supabase Auth",
)
async def yandex_userinfo(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Translate a standards-style Bearer request into Yandex's OAuth userinfo request."""
    access_token = _extract_bearer_token(authorization)

    try:
        async with httpx.AsyncClient(timeout=YANDEX_TIMEOUT_SECONDS) as client:
            response = await client.get(
                YANDEX_USERINFO_URL,
                headers={"Authorization": f"OAuth {access_token}"},
                params={"format": "json"},
            )
    except httpx.RequestError as exc:
        logger.warning("Yandex userinfo request failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Yandex user info is temporarily unavailable",
        ) from exc

    if response.status_code in {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yandex access token is invalid or expired",
        )
    if response.status_code >= 400:
        logger.warning("Yandex userinfo returned status=%s", response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Yandex user info request failed",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Yandex returned an invalid response",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Yandex returned an invalid response",
        )

    return _normalize_yandex_user(payload)
