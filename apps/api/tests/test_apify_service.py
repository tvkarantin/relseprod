"""Tests for :class:`app.services.apify.ApifyService`.

The real Apify API is never contacted: every response is served by an
``httpx.MockTransport``.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import (
    ApifyDatasetError,
    ApifyNotConfiguredError,
    ApifyRequestFailedError,
    ApifyRunFailedError,
    ApifyRunTimeoutError,
    ErrorCode,
)
from app.services.apify import ApifyService, encode_actor_id
from app.services.apify_input import ActorInputStyle, build_actor_input, resolve_input_style

ACTOR_ID = "apify/instagram-reel-scraper"
TOKEN = "test-token-not-real"  # dummy value for the mock transport


def make_settings(**overrides: Any) -> Settings:
    defaults: dict[str, Any] = {
        "apify_api_token": TOKEN,
        "apify_actor_id": ACTOR_ID,
        "apify_results_limit": 20,
        "apify_timeout_seconds": 30,
        "apify_poll_interval_seconds": 1,
        "cors_origins": ["http://localhost:4173"],
    }
    return Settings(**(defaults | overrides))


def make_service(handler: Any, **setting_overrides: Any) -> ApifyService:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return ApifyService(make_settings(**setting_overrides), client=client)


def run_payload(status: str = "SUCCEEDED", **extra: Any) -> dict[str, Any]:
    payload = {"id": "run-123", "status": status, "defaultDatasetId": "dataset-456"}
    payload.update(extra)
    return {"data": payload}


# ------------------------------------------------------------------ actor id


@pytest.mark.parametrize(
    ("actor_id", "expected"),
    [
        ("apify/instagram-reel-scraper", "apify~instagram-reel-scraper"),
        ("apify~instagram-reel-scraper", "apify~instagram-reel-scraper"),
        ("  apify/instagram-reel-scraper  ", "apify~instagram-reel-scraper"),
    ],
)
def test_actor_id_is_encoded_for_the_url_path(actor_id: str, expected: str) -> None:
    assert encode_actor_id(actor_id) == expected


@pytest.mark.parametrize(
    ("actor_id", "expected"),
    [
        ("apify/instagram-reel-scraper", ActorInputStyle.USERNAME),
        ("apify/instagram-scraper", ActorInputStyle.DIRECT_URLS),
        ("apify/instagram-api-scraper", ActorInputStyle.DIRECT_URLS),
    ],
)
def test_input_style_is_detected_from_the_actor_id(actor_id: str, expected: str) -> None:
    assert resolve_input_style(actor_id) == expected


def test_username_actor_input_shape() -> None:
    assert build_actor_input(
        "example", "https://www.instagram.com/example/", 20, actor_id=ACTOR_ID
    ) == {"username": ["example"], "resultsLimit": 20}


def test_direct_urls_actor_input_shape() -> None:
    assert build_actor_input(
        "example",
        "https://www.instagram.com/example/",
        15,
        actor_id="apify/instagram-scraper",
    ) == {
        "directUrls": ["https://www.instagram.com/example/"],
        "resultsType": "reels",
        "resultsLimit": 15,
    }


def test_explicit_input_style_overrides_detection() -> None:
    built = build_actor_input(
        "example",
        "https://www.instagram.com/example/",
        5,
        actor_id=ACTOR_ID,
        input_style=ActorInputStyle.DIRECT_URLS,
    )
    assert "directUrls" in built


# ----------------------------------------------------------- configuration


@pytest.mark.parametrize(
    ("token", "actor", "missing"),
    [
        ("", ACTOR_ID, ["APIFY_API_TOKEN"]),
        (TOKEN, "", ["APIFY_ACTOR_ID"]),
        ("", "", ["APIFY_API_TOKEN", "APIFY_ACTOR_ID"]),
    ],
)
def test_missing_credentials_raise_apify_not_configured(
    token: str, actor: str, missing: list[str]
) -> None:
    service = ApifyService(make_settings(apify_api_token=token, apify_actor_id=actor))

    with pytest.raises(ApifyNotConfiguredError) as exc_info:
        service.ensure_configured()

    assert exc_info.value.code is ErrorCode.APIFY_NOT_CONFIGURED
    assert exc_info.value.details["missing"] == missing


# ------------------------------------------------------------------ run flow


def test_start_run_posts_to_the_encoded_actor_url_with_bearer_auth() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = request.read().decode()
        return httpx.Response(201, json=run_payload("READY"))

    with make_service(handler) as service:
        run = service.start_run({"username": ["example"], "resultsLimit": 2})

    assert run.id == "run-123"
    assert run.status == "READY"
    assert run.dataset_id == "dataset-456"
    assert seen["url"] == "https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs"
    assert seen["auth"] == f"Bearer {TOKEN}"
    assert "example" in seen["body"]
    # The token must never leak into the URL.
    assert TOKEN not in seen["url"]


def test_polling_follows_running_until_succeeded() -> None:
    statuses = iter(["RUNNING", "RUNNING", "SUCCEEDED"])
    observed: list[str] = []

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=run_payload(next(statuses)))

    with make_service(handler) as service:
        run = service.wait_for_completion(
            "run-123",
            on_status_change=lambda r: observed.append(r.status),
            sleep=lambda _seconds: None,
        )

    assert run.status == "SUCCEEDED"
    assert observed == ["RUNNING", "SUCCEEDED"]


@pytest.mark.parametrize("status", ["FAILED", "ABORTED", "TIMED-OUT", "ABORTING", "TIMING-OUT"])
def test_terminal_failure_statuses_raise_run_failed(status: str) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=run_payload(status))

    with make_service(handler) as service, pytest.raises(ApifyRunFailedError) as exc_info:
        service.wait_for_completion("run-123", sleep=lambda _s: None)

    assert exc_info.value.code is ErrorCode.APIFY_RUN_FAILED
    assert exc_info.value.details["runStatus"] == status


def test_polling_stops_and_raises_on_timeout() -> None:
    calls = {"n": 0}
    clock = {"now": 0.0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=run_payload("RUNNING"))

    def monotonic() -> float:
        return clock["now"]

    def sleep(_seconds: float) -> None:
        clock["now"] += 10.0

    with (
        make_service(handler, apify_timeout_seconds=30) as service,
        pytest.raises(ApifyRunTimeoutError) as exc_info,
    ):
        service.wait_for_completion("run-123", sleep=sleep, monotonic=monotonic)

    assert exc_info.value.code is ErrorCode.APIFY_RUN_TIMEOUT
    assert exc_info.value.details["timeoutSeconds"] == 30
    assert calls["n"] < 10, "polling must stop at the deadline, not loop forever"


# ------------------------------------------------------------- HTTP errors


@pytest.mark.parametrize(
    ("status_code", "fragment"),
    [
        (401, "токен"),
        (402, "средств"),
        (403, "запрещён"),
        (404, "не найден"),
        (429, "лимит"),
        (500, "HTTP 500"),
    ],
)
def test_http_errors_are_converted_to_safe_messages(status_code: int, fragment: str) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"error": {"message": "internal apify detail"}})

    with make_service(handler) as service, pytest.raises(ApifyRequestFailedError) as exc_info:
        service.start_run({"username": ["example"]})

    error = exc_info.value
    assert error.code is ErrorCode.APIFY_REQUEST_FAILED
    assert fragment in error.message
    assert error.details["statusCode"] == status_code
    assert TOKEN not in error.message


def test_network_timeout_is_converted_to_request_failed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("connect timed out", request=request)

    with make_service(handler) as service, pytest.raises(ApifyRequestFailedError) as exc_info:
        service.start_run({"username": ["example"]})

    assert "время ожидания" in exc_info.value.message


def test_connection_error_is_converted_to_request_failed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    with make_service(handler) as service, pytest.raises(ApifyRequestFailedError):
        service.start_run({"username": ["example"]})


def test_invalid_json_body_is_reported_safely() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"<html>not json</html>")

    with make_service(handler) as service, pytest.raises(ApifyRequestFailedError) as exc_info:
        service.start_run({"username": ["example"]})

    assert "JSON" in exc_info.value.message


def test_run_payload_without_id_is_rejected() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": {"status": "READY"}})

    with make_service(handler) as service, pytest.raises(ApifyRequestFailedError):
        service.start_run({"username": ["example"]})


# ---------------------------------------------------------------- datasets


def test_dataset_items_are_returned_and_non_objects_skipped() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/datasets/dataset-456/items" in str(request.url)
        assert request.headers.get("authorization") == f"Bearer {TOKEN}"
        return httpx.Response(200, json=[{"shortCode": "A"}, "garbage", 42, {"shortCode": "B"}])

    with make_service(handler) as service:
        items = service.get_dataset_items("dataset-456")

    assert items == [{"shortCode": "A"}, {"shortCode": "B"}]


def test_missing_dataset_id_raises_dataset_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:  # pragma: no cover - not called
        return httpx.Response(200, json=[])

    with make_service(handler) as service, pytest.raises(ApifyDatasetError) as exc_info:
        service.get_dataset_items(None)

    assert exc_info.value.code is ErrorCode.APIFY_DATASET_ERROR
    assert exc_info.value.details["reason"] == "missing_dataset_id"


def test_empty_dataset_is_returned_as_an_empty_list_not_an_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    with make_service(handler) as service:
        assert service.get_dataset_items("dataset-456") == []


def test_non_list_dataset_payload_raises_dataset_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "object"})

    with make_service(handler) as service, pytest.raises(ApifyDatasetError) as exc_info:
        service.get_dataset_items("dataset-456")

    assert exc_info.value.details["reason"] == "not_a_list"


def test_dataset_request_passes_the_results_limit() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["limit"] = request.url.params.get("limit")
        return httpx.Response(200, json=[])

    with make_service(handler, apify_results_limit=7) as service:
        service.get_dataset_items("dataset-456")

    assert seen["limit"] == "7"
