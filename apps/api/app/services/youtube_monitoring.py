"""Official YouTube Data API v3 provider and transparent scoring helpers."""

from __future__ import annotations

import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)
YOUTUBE_API = "https://www.googleapis.com/youtube/v3"
SCORE_WEIGHTS = {
    "relevance": 0.35,
    "velocity": 0.30,
    "engagement": 0.15,
    "competitor": 0.10,
    "ai": 0.10,
}


def parse_youtube_url(value: str) -> tuple[str, str | None]:
    """Return (kind, id/handle) without making a network request."""
    text = value.strip()
    if re.fullmatch(r"UC[\w-]{20,}", text):
        return "channel_id", text
    short = re.match(r"https?://youtu\.be/([\\w-]+)", text, re.I)
    if short:
        return "video_id", short.group(1)
    parsed = re.match(r"https?://(?:www\.)?youtube\.com/(.+)$", text, re.I)
    if not parsed:
        raise ValueError("Введите ссылку YouTube, @username или Channel ID")
    path = parsed.group(1).split("?", 1)[0].strip("/")
    if path.startswith("watch/") or path.startswith("shorts/"):
        return "video_id", path.split("/", 1)[1]
    if path.startswith("watch"):
        query = re.search(r"[?&]v=([\w-]{6,})", text)
        if query:
            return "video_id", query.group(1)
    if path.startswith("@"):
        return "handle", path
    if path.startswith("channel/"):
        return "channel_id", path.split("/", 1)[1]
    if path.startswith("user/") or path.startswith("c/"):
        return "handle", path.split("/", 1)[1]
    raise ValueError("Не удалось определить YouTube-канал")


def parse_duration(value: str | None) -> int | None:
    if not value:
        return None
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value)
    if not match:
        return None
    hours, minutes, seconds = (int(item or 0) for item in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def detect_content_type(duration_seconds: int | None, title: str = "", url: str = "") -> str:
    """Conservative heuristic: Shorts are probable, never asserted with certainty."""
    if "/shorts/" in url.lower():
        return "short"
    if (
        duration_seconds is not None
        and duration_seconds <= 180
        and ("#shorts" in title.lower() or duration_seconds <= 60)
    ):
        return "short"
    if duration_seconds is not None:
        return "video"
    return "unknown"


def engagement_rate(likes: int | None, comments: int | None, views: int) -> float:
    return round(((likes or 0) + (comments or 0)) / views * 100, 4) if views > 0 else 0.0


def views_per_hour(views: int, published_at: datetime, now: datetime | None = None) -> float:
    now = now or datetime.now(UTC)
    age_hours = max((now - published_at).total_seconds() / 3600, 0.25)
    return round(views / age_hours, 2)


def category_for_score(score: float | None) -> str:
    if score is None:
        return "Недостаточно данных"
    if score >= 85:
        return "Обязательно к съёмке"
    if score >= 70:
        return "Высокий шанс залететь"
    if score >= 50:
        return "Можно использовать как референс"
    return "Низкий приоритет"


def calculate_final_score(
    relevance: float, velocity: float, engagement: float, competitor: float, ai: float
) -> float:
    score = sum(
        (
            relevance * SCORE_WEIGHTS["relevance"],
            velocity * SCORE_WEIGHTS["velocity"],
            engagement * SCORE_WEIGHTS["engagement"],
            competitor * SCORE_WEIGHTS["competitor"],
            ai * SCORE_WEIGHTS["ai"],
        )
    )
    return round(max(0, min(100, score)), 2)


def fallback_analysis(
    title: str, description: str, keywords: list[str], negative_keywords: list[str]
) -> dict[str, Any]:
    text = f"{title} {description}".lower()
    positives = [key for key in keywords if key.lower() in text]
    negatives = [key for key in negative_keywords if key.lower() in text]
    relevance = max(0, min(100, 45 + len(positives) * 18 - len(negatives) * 30))
    return {
        "isRelevant": bool(positives) and not negatives,
        "relevanceScore": relevance,
        "aiScore": relevance,
        "whyItWorks": ["совпадение с ключевыми словами"] if positives else [],
        "recommendation": "Проверить вручную",
    }


class YouTubeMonitoringService:
    """Server-only client for YouTube Data API v3. API key is never serialized."""

    def __init__(
        self, settings: Settings | None = None, client: httpx.Client | None = None
    ) -> None:
        self.settings = settings or get_settings()
        self.client = client or httpx.Client(timeout=20)
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self.client.close()

    def _request(self, operation: str, params: dict[str, Any], cost: int = 1) -> dict[str, Any]:
        if not self.settings.youtube_api_key:
            raise RuntimeError("YOUTUBE_API_KEY не настроен")
        params = {**params, "key": self.settings.youtube_api_key}
        for attempt in range(3):
            try:
                response = self.client.get(f"{YOUTUBE_API}/" + operation, params=params)
                if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                        time.sleep(2**attempt)
                        continue
                response.raise_for_status()
                return response.json()
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise
                time.sleep(2**attempt)
        raise RuntimeError("YouTube API недоступен")

    def searchVideosByKeywords(  # noqa: N802
        self,
        keywords: list[str],
        published_after: datetime | None = None,
        language: str | None = None,
        region_code: str | None = None,
    ) -> list[dict[str, Any]]:
        query = " | ".join(dict.fromkeys(k.strip() for k in keywords if k.strip()))
        if not query:
            return []
        params: dict[str, Any] = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": 50,
            "order": "date",
        }
        if published_after:
            params["publishedAfter"] = (
                published_after.astimezone(UTC).isoformat().replace("+00:00", "Z")
            )
        if language:
            params["relevanceLanguage"] = language
        if region_code:
            params["regionCode"] = region_code
        data = self._request("search", params, 100)
        ids = [item.get("id", {}).get("videoId") for item in data.get("items", [])]
        return self.getVideosStatistics([item for item in ids if item])

    def getLatestChannelVideos(  # noqa: N802
        self,
        channel_id: str,
        uploads_playlist_id: str | None = None,
        published_after: datetime | None = None,
    ) -> list[dict[str, Any]]:
        if not uploads_playlist_id:
            data = self._request("channels", {"part": "contentDetails", "id": channel_id})
            items = data.get("items", [])
            if not items:
                return []
            uploads_playlist_id = (
                items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
            )
        params: dict[str, Any] = {
            "part": "snippet,contentDetails",
            "playlistId": uploads_playlist_id,
            "maxResults": 50,
        }
        data = self._request("playlistItems", params, 1)
        ids = [item.get("contentDetails", {}).get("videoId") for item in data.get("items", [])]
        videos = self.getVideosStatistics([item for item in ids if item])
        if published_after:
            videos = [item for item in videos if item["publishedAt"] > published_after]
        return videos

    def getVideosStatistics(self, video_ids: list[str]) -> list[dict[str, Any]]:  # noqa: N802
        result: list[dict[str, Any]] = []
        for start in range(0, len(video_ids), 50):
            data = self._request(
                "videos",
                {
                    "part": "snippet,contentDetails,statistics",
                    "id": ",".join(video_ids[start : start + 50]),
                },
                1,
            )
            result.extend(self.normalizeYouTubeVideo(item) for item in data.get("items", []))
        return result

    def normalizeYouTubeVideo(self, item: dict[str, Any]) -> dict[str, Any]:  # noqa: N802
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        details = item.get("contentDetails", {})
        published = datetime.fromisoformat(
            snippet["publishedAt"].replace("Z", "+00:00")
        ).astimezone(UTC)
        url = f"https://www.youtube.com/watch?v={item['id']}"
        duration = parse_duration(details.get("duration"))
        return {
            "externalId": item["id"],
            "url": url,
            "title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "channelId": snippet.get("channelId", ""),
            "channelTitle": snippet.get("channelTitle", ""),
            "thumbnailUrl": snippet.get("thumbnails", {})
            .get("high", snippet.get("thumbnails", {}).get("default", {}))
            .get("url"),
            "publishedAt": published,
            "durationSeconds": duration,
            "contentType": detect_content_type(duration, snippet.get("title", ""), url),
            "viewCount": int(stats.get("viewCount", 0)),
            "likeCount": int(stats["likeCount"]) if "likeCount" in stats else None,
            "commentCount": int(stats["commentCount"]) if "commentCount" in stats else None,
        }

    calculateVideoVelocity = staticmethod(views_per_hour)  # noqa: N815
