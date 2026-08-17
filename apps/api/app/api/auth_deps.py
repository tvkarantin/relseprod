"""Authentication dependencies shared by protected FastAPI routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import Settings, get_settings
from app.database.base import utcnow
from app.models.auth import AppUser, AuthSession
from app.services.telegram_auth import hash_token


def _bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "").strip()
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется вход через Telegram",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(DbSession)],
) -> AppUser:
    """Resolve a valid browser session to its Telegram-backed user."""
    token = _bearer_token(request)
    if token is None:
        raise _unauthorized()

    row = db.execute(
        select(AuthSession, AppUser)
        .join(AppUser, AppUser.id == AuthSession.user_id)
        .where(
            AuthSession.token_hash == hash_token(token),
            AuthSession.expires_at > utcnow(),
        )
    ).first()
    if row is None:
        raise _unauthorized()
    _session, user = row
    return user


def require_current_user(
    request: Request,
    db: Annotated[Session, Depends(DbSession)],
) -> AppUser | None:
    """Protect product APIs only after AUTH_REQUIRED has been enabled."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    if not settings.auth_required:
        return None
    return get_current_user(request, db)


CurrentUser = Annotated[AppUser, Depends(get_current_user)]
