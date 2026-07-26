"""Tests for application settings."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from app.core.config import API_DIR, AppEnv, Settings, get_settings

if TYPE_CHECKING:
    from pathlib import Path


def make_settings(**overrides: object) -> Settings:
    defaults: dict[str, object] = {"cors_origins": ["http://localhost:4173"]}
    return Settings(**(defaults | overrides))  # type: ignore[arg-type]


def test_defaults_do_not_require_apify_credentials() -> None:
    settings = make_settings(apify_api_token="", apify_actor_id="")

    assert settings.apify_configured is False
    assert settings.apify_results_limit == 20
    assert settings.apify_timeout_seconds == 300
    assert settings.apify_poll_interval_seconds == 3


def test_apify_configured_requires_both_token_and_actor() -> None:
    assert make_settings(apify_api_token="t", apify_actor_id="").apify_configured is False
    assert make_settings(apify_api_token="", apify_actor_id="a").apify_configured is False
    assert make_settings(apify_api_token="t", apify_actor_id="a").apify_configured is True


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("http://localhost:4173", ["http://localhost:4173"]),
        (
            "http://localhost:4173,http://localhost:5173",
            ["http://localhost:4173", "http://localhost:5173"],
        ),
        (" http://a.test , http://b.test ", ["http://a.test", "http://b.test"]),
        ("", ["http://localhost:4173"]),
    ],
)
def test_cors_origins_are_parsed_from_a_comma_separated_string(
    raw: str, expected: list[str]
) -> None:
    assert make_settings(cors_origins=raw).cors_origins == expected


def test_cors_origins_accept_a_real_list() -> None:
    assert make_settings(cors_origins=["http://x.test"]).cors_origins == ["http://x.test"]


def test_relative_sqlite_paths_resolve_against_the_api_directory() -> None:
    settings = make_settings(database_url="sqlite:///./data/relseprod.db")

    expected = (API_DIR / "data" / "relseprod.db").resolve().as_posix()
    assert settings.sqlalchemy_database_url == f"sqlite:///{expected}"
    assert settings.is_sqlite is True


def test_absolute_and_memory_sqlite_urls_are_left_untouched(tmp_path: Path) -> None:
    absolute = f"sqlite:///{(tmp_path / 'x.db').as_posix()}"
    assert make_settings(database_url=absolute).sqlalchemy_database_url == absolute
    assert (
        make_settings(database_url="sqlite:///:memory:").sqlalchemy_database_url
        == "sqlite:///:memory:"
    )


def test_log_level_is_normalized_and_env_is_typed() -> None:
    settings = make_settings(log_level="debug", app_env="testing")

    assert settings.log_level == "DEBUG"
    assert settings.app_env is AppEnv.TESTING


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()
