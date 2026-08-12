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
    """Typed application settings loaded from environment variables and ``.env``."""

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

    youtube_api_key: str = ""
    youtube_daily_quota_limit: int = Field(default=9000, ge=100, le=10000)
    youtube_monitoring_enabled: bool = True

    # Instagram import: use free Instaloader first, with Apify kept as fallback.
    instagram_primary_provider: str = "instaloader"
    instaloader_session_username: str = ""
    instaloader_session_file: str = ""
    instaloader_timeout_seconds: int = Field(default=30, ge=5, le=300)
    instaloader_max_connection_attempts: int = Field(default=2, ge=1, le=10)

    apify_api_token: str = ""
    apify_actor_id: str = ""
    apify_actor_input_style: str = "auto"
    apify_base_url: str = "https://api.apify.com/v2"
    apify_results_limit: int = Field(default=20, ge=1, le=1000)
    apify_timeout_seconds: int = Field(default=300, ge=1)
    apify_poll_interval_seconds: int = Field(default=3, ge=1)

    deepgram_api_key: str = ""
    deepgram_base_url: str = "https://api.deepgram.com/v1"
    deepgram_model: str = "nova-3"
    deepgram_language: str = "multi"
    deepgram_timeout_seconds: int = Field(default=180, ge=10, le=1800)
    deepgram_smart_format: bool = True
    deepgram_utterances: bool = True
    deepgram_paragraphs: bool = True
    deepgram_numerals: bool = True
    deepgram_punctuate: bool = True

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-oss-120b:free"
    openrouter_timeout_seconds: int = Field(default=180, ge=10, le=1800)
    openrouter_temperature: float = Field(default=0.1, ge=0, le=2)
    openrouter_max_output_tokens: int = Field(default=4096, ge=256, le=16384)
    openrouter_reasoning_effort: str = "low"
    openrouter_response_healing: bool = True
    openrouter_http_referer: str = ""
    openrouter_app_title: str = "Reels Finder"
    openrouter_invalid_response_retries: int = Field(default=1, ge=0, le=1)

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

    @field_validator("instagram_primary_provider", mode="after")
    @classmethod
    def _normalize_instagram_primary_provider(cls, value: str) -> str:
        normalized = value.strip().lower() or "instaloader"
        allowed = {"instaloader", "apify"}
        if normalized not in allowed:
            msg = f"instagram_primary_provider must be one of {sorted(allowed)}"
            raise ValueError(msg)
        return normalized

    @field_validator("apify_actor_input_style", mode="after")
    @classmethod
    def _normalize_input_style(cls, value: str) -> str:
        normalized = value.strip().lower() or "auto"
        allowed = {"auto", "username", "direct_urls"}
        if normalized not in allowed:
            msg = f"apify_actor_input_style must be one of {sorted(allowed)}"
            raise ValueError(msg)
        return normalized

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def apify_configured(self) -> bool:
        """Whether Apify integration can be used as a source or fallback."""
        return bool(self.apify_api_token and self.apify_actor_id)

    @property
    def instaloader_session_configured(self) -> bool:
        """Whether an authenticated Instaloader session was requested."""
        return bool(self.instaloader_session_username.strip())

    @property
    def deepgram_configured(self) -> bool:
        """Whether Deepgram integration can be used."""
        return bool(self.deepgram_api_key)

    @property
    def openrouter_configured(self) -> bool:
        return bool(self.openrouter_api_key)

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
