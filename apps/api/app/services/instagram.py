"""Instagram profile normalization.

Turns any user input (``example``, ``@example``, a profile URL with query
string, ...) into a canonical username plus profile URL.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from app.core.errors import InvalidInstagramProfileError

USERNAME_MAX_LENGTH = 30
USERNAME_PATTERN = re.compile(rf"[a-z0-9._]{{1,{USERNAME_MAX_LENGTH}}}")
PROFILE_URL_TEMPLATE = "https://www.instagram.com/{username}/"

ALLOWED_HOSTS = frozenset({"instagram.com", "www.instagram.com"})

RESERVED_PATH_SEGMENTS = frozenset(
    {
        "reel",
        "reels",
        "p",
        "stories",
        "explore",
        "accounts",
        "direct",
        "tv",
        "s",
        "web",
        "developer",
        "about",
        "legal",
        "privacy",
        "terms",
    }
)


@dataclass(frozen=True, slots=True)
class InstagramProfile:
    """Canonical representation of an Instagram profile."""

    username: str
    profile_url: str


def _fail(value: str, reason: str) -> InvalidInstagramProfileError:
    return InvalidInstagramProfileError(
        "Некорректная ссылка или имя профиля Instagram",
        details={"value": value[:200], "reason": reason},
    )


def _extract_candidate(raw: str) -> str:
    """Reduce arbitrary input to the bare username candidate."""
    value = raw.strip()

    # "example/" is a bare username with a stray trailing slash, not a URL.
    if "://" not in value and "." not in value.split("/")[0]:
        value = value.rstrip("/")

    looks_like_url = "/" in value or value.startswith(("http://", "https://"))
    if not looks_like_url:
        return value.removeprefix("@")

    # urlsplit needs a scheme to recognise the host part.
    candidate_url = value if "://" in value else f"https://{value}"
    parts = urlsplit(candidate_url)

    if parts.scheme not in {"http", "https"}:
        raise _fail(raw, "unsupported_scheme")

    host = (parts.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise _fail(raw, "unsupported_host")

    # Query string and fragment are dropped by urlsplit; keep only the path.
    segments = [segment for segment in parts.path.split("/") if segment]
    if not segments:
        raise _fail(raw, "missing_username")
    if len(segments) > 1:
        raise _fail(raw, "not_a_profile_url")

    username = segments[0]
    if username.lower() in RESERVED_PATH_SEGMENTS:
        raise _fail(raw, "reserved_path")
    return username.removeprefix("@")


def normalize_instagram_profile(value: str) -> InstagramProfile:
    """Normalize ``value`` into an :class:`InstagramProfile`.

    Raises:
        InvalidInstagramProfileError: if the value is not a usable profile
            reference. A plain ``ValueError`` is never propagated to callers.
    """
    if not isinstance(value, str):  # pragma: no cover - defensive, schemas type-check first
        raise _fail(str(value), "not_a_string")

    if not value.strip():
        raise _fail(value, "empty_value")

    username = _extract_candidate(value)

    # Strip a trailing slash left over from inputs such as "example/".
    username = username.strip().strip("/").removeprefix("@").lower()

    if not username:
        raise _fail(value, "empty_username")
    if len(username) > USERNAME_MAX_LENGTH:
        raise _fail(value, "username_too_long")
    if not USERNAME_PATTERN.fullmatch(username):
        raise _fail(value, "invalid_characters")
    if username in RESERVED_PATH_SEGMENTS:
        raise _fail(value, "reserved_path")

    return InstagramProfile(
        username=username,
        profile_url=PROFILE_URL_TEMPLATE.format(username=username),
    )
