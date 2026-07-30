"""Apify REST API client.

All communication with Apify happens here: the frontend never talks to Apify
directly. The token is sent in the ``Authorization: Bearer`` header and is never
logged, never placed in a URL and never returned to the client.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings, get_settings
from app.core.errors import (
    ApifyDatasetError,
    ApifyNotConfiguredError,
    ApifyRequestFailedError,
    ApifyRunFailedError,
    ApifyRunTimeoutError,
)

logger = logging.getLogger(__name__)

RUNNING_STATUSES: frozenset[str] = frozenset({"READY", "RUNNING"})
"""Run is not finished yet."""

SUCCESS_STATUS = "SUCCEEDED"

FAILED_STATUSES: frozenset[str] = frozenset(
    {"FAILED", "ABORTING", "ABORTED", "TIMING-OUT", "TIMED-OUT"}
)
"""Terminal statuses that mean the run did not produce usable results."""

_HTTP_ERROR_MESSAGES: dict[int, str] = {
    401: "Apify отклонил токен (401). Проверьте APIFY_API_TOKEN",
    403: "Доступ к Apify запрещён (403). Проверьте права токена",
    404: "Apify Actor не найден (404). Проверьте APIFY_ACTOR_ID",
    402: "Недостаточно средств на аккаунте Apify (402)",
    429: "Превышен лимит запросов к Apify (429). Повторите позже",
}


@dataclass(slots=True)
class ApifyRun:
    """A single Apify Actor run."""

    id: str
    status: str
    dataset_id: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def is_finished(self) -> bool:
        return self.status not in RUNNING_STATUSES

    @property
    def is_successful(self) -> bool:
        return self.status == SUCCESS_STATUS


def encode_actor_id(actor_id: str) -> str:
    """Encode an ``owner/actor-name`` identifier for use in a URL path.

    Apify accepts ``owner~actor-name`` in paths; the result is percent-encoded
    so unusual characters cannot break out of the path segment.
    """
    normalized = actor_id.strip().replace("/", "~")
    return quote(normalized, safe="~")


class ApifyService:
    """Thin, typed wrapper over the Apify REST API."""

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: httpx.Client | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._client = client
        self._owns_client = client is None

    # ---------------------------------------------------------------- helpers

    def ensure_configured(self) -> None:
        """Raise :class:`ApifyNotConfiguredError` if credentials are missing."""
        missing = [
            name
            for name, value in (
                ("APIFY_API_TOKEN", self.settings.apify_api_token),
                ("APIFY_ACTOR_ID", self.settings.apify_actor_id),
            )
            if not value
        ]
        if missing:
            raise ApifyNotConfiguredError(details={"missing": missing})

    @property
    def base_url(self) -> str:
        return self.settings.apify_base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        """Auth headers. Never logged."""
        return {
            "Authorization": f"Bearer {self.settings.apify_api_token}",
            "Content-Type": "application/json",
        }

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=httpx.Timeout(60.0, connect=15.0))
        return self._client

    def close(self) -> None:
        """Close the HTTP client if this service owns it."""
        if self._client is not None and self._owns_client:
            self._client.close()
            self._client = None

    def __enter__(self) -> ApifyService:
        return self

    def __exit__(self, *_exc_info: object) -> None:
        self.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Perform a request and return the decoded ``data`` payload.

        Raises:
            ApifyRequestFailedError: on transport errors, HTTP errors or a
                malformed JSON body. The message never contains the token.
        """
        url = f"{self.base_url}{path}"
        try:
            response = self._get_client().request(method, url, headers=self._headers(), **kwargs)
        except httpx.TimeoutException as exc:
            logger.warning("Apify request timed out: %s %s", method, path)
            raise ApifyRequestFailedError(
                "Превышено время ожидания ответа от Apify",
                details={"operation": path},
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("Apify request failed: %s %s (%s)", method, path, type(exc).__name__)
            raise ApifyRequestFailedError(
                "Не удалось связаться с Apify",
                details={"operation": path},
            ) from exc

        if response.status_code >= 400:
            message = _HTTP_ERROR_MESSAGES.get(
                response.status_code,
                f"Apify вернул ошибку HTTP {response.status_code}",
            )
            logger.warning("Apify returned HTTP %s for %s %s", response.status_code, method, path)
            raise ApifyRequestFailedError(
                message,
                details={"statusCode": response.status_code, "operation": path},
            )

        try:
            payload = response.json()
        except ValueError as exc:
            logger.warning("Apify returned a non-JSON body for %s %s", method, path)
            raise ApifyRequestFailedError(
                "Apify вернул некорректный JSON",
                details={"operation": path},
            ) from exc

        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

    @staticmethod
    def _to_run(data: Any) -> ApifyRun:
        """Build an :class:`ApifyRun` from an API payload."""
        if not isinstance(data, dict):
            raise ApifyRequestFailedError("Apify вернул неожиданный формат ответа")

        run_id = data.get("id")
        status = data.get("status")
        if not isinstance(run_id, str) or not isinstance(status, str):
            raise ApifyRequestFailedError("В ответе Apify отсутствует идентификатор или статус")

        dataset_id = data.get("defaultDatasetId")
        return ApifyRun(
            id=run_id,
            status=status,
            dataset_id=dataset_id if isinstance(dataset_id, str) and dataset_id else None,
            raw=data,
        )

    # ------------------------------------------------------------------- API

    def start_run(self, actor_input: dict[str, object]) -> ApifyRun:
        """Start the configured Actor and return the created run."""
        self.ensure_configured()
        actor_path = encode_actor_id(self.settings.apify_actor_id)
        logger.info("Starting Apify actor %s", self.settings.apify_actor_id)
        data = self._request("POST", f"/acts/{actor_path}/runs", json=actor_input)
        run = self._to_run(data)
        logger.info("Apify run started: run_id=%s status=%s", run.id, run.status)
        return run

    def get_run(self, run_id: str) -> ApifyRun:
        """Fetch the current state of a run."""
        self.ensure_configured()
        data = self._request("GET", f"/actor-runs/{quote(run_id, safe='')}")
        return self._to_run(data)

    def wait_for_completion(
        self,
        run_id: str,
        *,
        on_status_change: Any = None,
        sleep: Any = time.sleep,
        monotonic: Any = time.monotonic,
    ) -> ApifyRun:
        """Poll a run until it finishes.

        Args:
            run_id: identifier returned by :meth:`start_run`.
            on_status_change: optional callback invoked with each new status.
            sleep / monotonic: injectable for deterministic tests.

        Raises:
            ApifyRunTimeoutError: when ``APIFY_TIMEOUT_SECONDS`` is exceeded.
            ApifyRunFailedError: when the run ends in a failed state.
        """
        timeout = self.settings.apify_timeout_seconds
        interval = self.settings.apify_poll_interval_seconds
        deadline = monotonic() + timeout
        last_status: str | None = None

        while True:
            run = self.get_run(run_id)
            if run.status != last_status:
                logger.info("Apify run %s status: %s", run_id, run.status)
                last_status = run.status
                if on_status_change is not None:
                    on_status_change(run)

            if run.is_successful:
                return run

            if run.status in FAILED_STATUSES:
                raise ApifyRunFailedError(
                    f"Apify Actor завершился со статусом {run.status}",
                    details={"runStatus": run.status, "runId": run_id},
                )

            if not run.is_finished and monotonic() >= deadline:
                logger.warning("Apify run %s timed out after %ss", run_id, timeout)
                raise ApifyRunTimeoutError(
                    f"Apify Actor не завершился за {timeout} секунд",
                    details={"runId": run_id, "timeoutSeconds": timeout},
                )

            if run.is_finished:
                # Unknown terminal status — treat it as a failure rather than
                # polling forever.
                raise ApifyRunFailedError(
                    f"Apify Actor завершился со статусом {run.status}",
                    details={"runStatus": run.status, "runId": run_id},
                )

            sleep(min(interval, max(0.0, deadline - monotonic())))

    def get_dataset_items(
        self, dataset_id: str | None, *, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Download items of a dataset.

        Returns:
            A list of dictionaries. Non-object entries are skipped.

        Raises:
            ApifyDatasetError: if the dataset id is missing or the payload is
                not a list.
        """
        self.ensure_configured()
        if not dataset_id:
            raise ApifyDatasetError(
                "Apify не вернул идентификатор набора данных",
                details={"reason": "missing_dataset_id"},
            )

        params: dict[str, Any] = {"clean": "true", "format": "json"}
        effective_limit = limit if limit is not None else self.settings.apify_results_limit
        if effective_limit:
            params["limit"] = int(effective_limit)

        payload = self._request(
            "GET", f"/datasets/{quote(dataset_id, safe='')}/items", params=params
        )

        if not isinstance(payload, list):
            logger.warning("Apify dataset %s returned a non-list payload", dataset_id)
            raise ApifyDatasetError(
                "Apify вернул набор данных в неожиданном формате",
                details={"reason": "not_a_list"},
            )

        items = [item for item in payload if isinstance(item, dict)]
        skipped = len(payload) - len(items)
        if skipped:
            logger.warning("Skipped %s non-object items in dataset %s", skipped, dataset_id)
        logger.info("Fetched %s items from Apify dataset %s", len(items), dataset_id)
        return items
