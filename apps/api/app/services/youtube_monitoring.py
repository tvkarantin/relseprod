"""Official YouTube Data API v3 provider and transparent scoring helpers."""

from __future__ import annotations

import html
import json
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)
YOUTUBE_API = "https://www.googleapis.com/youtube/v3"
YOUTUBE_ORIGIN = "https://www.youtube.com"
YOUTUBE_PUBLIC_HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    ),
}
SCORE_WEIGHTS = {
    "relevance": 0.35,
    "velocity": 0.30,
    "engagement": 0.15,
    "competitor": 0.10,
    "ai": 0.10,
}


def parse_youtube_url(value: str) -> tuple[str, str | None]:
    """Return (kind, id/handle/path) without making a network request."""
    text = value.strip()
    if re.fullmatch(r"UC[\w-]{20,}", text):
        return "channel_id", text
    if re.fullmatch(r"@[A-Za-z0-9._-]{2,}", text):
        return "handle", text

    if text.lower().startswith(("youtube.com/", "www.youtube.com/", "m.youtube.com/", "youtu.be/")):
        text = f"https://{text}"

    parsed = urlparse(text)
    host = parsed.netloc.lower().split(":", 1)[0]
    if host in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/", 1)[0]
        if re.fullmatch(r"[\w-]{6,}", video_id):
            return "video_id", video_id
        raise ValueError("Не удалось определить YouTube-видео")

    if host not in {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
    }:
        raise ValueError("Введите ссылку YouTube, @username или Channel ID")

    path = parsed.path.strip("/")
    if path == "watch":
        video_id = parse_qs(parsed.query).get("v", [None])[0]
        if video_id and re.fullmatch(r"[\w-]{6,}", video_id):
            return "video_id", video_id
        raise ValueError("Не удалось определить YouTube-видео")

    parts = [part for part in path.split("/") if part]
    if not parts:
        raise ValueError("Не удалось определить YouTube-канал")

    first = parts[0]
    if first in {"shorts", "live", "embed", "v"} and len(parts) > 1:
        video_id = parts[1]
        if re.fullmatch(r"[\w-]{6,}", video_id):
            return "video_id", video_id
    if first.startswith("@"):
        return "handle", first
    if first == "channel" and len(parts) > 1:
        return "channel_id", parts[1]
    if first in {"user", "c"} and len(parts) > 1:
        return "legacy_path", f"{first}/{parts[1]}"
    raise ValueError("Не удалось определить YouTube-канал")


def _decode_json_text(value: str) -> str:
    try:
        return html.unescape(json.loads(f'"{value}"'))
    except (json.JSONDecodeError, TypeError):
        return html.unescape(value.replace("\\u0026", "&"))


def _meta_content(page: str, name: str) -> str | None:
    escaped = re.escape(name)
    patterns = (
        rf'<meta[^>]+(?:property|name)=["\']{escaped}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{escaped}["\']',
    )
    for pattern in patterns:
        match = re.search(pattern, page, re.I)
        if match:
            return html.unescape(match.group(1))
    return None


def _youtube_text(page: str, key: str) -> str | None:
    escaped = re.escape(key)
    patterns = (
        rf'"{escaped}":"([^"\\]*(?:\\.[^"\\]*)*)"',
        rf'"{escaped}":\{{"simpleText":"([^"\\]*(?:\\.[^"\\]*)*)"',
        rf'"{escaped}":\{{"runs":\[\{{"text":"([^"\\]*(?:\\.[^"\\]*)*)"',
        rf'"{escaped}".*?"label":"([^"\\]*(?:\\.[^"\\]*)*)"',
    )
    for pattern in patterns:
        match = re.search(pattern, page, re.I | re.S)
        if match:
            return _decode_json_text(match.group(1))
    return None


def _parse_public_count(value: str | None) -> int | None:
    if not value:
        return None
    normalized = value.replace("\u00a0", " ").strip().upper()
    match = re.search(r"([0-9][0-9.,]*)\s*([KMBT]?)", normalized)
    if not match:
        return None
    raw, suffix = match.groups()
    if suffix:
        try:
            number = float(raw.replace(",", ""))
        except ValueError:
            return None
        multipliers = {
            "K": 1_000,
            "M": 1_000_000,
            "B": 1_000_000_000,
            "T": 1_000_000_000_000,
        }
        return round(number * multipliers[suffix])
    digits = re.sub(r"\D", "", raw)
    return int(digits) if digits else None


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
    """Server-only client for YouTube Data API v3 with a public-page fallback."""

    def __init__(
        self, settings: Settings | None = None, client: httpx.Client | None = None
    ) -> None:
        self.settings = settings or get_settings()
        self.client = client or httpx.Client(timeout=20, follow_redirects=True)
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

    def _public_channel_url(self, identifier: str) -> str:
        text = identifier.strip()
        kind, resolved = parse_youtube_url(text)
        if not resolved:
            raise ValueError("Не удалось определить YouTube-канал")
        if kind == "handle":
            return f"{YOUTUBE_ORIGIN}/{str(resolved).lstrip('/')}"
        if kind == "channel_id":
            return f"{YOUTUBE_ORIGIN}/channel/{resolved}"
        if kind == "legacy_path":
            return f"{YOUTUBE_ORIGIN}/{resolved}"
        if kind != "video_id":
            raise ValueError("Не удалось определить YouTube-канал")

        video_url = f"{YOUTUBE_ORIGIN}/watch?v={resolved}"
        response = self.client.get(
            f"{YOUTUBE_ORIGIN}/oembed",
            params={"url": video_url, "format": "json"},
            headers=YOUTUBE_PUBLIC_HEADERS,
        )
        response.raise_for_status()
        author_url = response.json().get("author_url")
        if not isinstance(author_url, str) or not author_url.startswith(YOUTUBE_ORIGIN):
            raise RuntimeError("YouTube не вернул ссылку на автора видео")
        return author_url

    def getPublicChannelSummary(self, identifier: str) -> dict[str, Any]:  # noqa: N802
        """Read public channel totals without an API key; never fabricates unavailable values."""
        channel_url = self._public_channel_url(identifier).rstrip("/")
        about_url = f"{channel_url}/about"
        response = self.client.get(
            about_url,
            params={"hl": "en", "gl": "US"},
            headers=YOUTUBE_PUBLIC_HEADERS,
        )
        response.raise_for_status()
        page = response.text

        title = _meta_content(page, "og:title") or _youtube_text(page, "channelName")
        avatar = _meta_content(page, "og:image")
        channel_id_match = re.search(r'"channelId":"(UC[\w-]+)"', page)
        channel_id = channel_id_match.group(1) if channel_id_match else None
        canonical = _meta_content(page, "og:url") or channel_url
        canonical_path = urlparse(canonical).path.strip("/").split("/", 1)[0]
        custom_url = canonical_path if canonical_path.startswith("@") else None

        subscribers = _parse_public_count(_youtube_text(page, "subscriberCountText"))
        views = _parse_public_count(_youtube_text(page, "viewCountText"))
        publications = _parse_public_count(
            _youtube_text(page, "videoCountText") or _youtube_text(page, "videosCountText")
        )

        if not title and not channel_id:
            raise RuntimeError("YouTube не вернул данные канала")

        statistics: dict[str, str] = {}
        if views is not None:
            statistics["viewCount"] = str(views)
        if subscribers is not None:
            statistics["subscriberCount"] = str(subscribers)
        if publications is not None:
            statistics["videoCount"] = str(publications)

        snippet: dict[str, Any] = {
            "title": title or custom_url or channel_id or identifier,
        }
        if custom_url:
            snippet["customUrl"] = custom_url
        if avatar:
            snippet["thumbnails"] = {"default": {"url": avatar}}

        return {
            "id": channel_id or custom_url or channel_url,
            "snippet": snippet,
            "statistics": statistics,
        }

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
