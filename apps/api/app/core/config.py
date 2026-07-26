"""Application configuration loaded from environment variables."""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]
"""Absolute path of ``apps/api`` — the backend project root."""

DEFAULT_CORS_ORIGINS: tuple[str, ...] = ("http://localhost:4173",)


class AppEnv(StrEnum):
    """Supported runtime environments."""

    DEVELOPMENT = "development"
    TESTING = "testing"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Typed application settings.

    Values are read from the process environment and from ``apps/api/.env``.
    Apify credentials are intentionally optional at this stage: the application
    must start without them.
    """

    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: AppEnv = AppEnv.DEVELOPMENT
    app_host: str = "127.0.0.1"
    app_port: int = Field(default=8000, ge=1, le=65535)

    database_url: str = "sqlite:///./data/relseprod.db"

    apify_api_token: str = ""
    apify_actor_id: str = ""
    apify_results_limit: int = Field(default=20, ge=1, le=1000)
    apify_timeout_seconds: int = Field(default=300, ge=1)
    apify_poll_interval_seconds: int = Field(default=3, ge=1)

    # ``NoDecode`` disables the built-in JSON decoding for complex types so the
    # plain comma-separated ``CORS_ORIGINS`` value is handled by the validator below.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: list(DEFAULT_CORS_ORIGINS)
    )

    log_level: str = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Accept a comma-separated string as well as a real list."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins", mode="after")
    @classmethod
    def _fallback_cors_origins(cls, value: list[str]) -> list[str]:
        return value or list(DEFAULT_CORS_ORIGINS)

    @field_validator("log_level", mode="after")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        return value.strip().upper()

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def apify_configured(self) -> bool:
        """Whether Apify integration can be used (not required in this stage)."""
        return bool(self.apify_api_token and self.apify_actor_id)

    @property
    def sqlalchemy_database_url(self) -> str:
        """Database URL with relative SQLite paths resolved against ``apps/api``.

        This makes ``sqlite:///./data/relseprod.db`` behave identically no matter
        which working directory uvicorn, alembic or pytest were started from.
        """
        url = self.database_url
        prefix = "sqlite:///"
        if not url.startswith(prefix):
            return url
        raw_path = url[len(prefix) :]
        if raw_path in {"", ":memory:"} or raw_path.startswith(":memory:"):
            return url
        path = Path(raw_path)
        if path.is_absolute():
            return url
        return f"{prefix}{(API_DIR / path).resolve().as_posix()}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
