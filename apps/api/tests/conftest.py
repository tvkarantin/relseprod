"""Shared pytest fixtures.

Every test run gets its own temporary SQLite file, created by running the real
Alembic migrations. The production database (``data/relseprod.db``) is never
touched, and ``get_db`` is overridden so the API talks to the temporary one.

Isolation strategy
------------------
The service layer commits its own transactions, and the pysqlite driver does not
hold an enclosing transaction open across those commits. Wrapping tests in an
outer transaction is therefore unreliable, so every test instead starts from an
empty schema: all tables are cleared before and after each test. This keeps the
tests order-independent without recreating the database each time.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, delete
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import DbSession
from app.core.config import API_DIR, Settings
from app.database.base import Base
from app.database.session import enable_sqlite_foreign_keys, register_unicode_lower
from app.main import create_app
from app.models import Competitor, ParsingJob, Reel, ReelContent, ReelTranscription

if TYPE_CHECKING:
    from collections.abc import Generator, Iterator
    from pathlib import Path

    from fastapi import FastAPI

# Child tables first so foreign keys are never violated.
CLEANUP_ORDER = (ReelContent, ReelTranscription, Reel, ParsingJob, Competitor)


@pytest.fixture(scope="session")
def database_path(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Path of the temporary SQLite database used by the whole test session."""
    return tmp_path_factory.mktemp("db") / "test.db"


@pytest.fixture(scope="session")
def database_url(database_path: Path) -> str:
    return f"sqlite:///{database_path.as_posix()}"


@pytest.fixture(scope="session")
def settings(database_url: str) -> Settings:
    """Settings pointing at the temporary database."""
    return Settings(
        app_env="testing",
        database_url=database_url,
        apify_api_token="",
        apify_actor_id="",
        cors_origins=["http://localhost:4173"],
    )


@pytest.fixture(scope="session")
def engine(settings: Settings) -> Generator[Engine, None, None]:
    """Engine bound to the temporary database with the schema migrated."""
    test_engine = create_engine(
        settings.sqlalchemy_database_url,
        connect_args={"check_same_thread": False},
        future=True,
    )
    enable_sqlite_foreign_keys(test_engine)
    register_unicode_lower(test_engine)

    alembic_cfg = Config(str(API_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.sqlalchemy_database_url)
    command.upgrade(alembic_cfg, "head")

    assert set(Base.metadata.tables) == {
        "competitors",
        "reels",
        "reel_content",
        "parsing_jobs",
        "reel_transcriptions",
        "reel_analyses",
    }

    yield test_engine
    test_engine.dispose()


@pytest.fixture(scope="session")
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def _clear_tables(engine: Engine) -> None:
    """Delete every row so each test starts from a known empty state."""
    with engine.begin() as connection:
        for model in CLEANUP_ORDER:
            connection.execute(delete(model))


@pytest.fixture(autouse=True)
def clean_database(engine: Engine) -> Generator[None, None, None]:
    """Guarantee an empty database before and after every test."""
    _clear_tables(engine)
    yield
    _clear_tables(engine)


@pytest.fixture
def db_session(session_factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    """A session on the (empty) temporary database."""
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def app(settings: Settings, db_session: Session) -> FastAPI:
    """FastAPI app whose ``get_db`` dependency yields the test session."""
    application = create_app(settings)

    def override_get_db() -> Iterator[Session]:
        yield db_session

    application.dependency_overrides[DbSession] = override_get_db
    return application


@pytest.fixture
def stub_background_tasks(monkeypatch: pytest.MonkeyPatch) -> list[tuple[Any, ...]]:
    """Capture scheduled background tasks instead of running them.

    Without this, ``POST /parse`` would try to reach the real Apify API.
    Each entry is ``(func, args, kwargs)``.
    """
    scheduled: list[tuple[Any, ...]] = []

    def fake_add_task(self: BackgroundTasks, func: Any, *args: Any, **kwargs: Any) -> None:
        scheduled.append((func, args, kwargs))

    monkeypatch.setattr(BackgroundTasks, "add_task", fake_add_task)
    return scheduled


@pytest.fixture
def client(
    app: FastAPI, stub_background_tasks: list[tuple[Any, ...]]
) -> Generator[TestClient, None, None]:
    """Synchronous HTTP client used by every API test.

    Background tasks are stubbed out by default so no test can accidentally call
    the real Apify API.
    """
    with TestClient(app) as test_client:
        yield test_client
