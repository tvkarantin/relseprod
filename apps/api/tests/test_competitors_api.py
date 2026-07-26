"""Tests for the competitor endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.errors import ErrorCode
from app.models import Competitor, ParsingJob, ParsingJobStatus, Reel, ReelContent

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

BASE = "/api/v1/competitors"


def error_code(response: Any) -> str:
    payload = response.json()
    assert set(payload) == {"error"}
    assert set(payload["error"]) == {"code", "message", "details"}
    return payload["error"]["code"]


@pytest.mark.parametrize(
    ("profile", "expected_username"),
    [
        ("example", "example"),
        ("@example", "example"),
        ("https://instagram.com/example/", "example"),
        ("https://www.instagram.com/example", "example"),
        ("https://www.instagram.com/example/?hl=ru", "example"),
        ("EXAMPLE", "example"),
        ("@ExAmPlE", "example"),
    ],
)
def test_competitor_is_created_from_any_profile_form(
    client: TestClient, profile: str, expected_username: str
) -> None:
    response = client.post(BASE, json={"profile": profile})

    assert response.status_code == 201
    body = response.json()
    assert body["instagramUsername"] == expected_username
    assert body["profileUrl"] == f"https://www.instagram.com/{expected_username}/"
    assert body["status"] == "idle"
    assert body["reelsCount"] == 0
    assert body["lastParsedAt"] is None
    assert body["id"] > 0


def test_response_uses_camel_case_only(client: TestClient) -> None:
    body = client.post(BASE, json={"profile": "camelcheck"}).json()

    assert set(body) == {
        "id",
        "instagramUsername",
        "profileUrl",
        "status",
        "reelsCount",
        "lastParsedAt",
        "createdAt",
        "updatedAt",
    }


def test_duplicate_competitor_is_rejected_with_409(client: TestClient) -> None:
    client.post(BASE, json={"profile": "duplicate"})

    response = client.post(BASE, json={"profile": "@DUPLICATE"})

    assert response.status_code == 409
    assert error_code(response) == ErrorCode.COMPETITOR_ALREADY_EXISTS.value
    assert response.json()["error"]["details"]["instagramUsername"] == "duplicate"


@pytest.mark.parametrize(
    "profile",
    ["", "   ", "user-name", "https://example.com/user", "https://www.instagram.com/reel/X/"],
)
def test_invalid_profiles_are_rejected(client: TestClient, profile: str) -> None:
    response = client.post(BASE, json={"profile": profile})

    assert response.status_code == 422
    assert error_code(response) in {
        ErrorCode.VALIDATION_ERROR.value,
        ErrorCode.INVALID_INSTAGRAM_PROFILE.value,
    }


def test_profile_longer_than_500_characters_is_rejected(client: TestClient) -> None:
    response = client.post(BASE, json={"profile": "a" * 501})

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


def test_missing_profile_field_returns_validation_error(client: TestClient) -> None:
    response = client.post(BASE, json={})

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


def test_list_returns_competitors_newest_first(client: TestClient) -> None:
    for name in ("first", "second", "third"):
        assert client.post(BASE, json={"profile": name}).status_code == 201

    response = client.get(BASE)

    assert response.status_code == 200
    usernames = [item["instagramUsername"] for item in response.json()]
    assert usernames == ["third", "second", "first"]


def test_list_is_empty_when_nothing_is_tracked(client: TestClient) -> None:
    assert client.get(BASE).json() == []


def test_single_competitor_can_be_fetched(client: TestClient) -> None:
    created = client.post(BASE, json={"profile": "single"}).json()

    response = client.get(f"{BASE}/{created['id']}")

    assert response.status_code == 200
    assert response.json()["instagramUsername"] == "single"


def test_unknown_competitor_returns_404(client: TestClient) -> None:
    response = client.get(f"{BASE}/999999")

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.COMPETITOR_NOT_FOUND.value


@pytest.mark.parametrize("bad_id", ["0", "-1", "abc"])
def test_non_positive_path_ids_are_rejected(client: TestClient, bad_id: str) -> None:
    response = client.get(f"{BASE}/{bad_id}")

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


def test_delete_removes_the_competitor(client: TestClient) -> None:
    created = client.post(BASE, json={"profile": "removable"}).json()

    response = client.delete(f"{BASE}/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"{BASE}/{created['id']}").status_code == 404


def test_delete_cascades_to_reels_content_and_jobs(
    client: TestClient, db_session: Session
) -> None:
    created = client.post(BASE, json={"profile": "cascade"}).json()
    competitor_id = created["id"]

    reel = Reel(competitor_id=competitor_id, shortcode="CASCADE1")
    db_session.add(reel)
    db_session.flush()
    db_session.add(ReelContent(reel_id=reel.id, hook="Мой хук"))
    db_session.add(
        ParsingJob(competitor_id=competitor_id, status=ParsingJobStatus.COMPLETED)
    )
    db_session.flush()

    assert client.delete(f"{BASE}/{competitor_id}").status_code == 204
    db_session.expire_all()

    assert db_session.get(Competitor, competitor_id) is None
    assert db_session.scalar(select(func.count()).select_from(Reel)) == 0
    assert db_session.scalar(select(func.count()).select_from(ReelContent)) == 0
    assert db_session.scalar(select(func.count()).select_from(ParsingJob)) == 0


def test_delete_unknown_competitor_returns_404(client: TestClient) -> None:
    response = client.delete(f"{BASE}/999999")

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.COMPETITOR_NOT_FOUND.value


@pytest.mark.parametrize("status", [ParsingJobStatus.QUEUED, ParsingJobStatus.RUNNING])
def test_delete_is_blocked_while_a_job_is_active(
    client: TestClient, db_session: Session, status: ParsingJobStatus
) -> None:
    created = client.post(BASE, json={"profile": f"busy{status.value}"}).json()
    db_session.add(ParsingJob(competitor_id=created["id"], status=status))
    db_session.flush()

    response = client.delete(f"{BASE}/{created['id']}")

    assert response.status_code == 409
    assert error_code(response) == ErrorCode.COMPETITOR_HAS_ACTIVE_JOB.value
    assert client.get(f"{BASE}/{created['id']}").status_code == 200


@pytest.mark.parametrize("status", [ParsingJobStatus.COMPLETED, ParsingJobStatus.FAILED])
def test_delete_is_allowed_when_previous_jobs_are_finished(
    client: TestClient, db_session: Session, status: ParsingJobStatus
) -> None:
    created = client.post(BASE, json={"profile": f"done{status.value}"}).json()
    db_session.add(ParsingJob(competitor_id=created["id"], status=status))
    db_session.flush()

    assert client.delete(f"{BASE}/{created['id']}").status_code == 204


# ------------------------------------------------------------------- parsing


def test_parse_returns_202_and_queues_a_job(
    client: TestClient, db_session: Session, stub_background_tasks: list[tuple[Any, ...]]
) -> None:
    created = client.post(BASE, json={"profile": "parseme"}).json()

    response = client.post(f"{BASE}/{created['id']}/parse")

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["jobId"] > 0

    db_session.expire_all()
    job = db_session.get(ParsingJob, body["jobId"])
    assert job is not None
    assert job.status is ParsingJobStatus.QUEUED
    assert job.progress == 0
    assert job.reels_created == 0
    assert job.reels_updated == 0

    competitor = db_session.get(Competitor, created["id"])
    assert competitor is not None
    assert competitor.status.value == "queued"


def test_parse_schedules_exactly_one_background_task(
    client: TestClient, stub_background_tasks: list[tuple[Any, ...]]
) -> None:
    created = client.post(BASE, json={"profile": "scheduled"}).json()

    client.post(f"{BASE}/{created['id']}/parse")

    assert len(stub_background_tasks) == 1
    func_ref, args, _kwargs = stub_background_tasks[0]
    assert func_ref.__name__ == "parse_competitor_job"
    assert isinstance(args[0], int), "the task must receive a job id, not a Session"


def test_parse_of_unknown_competitor_returns_404(client: TestClient) -> None:
    response = client.post(f"{BASE}/999999/parse")

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.COMPETITOR_NOT_FOUND.value


def test_second_active_job_is_blocked(
    client: TestClient, stub_background_tasks: list[tuple[Any, ...]]
) -> None:
    created = client.post(BASE, json={"profile": "onlyone"}).json()
    first = client.post(f"{BASE}/{created['id']}/parse")
    assert first.status_code == 202

    second = client.post(f"{BASE}/{created['id']}/parse")

    assert second.status_code == 409
    assert error_code(second) == ErrorCode.ACTIVE_JOB_ALREADY_EXISTS.value
    assert second.json()["error"]["details"]["jobId"] == first.json()["jobId"]


def test_new_job_is_allowed_after_the_previous_one_finished(
    client: TestClient, db_session: Session, stub_background_tasks: list[tuple[Any, ...]]
) -> None:
    created = client.post(BASE, json={"profile": "again"}).json()
    first_id = client.post(f"{BASE}/{created['id']}/parse").json()["jobId"]

    job = db_session.get(ParsingJob, first_id)
    assert job is not None
    job.status = ParsingJobStatus.COMPLETED
    db_session.flush()

    second = client.post(f"{BASE}/{created['id']}/parse")

    assert second.status_code == 202
    assert second.json()["jobId"] != first_id
