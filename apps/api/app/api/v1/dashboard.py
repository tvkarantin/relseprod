"""Dashboard counters and connected account analytics."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import get_settings
from app.schemas.common import DashboardSummary
from app.services.instaloader_service import InstaloaderService
from app.services.reel_content import DashboardService
from app.services.youtube_monitoring import YouTubeMonitoringService, parse_youtube_url

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_INSTAGRAM_USERNAME_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Реальные счётчики по базе",
)
def dashboard_summary(db: Annotated[Session, Depends(DbSession)]) -> DashboardSummary:
    """Return plain ``COUNT`` values — not analytics."""
    return DashboardSummary(**DashboardService(db).summary())


def _instagram_username(value: str) -> str:
    text = value.strip()
    lower = text.lower()
    for prefix in (
        "https://www.instagram.com/",
        "https://instagram.com/",
        "http://www.instagram.com/",
        "http://instagram.com/",
        "www.instagram.com/",
        "instagram.com/",
    ):
        if lower.startswith(prefix):
            text = text[len(prefix) :]
            break
    text = text.split("?", 1)[0].strip("/").split("/", 1)[0].lstrip("@")
    if not _INSTAGRAM_USERNAME_RE.fullmatch(text):
        raise HTTPException(status_code=422, detail="Введите корректный Instagram username")
    return text


def _youtube_channel_item(
    service: YouTubeMonitoringService,
    identifier: str,
) -> dict[str, Any]:
    text = identifier.strip()
    if text.startswith("@"):
        kind, resolved = "handle", text
    else:
        try:
            kind, resolved = parse_youtube_url(text)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail="Введите ссылку YouTube, @handle или Channel ID",
            ) from exc

    if not resolved:
        raise HTTPException(status_code=422, detail="Не удалось определить YouTube-канал")

    if kind == "video_id":
        video_data = service._request("videos", {"part": "snippet", "id": resolved})
        video = video_data.get("items", [None])[0]
        if not video:
            raise HTTPException(status_code=404, detail="YouTube-видео не найдено")
        resolved = video.get("snippet", {}).get("channelId")
        kind = "channel_id"

    if kind == "handle":
        data = service._request(
            "channels",
            {
                "part": "snippet,statistics",
                "forHandle": str(resolved).lstrip("@"),
            },
        )
    else:
        data = service._request(
            "channels",
            {
                "part": "snippet,statistics",
                "id": resolved,
            },
        )

    item = data.get("items", [None])[0]
    if not item:
        raise HTTPException(status_code=404, detail="YouTube-канал не найден")
    return item


@router.get("/social-account", summary="Публичная статистика подключённого аккаунта")
def social_account(
    request: Request,
    platform: Literal["instagram", "youtube"] = Query(...),
    identifier: str = Query(..., min_length=2, max_length=500),
) -> dict[str, Any]:
    """Return public account metrics without inventing private analytics."""
    settings = getattr(request.app.state, "settings", None) or get_settings()

    if platform == "instagram":
        username = _instagram_username(identifier)
        service = InstaloaderService(settings)
        try:
            payload = service.fetch_profile_summary(username, reels_limit=20)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Не удалось получить статистику Instagram",
            ) from exc
        finally:
            service.close()

        sample_size = int(payload.get("viewsSampleSize") or 0)
        views_label = (
            f"Последние {sample_size} Reels"
            if sample_size
            else "Просмотры Reels недоступны"
        )
        return {
            "platform": "instagram",
            "identifier": payload["username"],
            "displayName": payload["displayName"],
            "avatarUrl": payload["avatarUrl"],
            "views": payload["views"],
            "subscribers": payload["followers"],
            "publications": payload["publications"],
            "viewsLabel": views_label,
            "updatedAt": datetime.now(UTC),
        }

    service = YouTubeMonitoringService(settings)
    try:
        item = _youtube_channel_item(service, identifier)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Не удалось получить статистику YouTube",
        ) from exc
    finally:
        service.close()

    snippet = item.get("snippet", {})
    statistics = item.get("statistics", {})
    custom_url = snippet.get("customUrl")
    return {
        "platform": "youtube",
        "identifier": custom_url or item["id"],
        "displayName": snippet.get("title") or custom_url or item["id"],
        "avatarUrl": snippet.get("thumbnails", {})
        .get("default", {})
        .get("url"),
        "views": int(statistics["viewCount"]) if "viewCount" in statistics else None,
        "subscribers": (
            int(statistics["subscriberCount"])
            if "subscriberCount" in statistics
            else None
        ),
        "publications": (
            int(statistics["videoCount"]) if "videoCount" in statistics else None
        ),
        "viewsLabel": "Все просмотры канала",
        "updatedAt": datetime.now(UTC),
    }
