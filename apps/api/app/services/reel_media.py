"""Safe retrieval of short-lived Instagram reel thumbnails."""

from __future__ import annotations

import ipaddress
import os
import subprocess
from dataclasses import dataclass
from urllib.parse import parse_qs, quote, urlsplit

import httpx

_ALLOWED_HOST_SUFFIXES = (".cdninstagram.com", ".fbcdn.net")
_TRUSTED_EDGE_HOST = "tphahouachokghqlsczf.supabase.co"
_TRUSTED_EDGE_PATH = "/functions/v1/instagram-imginn"
_MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024
_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Referer": "https://www.instagram.com/",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}
_IMAGE_PROXY_BASE_URL = "https://images.weserv.nl/"
_DOH_URL = "https://dns.google/resolve"


class ReelThumbnailFetchError(Exception):
    """The stored thumbnail cannot be exposed safely or fetched."""


@dataclass(frozen=True, slots=True)
class ReelThumbnailPayload:
    content: bytes
    media_type: str


def _image_media_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _fetch_with_doh_curl(url: str) -> ReelThumbnailPayload:
    """Fetch Instagram media when the system DNS blocks Meta CDN domains."""
    hostname = (urlsplit(url).hostname or "").lower()
    try:
        dns_response = httpx.get(
            _DOH_URL,
            params={"name": hostname, "type": "A"},
            timeout=10.0,
        )
        dns_response.raise_for_status()
        answers = dns_response.json().get("Answer", [])
        addresses = [
            answer.get("data")
            for answer in answers
            if isinstance(answer, dict) and answer.get("type") == 1
        ]
        address = next(
            value
            for value in addresses
            if isinstance(value, str) and ipaddress.ip_address(value).is_global
        )
    except (httpx.HTTPError, ValueError, KeyError, StopIteration) as exc:
        raise ReelThumbnailFetchError("Could not resolve Instagram CDN host") from exc

    executable = "curl.exe" if os.name == "nt" else "curl"
    try:
        completed = subprocess.run(
            [
                executable,
                "-L",
                "--silent",
                "--show-error",
                "--max-time",
                "25",
                "--max-filesize",
                str(_MAX_THUMBNAIL_BYTES),
                "--resolve",
                f"{hostname}:443:{address}",
                "-H",
                f"Referer: {_REQUEST_HEADERS['Referer']}",
                "-H",
                f"User-Agent: {_REQUEST_HEADERS['User-Agent']}",
                url,
            ],
            check=False,
            capture_output=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ReelThumbnailFetchError("Thumbnail fallback request failed") from exc

    media_type = _image_media_type(completed.stdout)
    if completed.returncode != 0 or media_type is None:
        raise ReelThumbnailFetchError("Thumbnail fallback returned invalid content")
    if len(completed.stdout) > _MAX_THUMBNAIL_BYTES:
        raise ReelThumbnailFetchError("Thumbnail is too large")
    return ReelThumbnailPayload(content=completed.stdout, media_type=media_type)


def _is_allowed_instagram_media_url(url: str) -> bool:
    parsed = urlsplit(url)
    hostname = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(
        hostname.endswith(suffix) for suffix in _ALLOWED_HOST_SUFFIXES
    )


def _is_trusted_edge_thumbnail_url(url: str) -> bool:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or (parsed.hostname or "").lower() != _TRUSTED_EDGE_HOST
        or parsed.path != _TRUSTED_EDGE_PATH
    ):
        return False
    thumbnail_values = parse_qs(parsed.query).get("thumbnail", [])
    return any(value.strip() for value in thumbnail_values)


def _response_media_type(response: httpx.Response) -> str:
    declared = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if declared.startswith("image/"):
        return declared
    detected = _image_media_type(response.content)
    if detected is None:
        raise ReelThumbnailFetchError("Thumbnail response is not an image")
    return detected


def _validate_thumbnail_response(response: httpx.Response) -> ReelThumbnailPayload:
    if response.status_code != 200:
        raise ReelThumbnailFetchError("Thumbnail request failed")
    if len(response.content) > _MAX_THUMBNAIL_BYTES:
        raise ReelThumbnailFetchError("Thumbnail is too large")
    return ReelThumbnailPayload(
        content=response.content,
        media_type=_response_media_type(response),
    )


def _fetch_trusted_edge_thumbnail(
    url: str,
    *,
    client: httpx.Client | None = None,
) -> ReelThumbnailPayload:
    owns_client = client is None
    active_client = client or httpx.Client(
        timeout=httpx.Timeout(12.0, connect=5.0),
        follow_redirects=True,
    )
    try:
        response = active_client.get(url, headers=_REQUEST_HEADERS)
    except httpx.HTTPError as exc:
        raise ReelThumbnailFetchError("Thumbnail request failed") from exc
    finally:
        if owns_client:
            active_client.close()

    final_host = (urlsplit(str(response.url)).hostname or "").lower()
    final_host_allowed = final_host == _TRUSTED_EDGE_HOST or any(
        final_host.endswith(suffix) for suffix in _ALLOWED_HOST_SUFFIXES
    )
    if not final_host_allowed:
        raise ReelThumbnailFetchError("Thumbnail redirected to an unsupported host")
    return _validate_thumbnail_response(response)


def fetch_reel_thumbnail(
    url: str,
    *,
    client: httpx.Client | None = None,
) -> ReelThumbnailPayload:
    """Fetch one Instagram thumbnail with browser-like headers.

    Stored thumbnails may be either direct Instagram CDN links or URLs produced
    by the project's own Supabase Edge media function. Every accepted host and
    redirect target is allow-listed so this endpoint cannot become an arbitrary
    HTTP proxy.
    """
    if _is_trusted_edge_thumbnail_url(url):
        return _fetch_trusted_edge_thumbnail(url, client=client)

    if not _is_allowed_instagram_media_url(url):
        raise ReelThumbnailFetchError("Unsupported thumbnail host")

    owns_client = client is None
    active_client = client or httpx.Client(
        timeout=httpx.Timeout(12.0, connect=5.0),
        follow_redirects=True,
    )
    proxy_url = (
        f"{_IMAGE_PROXY_BASE_URL}?url={quote(url, safe='')}"
        "&w=720&fit=cover&output=jpg"
    )
    try:
        response = active_client.get(proxy_url, headers=_REQUEST_HEADERS)
    except httpx.HTTPError as exc:
        raise ReelThumbnailFetchError("Thumbnail request failed") from exc
    finally:
        if owns_client:
            active_client.close()

    if response.status_code != 200:
        return _fetch_with_doh_curl(url)
    final_host = (urlsplit(str(response.url)).hostname or "").lower()
    if final_host not in {"images.weserv.nl", "weserv.nl"}:
        raise ReelThumbnailFetchError("Thumbnail redirected to an unsupported host")

    return _validate_thumbnail_response(response)
