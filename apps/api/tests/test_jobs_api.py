"""Tests for the parsing job endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from fastapi.testclient import TestClient

from app.core.errors import ErrorCode
from app.database.base import utcnow
from app.models import Competitor, ParsingJob, ParsingJobStatus, ReelImportMode

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

JOBS = "/api/v1/jobs"


def error_code(response: Any) -> str:
    payload = response.json()
    assert set(payload) == {"error"}
    return payload["error"]["code"]


@pytest.fixture
def competitor(db_session: Session) -> Competitor:
    item = Competitor(
        instagram_username="jobowner",
        profile_url="https://www.instagram.com/jobowner/",
    )
    db_session.add(item)
    db_session.commit()
    return item


def make_job(
    db_session: Session, competitor: Competitor, status: ParsingJobStatus, **fields: Any
) -> ParsingJob:
    job = ParsingJob(competitor_id=competitor.id, status=status, **fields)
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def test_queued_job_is_returned(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    job = make_job(db_session, competitor, ParsingJobStatus.QUEUED)

    response = client.get(f"{JOBS}/{job.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == job.id
    assert body["competitorId"] == competitor.id
    assert body["status"] == "queued"
    assert body["importMode"] == "popular"
    assert body["progress"] == 0
    assert body["reelsCreated"] == 0
    assert body["reelsUpdated"] == 0
    assert body["errorMessage"] is None
    assert body["startedAt"] is None
    assert body["completedAt"] is None
    assert body["createdAt"] is not None


def test_running_job_is_returned_with_progress(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    job = make_job(
        db_session,
        competitor,
        ParsingJobStatus.RUNNING,
        progress=50,
        apify_run_id="run-abc",
        started_at=utcnow(),
    )

    body = client.get(f"{JOBS}/{job.id}").json()

    assert body["status"] == "running"
    assert body["progress"] == 50
    assert body["apifyRunId"] == "run-abc"
    assert body["startedAt"] is not None
    assert body["completedAt"] is None


def test_job_response_uses_camel_case_only(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    job = make_job(db_session, competitor, ParsingJobStatus.COMPLETED, reels_created=5)

    body = client.get(f"{JOBS}/{job.id}").json()

    assert set(body) == {
        "id",
        "competitorId",
        "apifyRunId",
        "importMode",
        "status",
        "progress",
        "reelsCreated",
        "reelsUpdated",
        "errorMessage",
        "startedAt",
        "completedAt",
        "createdAt",
    }
    assert body["reelsCreated"] == 5


def test_unknown_job_returns_404(client: TestClient) -> None:
    response = client.get(f"{JOBS}/999999")

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.JOB_NOT_FOUND.value


@pytest.mark.parametrize("bad_id", ["0", "-5", "abc"])
def test_non_positive_job_ids_are_rejected(client: TestClient, bad_id: str) -> None:
    response = client.get(f"{JOBS}/{bad_id}")

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


# --------------------------------------------------------------------- retry


def test_failed_job_can_be_retried(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    stub_background_tasks: list[tuple[Any, ...]],
) -> None:
    failed = make_job(
        db_session,
        competitor,
        ParsingJobStatus.FAILED,
        progress=30,
        error_message="Apify упал",
        completed_at=utcnow(),
    )

    response = client.post(f"{JOBS}/{failed.id}/retry")

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["jobId"] != failed.id, "retry must create a new job"

    db_session.expire_all()
    retry = db_session.get(ParsingJob, body["jobId"])
    assert retry is not None
    assert retry.competitor_id == competitor.id
    assert retry.status is ParsingJobStatus.QUEUED
    assert retry.progress == 0
    assert retry.error_message is None


def test_retry_preserves_the_original_import_mode(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    stub_background_tasks: list[tuple[Any, ...]],
) -> None:
    failed = make_job(
        db_session,
        competitor,
        ParsingJobStatus.FAILED,
        import_mode=ReelImportMode.LATEST,
    )

    retry_id = client.post(f"{JOBS}/{failed.id}/retry").json()["jobId"]

    retry = db_session.get(ParsingJob, retry_id)
    assert retry is not None
    assert retry.import_mode is ReelImportMode.LATEST


def test_retry_does_not_modify_the_failed_job(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    stub_background_tasks: list[tuple[Any, ...]],
) -> None:
    failed = make_job(
        db_session,
        competitor,
        ParsingJobStatus.FAILED,
        progress=30,
        error_message="Исходная ошибка",
        reels_created=2,
        completed_at=utcnow(),
    )
    original = (
        failed.status,
        failed.progress,
        failed.error_message,
        failed.reels_created,
        failed.completed_at,
    )

    client.post(f"{JOBS}/{failed.id}/retry")
    db_session.expire_all()

    unchanged = db_session.get(ParsingJob, failed.id)
    assert unchanged is not None
    assert (
        unchanged.status,
        unchanged.progress,
        unchanged.error_message,
        unchanged.reels_created,
        unchanged.completed_at,
    ) == original


def test_retry_schedules_the_background_task_with_the_new_job_id(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    stub_background_tasks: list[tuple[Any, ...]],
) -> None:
    failed = make_job(db_session, competitor, ParsingJobStatus.FAILED)

    new_job_id = client.post(f"{JOBS}/{failed.id}/retry").json()["jobId"]

    assert len(stub_background_tasks) == 1
    func_ref, args, _kwargs = stub_background_tasks[0]
    assert func_ref.__name__ == "parse_competitor_job"
    assert args[0] == new_job_id


@pytest.mark.parametrize(
    "status",
    [ParsingJobStatus.QUEUED, ParsingJobStatus.RUNNING, ParsingJobStatus.COMPLETED],
)
def test_retry_is_rejected_for_non_failed_jobs(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    status: ParsingJobStatus,
) -> None:
    job = make_job(db_session, competitor, status)

    response = client.post(f"{JOBS}/{job.id}/retry")

    assert response.status_code == 409
    assert error_code(response) == ErrorCode.INVALID_JOB_STATE.value
    assert response.json()["error"]["details"]["status"] == status.value


def test_retry_of_unknown_job_returns_404(client: TestClient) -> None:
    response = client.post(f"{JOBS}/999999/retry")

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.JOB_NOT_FOUND.value


def test_retry_is_blocked_when_another_job_is_active(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    failed = make_job(db_session, competitor, ParsingJobStatus.FAILED)
    active = make_job(db_session, competitor, ParsingJobStatus.RUNNING)

    response = client.post(f"{JOBS}/{failed.id}/retry")

    assert response.status_code == 409
    assert error_code(response) == ErrorCode.ACTIVE_JOB_ALREADY_EXISTS.value
    assert response.json()["error"]["details"]["jobId"] == active.id
