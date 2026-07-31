"""Full backend path: add competitor → parse → import → inspect job.

Apify is replaced by an ``httpx.MockTransport``; no network call is made.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.models import Competitor, ContentStatus, ParsingJob, ParsingJobStatus, Reel
from app.services.apify import ApifyService
from app.services.parsing import ParsingService, Progress
from app.services.reel_normalizer import normalize_apify_reel

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

COMPETITORS = "/api/v1/competitors"
JOBS = "/api/v1/jobs"


def dataset_item(shortcode: str, **overrides: Any) -> dict[str, Any]:
    item: dict[str, Any] = {
        "reelId": f"id-{shortcode}",
        "shortCode": shortcode,
        "url": f"https://www.instagram.com/reel/{shortcode}/",
        "videoUrl": f"https://cdn.example.com/{shortcode}.mp4",
        "displayUrl": f"https://cdn.example.com/{shortcode}.jpg",
        "caption": f"Подпись {shortcode}",
        "videoPlayCount": 1000,
        "likesCount": 100,
        "commentsCount": 10,
        "timestamp": "2026-05-02T12:00:00.000Z",
        "videoDuration": 30.0,
    }
    item.update(overrides)
    return item


def apify_settings(**overrides: Any) -> Settings:
    defaults: dict[str, Any] = {
        "apify_api_token": "dummy-token",
        "apify_actor_id": "apify/instagram-reel-scraper",
        "apify_results_limit": 20,
        "apify_timeout_seconds": 30,
        "apify_poll_interval_seconds": 1,
        "cors_origins": ["http://localhost:4173"],
    }
    return Settings(**(defaults | overrides))


def make_apify(
    items: list[dict[str, Any]],
    *,
    run_status: str = "SUCCEEDED",
    settings: Settings | None = None,
    dataset_id: str | None = "dataset-1",
) -> ApifyService:
    """An ApifyService whose transport serves canned run/dataset responses."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/runs"):
            return httpx.Response(
                201,
                json={
                    "data": {
                        "id": "run-1",
                        "status": run_status,
                        "defaultDatasetId": dataset_id,
                    }
                },
            )
        if "/actor-runs/" in path:
            return httpx.Response(
                200,
                json={
                    "data": {
                        "id": "run-1",
                        "status": run_status,
                        "defaultDatasetId": dataset_id,
                    }
                },
            )
        if "/items" in path:
            return httpx.Response(200, json=items)
        raise AssertionError(f"unexpected Apify call: {path}")  # pragma: no cover

    client = httpx.Client(transport=httpx.MockTransport(handler))
    return ApifyService(settings or apify_settings(), client=client)


def run_import(db_session: Session, job_id: int, apify: ApifyService) -> Any:
    """Execute the pipeline synchronously, exactly as the background task does."""
    service = ParsingService(db_session, settings=apify.settings, apify=apify)
    return service.run_job(job_id)


@pytest.fixture
def competitor_id(client: TestClient) -> int:
    response = client.post(COMPETITORS, json={"profile": "https://instagram.com/flowuser/"})
    assert response.status_code == 201
    return int(response.json()["id"])


def test_full_import_flow_creates_reels_and_completes_the_job(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    # 1-2. Competitor exists; queue an import.
    start = client.post(f"{COMPETITORS}/{competitor_id}/parse")
    assert start.status_code == 202
    job_id = start.json()["jobId"]

    queued = client.get(f"{JOBS}/{job_id}").json()
    assert queued["status"] == "queued"
    assert queued["progress"] == Progress.CREATED

    # 3-5. The background task runs with a mocked Apify.
    items = [dataset_item("AAA"), dataset_item("BBB"), dataset_item("CCC")]
    with make_apify(items) as apify:
        result = run_import(db_session, job_id, apify)

    assert (result.created, result.updated) == (3, 0)

    # 6-7. The job reports completion.
    finished = client.get(f"{JOBS}/{job_id}").json()
    assert finished["status"] == "completed"
    assert finished["progress"] == Progress.DONE
    assert finished["reelsCreated"] == 3
    assert finished["reelsUpdated"] == 0
    assert finished["errorMessage"] is None
    assert finished["apifyRunId"] == "run-1"
    assert finished["startedAt"] is not None
    assert finished["completedAt"] is not None

    # 8-9. The competitor is ready with a correct count.
    competitor = client.get(f"{COMPETITORS}/{competitor_id}").json()
    assert competitor["status"] == "ready"
    assert competitor["reelsCount"] == 3
    assert competitor["lastParsedAt"] is not None

    # Each reel got an empty content row.
    db_session.expire_all()
    reels = db_session.query(Reel).filter(Reel.competitor_id == competitor_id).all()
    assert len(reels) == 3
    for reel in reels:
        assert reel.content is not None
        assert reel.content.content_status is ContentStatus.NEW


def test_second_import_skips_existing_reels_and_imports_the_next_candidates(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    first_job = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    with make_apify([dataset_item("AAA"), dataset_item("BBB")]) as apify:
        run_import(db_session, first_job, apify)

    # The user writes a script for one of the reels.
    db_session.expire_all()
    reel = db_session.query(Reel).filter(Reel.shortcode == "AAA").one()
    reel.content.hook = "Мой хук"
    reel.content.script = "Мой сценарий"
    reel.content.cta = "Мой призыв"
    reel.content.notes = "Мои заметки"
    reel.content.content_status = ContentStatus.READY
    db_session.commit()

    # Second import: existing reels must not consume the five import slots.
    second_job = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    updated_items = [
        dataset_item("AAA", videoPlayCount=99_999, likesCount=888, caption="Новая подпись"),
        dataset_item("BBB", videoPlayCount=5_000),
        dataset_item("CCC"),
    ]
    with make_apify(updated_items) as apify:
        result = run_import(db_session, second_job, apify)

    assert (result.created, result.updated) == (1, 0)

    job = client.get(f"{JOBS}/{second_job}").json()
    assert job["reelsCreated"] == 1
    assert job["reelsUpdated"] == 0

    competitor = client.get(f"{COMPETITORS}/{competitor_id}").json()
    assert competitor["reelsCount"] == 3, "no duplicates were created"

    db_session.expire_all()
    refreshed = db_session.query(Reel).filter(Reel.shortcode == "AAA").one()
    assert refreshed.views_count == 1000
    assert refreshed.likes_count == 100
    assert refreshed.caption == "Подпись AAA"
    # Existing external data and the user's script are untouched.
    assert refreshed.content.hook == "Мой хук"
    assert refreshed.content.script == "Мой сценарий"
    assert refreshed.content.cta == "Мой призыв"
    assert refreshed.content.notes == "Мои заметки"
    assert refreshed.content.content_status is ContentStatus.READY


def test_successful_run_with_an_empty_dataset_completes_with_zero_reels(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]

    with make_apify([]) as apify:
        result = run_import(db_session, job_id, apify)

    assert (result.created, result.updated) == (0, 0)

    job = client.get(f"{JOBS}/{job_id}").json()
    assert job["status"] == "completed"
    assert job["reelsCreated"] == 0
    assert job["errorMessage"] is None

    competitor = client.get(f"{COMPETITORS}/{competitor_id}").json()
    assert competitor["status"] == "ready"
    assert competitor["reelsCount"] == 0


def test_items_without_identifiers_are_skipped_not_imported(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    items = [dataset_item("AAA"), {"caption": "нет идентификаторов"}]

    with make_apify(items) as apify:
        result = run_import(db_session, job_id, apify)

    assert result.created == 1
    assert result.skipped == 1
    assert client.get(f"{COMPETITORS}/{competitor_id}").json()["reelsCount"] == 1


def test_failed_apify_run_marks_job_failed_and_competitor_error(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]

    with make_apify([], run_status="FAILED") as apify, pytest.raises(Exception, match="Actor"):
        run_import(db_session, job_id, apify)

    job = client.get(f"{JOBS}/{job_id}").json()
    assert job["status"] == "failed"
    assert job["errorMessage"]
    assert job["completedAt"] is not None
    # No stack trace or driver internals leak into the stored message.
    assert "Traceback" not in job["errorMessage"]

    competitor = client.get(f"{COMPETITORS}/{competitor_id}").json()
    assert competitor["status"] == "error", "competitor must not stay in 'parsing'"


def test_missing_dataset_id_fails_the_job_safely(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]

    with make_apify([], dataset_id=None) as apify, pytest.raises(Exception, match="данных"):
        run_import(db_session, job_id, apify)

    job = client.get(f"{JOBS}/{job_id}").json()
    assert job["status"] == "failed"
    assert client.get(f"{COMPETITORS}/{competitor_id}").json()["status"] == "error"


def test_unconfigured_apify_fails_the_job_with_a_clear_message(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    unconfigured = apify_settings(apify_api_token="", apify_actor_id="")

    service = ParsingService(db_session, settings=unconfigured, apify=ApifyService(unconfigured))
    with pytest.raises(Exception, match="Apify"):
        service.run_job(job_id)

    job = client.get(f"{JOBS}/{job_id}").json()
    assert job["status"] == "failed"
    assert "APIFY_API_TOKEN" in job["errorMessage"] or "Apify" in job["errorMessage"]


def test_failed_job_can_be_retried_and_then_succeeds(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    first_job = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    with make_apify([], run_status="FAILED") as apify, pytest.raises(Exception, match="Actor"):
        run_import(db_session, first_job, apify)

    assert client.get(f"{JOBS}/{first_job}").json()["status"] == "failed"

    retry = client.post(f"{JOBS}/{first_job}/retry")
    assert retry.status_code == 202
    retry_id = retry.json()["jobId"]

    with make_apify([dataset_item("AAA")]) as apify:
        result = run_import(db_session, retry_id, apify)

    assert result.created == 1
    assert client.get(f"{JOBS}/{retry_id}").json()["status"] == "completed"
    # The original failure stays on record.
    assert client.get(f"{JOBS}/{first_job}").json()["status"] == "failed"
    assert client.get(f"{COMPETITORS}/{competitor_id}").json()["status"] == "ready"


def test_background_task_swallows_errors_and_records_them(
    client: TestClient, db_session: Session, competitor_id: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``parse_competitor_job`` must never raise, whatever happens inside."""
    from app.tasks import parse_competitor as task_module

    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    settings = apify_settings()

    monkeypatch.setattr(task_module, "get_session_factory", lambda _settings: lambda: db_session)
    monkeypatch.setattr(task_module, "ApifyService", lambda _s: make_apify([], run_status="FAILED"))

    # Must not raise.
    task_module.parse_competitor_job(job_id, settings)

    assert client.get(f"{JOBS}/{job_id}").json()["status"] == "failed"


def test_normalizer_handles_the_dataset_items_used_in_this_flow() -> None:
    reel = normalize_apify_reel(dataset_item("ZZZ"))

    assert reel is not None
    assert reel.shortcode == "ZZZ"
    assert reel.instagram_id == "id-ZZZ"
    assert reel.views_count == 1000


def test_parse_after_delete_returns_404(client: TestClient, competitor_id: int) -> None:
    assert client.delete(f"{COMPETITORS}/{competitor_id}").status_code == 204

    response = client.post(f"{COMPETITORS}/{competitor_id}/parse")

    assert response.status_code == 404


def test_jobs_are_removed_together_with_the_competitor(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    with make_apify([dataset_item("AAA")]) as apify:
        run_import(db_session, job_id, apify)

    assert client.delete(f"{COMPETITORS}/{competitor_id}").status_code == 204

    db_session.expire_all()
    assert db_session.get(ParsingJob, job_id) is None
    assert db_session.query(Competitor).filter(Competitor.id == competitor_id).count() == 0
    assert db_session.query(Reel).filter(Reel.competitor_id == competitor_id).count() == 0


def test_progress_checkpoints_are_real_values(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    """Progress must only take the documented checkpoint values."""
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]
    observed: list[int] = []

    original = ParsingService._store_items

    def spy(self: ParsingService, job: ParsingJob, competitor: Any, items: Any) -> Any:
        observed.append(job.progress)
        return original(self, job, competitor, items)

    ParsingService._store_items = spy  # type: ignore[method-assign]
    try:
        with make_apify([dataset_item("AAA")]) as apify:
            run_import(db_session, job_id, apify)
    finally:
        ParsingService._store_items = original  # type: ignore[method-assign]

    assert observed == [Progress.DATASET_FETCHED]
    assert client.get(f"{JOBS}/{job_id}").json()["progress"] == Progress.DONE


def test_job_records_the_apify_run_id(
    client: TestClient, db_session: Session, competitor_id: int
) -> None:
    job_id = client.post(f"{COMPETITORS}/{competitor_id}/parse").json()["jobId"]

    with make_apify([dataset_item("AAA")]) as apify:
        run_import(db_session, job_id, apify)

    db_session.expire_all()
    job = db_session.get(ParsingJob, job_id)
    assert job is not None
    assert job.apify_run_id == "run-1"
    assert job.status is ParsingJobStatus.COMPLETED
