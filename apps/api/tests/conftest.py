"""Shared pytest fixtures.

Every test run gets its own temporary SQLite file, created by running the real
Alembic migrations. The production database (``data/relseprod.db``) is never
touched, and ``get_db`` is overridden so the API talks to the temporary one.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import DbSession
from app.core.config import API_DIR, Settings
from app.database.session import enable_sqlite_foreign_keys
from app.main import create_app

if TYPE_CHECKING:
    from collections.abc import Generator, Iterator
    from pathlib import Path

    from fastapi import FastAPI


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

    alembic_cfg = Config(str(API_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.sqlalchemy_database_url)
    command.upgrade(alembic_cfg, "head")

    yield test_engine
    test_engine.dispose()


@pytest.fixture(scope="session")
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db_session(
    engine: Engine, session_factory: sessionmaker[Session]
) -> Generator[Session, None, None]:
    """Isolated session: every test runs inside a transaction that is rolled back."""
    connection = engine.connect()
    transaction = connection.begin()
    session = session_factory(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def app(settings: Settings, db_session: Session) -> FastAPI:
    """FastAPI app whose ``get_db`` dependency yields the isolated test session."""
    application = create_app(settings)

    def override_get_db() -> Iterator[Session]:
        yield db_session

    application.dependency_overrides[DbSession] = override_get_db
    return application


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    """Synchronous HTTP client used by every API test."""
    with TestClient(app) as test_client:
        yield test_client
