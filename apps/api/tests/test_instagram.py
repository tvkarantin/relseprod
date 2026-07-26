"""Tests for the Instagram profile normalizer."""

from __future__ import annotations

import pytest

from app.core.errors import ErrorCode, InvalidInstagramProfileError
from app.services.instagram import normalize_instagram_profile

EXPECTED_URL = "https://www.instagram.com/example/"


@pytest.mark.parametrize(
    "value",
    [
        "example",
        "@example",
        " example ",
        "example/",
        "instagram.com/example",
        "https://instagram.com/example/",
        "https://www.instagram.com/example",
        "https://www.instagram.com/example/",
        "http://instagram.com/example",
        "https://www.instagram.com/example/?hl=ru",
        "https://www.instagram.com/example/?hl=ru&utm_source=x",
        "https://www.instagram.com/example/#section",
        "https://www.instagram.com/@example",
    ],
)
def test_valid_inputs_normalize_to_canonical_profile(value: str) -> None:
    profile = normalize_instagram_profile(value)
    assert profile.username == "example"
    assert profile.profile_url == EXPECTED_URL


@pytest.mark.parametrize(
    ("value", "expected_username"),
    [
        ("EXAMPLE", "example"),
        ("@ExAmPlE", "example"),
        ("https://www.instagram.com/ExAmple/", "example"),
        ("user.name_1", "user.name_1"),
        ("a" * 30, "a" * 30),
    ],
)
def test_username_is_lowercased_and_allows_dots_and_underscores(
    value: str, expected_username: str
) -> None:
    profile = normalize_instagram_profile(value)
    assert profile.username == expected_username
    assert profile.profile_url == f"https://www.instagram.com/{expected_username}/"


@pytest.mark.parametrize(
    "value",
    [
        "",
        "   ",
        "@",
        "user name",
        "user-name",
        "юзернейм",
        "user!name",
        "user#name",
        "a" * 31,
        "@" + "b" * 31,
        "https://www.instagram.com/" + "c" * 31 + "/",
        "https://www.instagram.com/reel/Cxyz123/",
        "https://www.instagram.com/reels/Cxyz123/",
        "https://www.instagram.com/p/Cxyz123/",
        "https://www.instagram.com/stories/example/123/",
        "https://www.instagram.com/explore/tags/reels/",
        "https://www.instagram.com/accounts/login/",
        "https://www.instagram.com/direct/inbox/",
        "https://instagram.com/reel/",
        "https://example.com/example/",
        "https://facebook.com/example",
        "https://instagram.com.evil.com/example",
        "ftp://instagram.com/example",
        "https://www.instagram.com/",
        "https://www.instagram.com/example/tagged/extra/",
    ],
)
def test_invalid_inputs_raise_invalid_instagram_profile(value: str) -> None:
    with pytest.raises(InvalidInstagramProfileError) as exc_info:
        normalize_instagram_profile(value)
    assert exc_info.value.code is ErrorCode.INVALID_INSTAGRAM_PROFILE


def test_error_carries_safe_details_and_is_not_a_plain_value_error() -> None:
    with pytest.raises(InvalidInstagramProfileError) as exc_info:
        normalize_instagram_profile("user-name")

    error = exc_info.value
    assert error.details["reason"] == "invalid_characters"
    assert error.details["value"] == "user-name"
    assert error.status_code == 422
    assert type(error) is not ValueError


def test_profile_is_hashable_and_immutable() -> None:
    profile = normalize_instagram_profile("example")
    assert hash(profile) == hash(normalize_instagram_profile("@EXAMPLE"))
    with pytest.raises(AttributeError):
        profile.username = "other"  # type: ignore[misc]
