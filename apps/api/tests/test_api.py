"""API-level tests: root, health, camelCase output and the error envelope."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import OperationalError

from app import __version__
from app.api.deps import DbSession
from app.core.errors import (
    CompetitorNotFoundError,
    ErrorCode,
    InvalidInstagramProfileError,
)
from app.models import Competitor, CompetitorStatus
from app.schemas.competitor import CompetitorCreate, CompetitorRead
from app.schemas.parsing_job import ParsingJobRead
from app.schemas.reel_content import ReelContentUpdate

if TYPE_CHECKING:
    from pathlib import Path

    from fastapi import FastAPI


def assert_error_envelope(payload: dict[str, Any], expected_code: ErrorCode) -> dict[str, Any]:
    """Assert the unified error format and return the inner error object."""
    assert set(payload) == {"error"}
    error = payload["error"]
    assert set(error) == {"code", "message", "details"}
    assert error["code"] == expected_code.value
    assert isinstance(error["message"], str)
    assert error["message"]
    assert isinstance(error["details"], dict)
    return error


def test_root_returns_service_info(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "name": "Reels Finder API",
        "version": __version__,
        "docs": "/docs",
    }


def test_health_reports_connected_database(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_is_also_available_under_api_v1(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_returns_503_error_envelope_when_database_is_down(app: FastAPI) -> None:
    class BrokenSession:
        def execute(self, *_args: object, **_kwargs: object) -> None:
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    app.dependency_overrides[DbSession] = lambda: BrokenSession()

    with TestClient(app, raise_server_exceptions=False) as broken_client:
        response = broken_client.get("/health")

    assert response.status_code == 503
    error = assert_error_envelope(response.json(), ErrorCode.DATABASE_ERROR)
    assert error["details"] == {"database": "disconnected"}
    assert "OperationalError" not in response.text
    assert "SELECT 1" not in response.text


def test_health_reports_503_for_an_unreachable_database(tmp_path: Path) -> None:
    """The healthcheck really queries the database, it is not a constant."""
    from app.core.config import Settings
    from app.main import create_app

    broken_database = tmp_path / "db.sqlite"
    broken_database.mkdir()
    broken_settings = Settings(
        database_url=f"sqlite:///{broken_database.as_posix()}",
        cors_origins=["http://localhost:4173"],
    )
    with TestClient(create_app(broken_settings), raise_server_exceptions=False) as broken:
        response = broken.get("/health")

    assert response.status_code == 503
    assert_error_envelope(response.json(), ErrorCode.DATABASE_ERROR)


def test_openapi_and_docs_are_available(client: TestClient) -> None:
    schema = client.get("/openapi.json")
    assert schema.status_code == 200
    body = schema.json()
    assert body["info"]["title"] == "Reels Finder API"
    assert body["info"]["version"] == __version__
    assert "/health" in body["paths"]
    assert "/api/v1/health" in body["paths"]

    docs = client.get("/docs")
    assert docs.status_code == 200
    assert "text/html" in docs.headers["content-type"]


def test_cors_headers_are_returned_for_the_configured_origin(client: TestClient) -> None:
    response = client.get("/", headers={"Origin": "http://localhost:4173"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4173"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_unknown_route_uses_the_unified_error_format(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert_error_envelope(response.json(), ErrorCode.NOT_FOUND)


def test_request_validation_returns_validation_error(app: FastAPI) -> None:
    @app.post("/test/competitors")
    def _create(payload: CompetitorCreate) -> dict[str, str]:  # pragma: no cover - via client
        return {"profile": payload.profile}

    with TestClient(app) as test_client:
        response = test_client.post("/test/competitors", json={})

    assert response.status_code == 422
    error = assert_error_envelope(response.json(), ErrorCode.VALIDATION_ERROR)
    fields = error["details"]["fields"]
    assert any(field["field"].endswith("profile") for field in fields)
    assert all({"field", "reason", "type"} == set(field) for field in fields)


def test_application_errors_are_rendered_with_their_code(app: FastAPI) -> None:
    @app.get("/test/missing-competitor")
    def _missing() -> None:  # pragma: no cover - via client
        raise CompetitorNotFoundError(details={"competitorId": 42})

    @app.get("/test/bad-profile")
    def _bad_profile() -> None:  # pragma: no cover - via client
        raise InvalidInstagramProfileError(details={"reason": "invalid_characters"})

    with TestClient(app) as test_client:
        not_found = test_client.get("/test/missing-competitor")
        bad_profile = test_client.get("/test/bad-profile")

    assert not_found.status_code == 404
    assert assert_error_envelope(not_found.json(), ErrorCode.COMPETITOR_NOT_FOUND)["details"] == {
        "competitorId": 42
    }

    assert bad_profile.status_code == 422
    assert_error_envelope(bad_profile.json(), ErrorCode.INVALID_INSTAGRAM_PROFILE)


def test_http_exceptions_are_converted_to_the_error_envelope(app: FastAPI) -> None:
    @app.get("/test/http-error")
    def _http_error() -> None:  # pragma: no cover - via client
        raise HTTPException(status_code=404, detail="Ничего нет")

    with TestClient(app) as test_client:
        response = test_client.get("/test/http-error")

    assert response.status_code == 404
    error = assert_error_envelope(response.json(), ErrorCode.NOT_FOUND)
    assert error["message"] == "Ничего нет"


def test_unexpected_exceptions_return_a_safe_internal_error(app: FastAPI) -> None:
    @app.get("/test/boom")
    def _boom() -> None:  # pragma: no cover - via client
        secret = "super-secret-token-value"
        raise RuntimeError(f"database password leaked: {secret}")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get("/test/boom")

    assert response.status_code == 500
    assert_error_envelope(response.json(), ErrorCode.INTERNAL_ERROR)
    assert "super-secret-token-value" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text


def test_competitor_schema_serializes_camel_case(db_session) -> None:
    competitor = Competitor(
        instagram_username="camel",
        profile_url="https://www.instagram.com/camel/",
        status=CompetitorStatus.READY,
        reels_count=7,
    )
    db_session.add(competitor)
    db_session.flush()

    payload = CompetitorRead.model_validate(competitor).model_dump(by_alias=True, mode="json")

    assert set(payload) == {
        "id",
        "activeJobId",
        "latestJobId",
        "instagramUsername",
        "profileUrl",
        "status",
        "reelsCount",
        "lastParsedAt",
        "createdAt",
        "updatedAt",
    }
    assert payload["instagramUsername"] == "camel"
    assert payload["activeJobId"] is None
    assert payload["latestJobId"] is None
    assert payload["reelsCount"] == 7
    assert payload["status"] == "ready"
    assert payload["lastParsedAt"] is None


def test_parsing_job_schema_serializes_camel_case() -> None:
    payload = ParsingJobRead(
        id=1,
        competitor_id=2,
        apify_run_id=None,
        status="queued",
        import_mode="popular",
        progress=0,
        reels_created=3,
        reels_updated=4,
        error_message="Ошибка",
        started_at=None,
        completed_at=None,
        created_at="2026-05-02T12:00:00Z",
    ).model_dump(by_alias=True, mode="json")

    assert payload["reelsCreated"] == 3
    assert payload["reelsUpdated"] == 4
    assert payload["importMode"] == "popular"
    assert payload["errorMessage"] == "Ошибка"
    assert payload["competitorId"] == 2
    assert "reels_created" not in payload


@pytest.mark.parametrize(
    ("field", "limit"),
    [("hook", 500), ("script", 10_000), ("cta", 1_000), ("notes", 10_000)],
)
def test_reel_content_length_limits_are_enforced(field: str, limit: int) -> None:
    assert getattr(ReelContentUpdate(**{field: "x" * limit}), field) == "x" * limit

    with pytest.raises(PydanticValidationError):
        ReelContentUpdate(**{field: "x" * (limit + 1)})


def test_reel_content_normalizes_blank_strings_to_none() -> None:
    content = ReelContentUpdate(hook="   ", script="", cta="Действуй", notes=None)

    assert content.hook is None
    assert content.script is None
    assert content.cta == "Действуй"
    assert content.notes is None
