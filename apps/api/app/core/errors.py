"""Application error codes, exceptions and FastAPI exception handlers."""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

HTTP_422_UNPROCESSABLE: int = 422
"""Literal 422 — avoids the Starlette constant renamed across versions."""


class ErrorCode(StrEnum):
    """Stable machine-readable error codes returned by the API."""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    COMPETITOR_ALREADY_EXISTS = "COMPETITOR_ALREADY_EXISTS"
    COMPETITOR_NOT_FOUND = "COMPETITOR_NOT_FOUND"
    REEL_NOT_FOUND = "REEL_NOT_FOUND"
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    ACTIVE_JOB_ALREADY_EXISTS = "ACTIVE_JOB_ALREADY_EXISTS"
    INVALID_INSTAGRAM_PROFILE = "INVALID_INSTAGRAM_PROFILE"
    INVALID_JOB_STATE = "INVALID_JOB_STATE"
    COMPETITOR_HAS_ACTIVE_JOB = "COMPETITOR_HAS_ACTIVE_JOB"
    APIFY_NOT_CONFIGURED = "APIFY_NOT_CONFIGURED"
    APIFY_REQUEST_FAILED = "APIFY_REQUEST_FAILED"
    APIFY_RUN_FAILED = "APIFY_RUN_FAILED"
    APIFY_RUN_TIMEOUT = "APIFY_RUN_TIMEOUT"
    APIFY_DATASET_ERROR = "APIFY_DATASET_ERROR"
    APIFY_EMPTY_DATASET = "APIFY_EMPTY_DATASET"
    DEEPGRAM_NOT_CONFIGURED = "DEEPGRAM_NOT_CONFIGURED"
    DEEPGRAM_AUTH_FAILED = "DEEPGRAM_AUTH_FAILED"
    DEEPGRAM_REQUEST_FAILED = "DEEPGRAM_REQUEST_FAILED"
    DEEPGRAM_RATE_LIMITED = "DEEPGRAM_RATE_LIMITED"
    DEEPGRAM_QUOTA_EXCEEDED = "DEEPGRAM_QUOTA_EXCEEDED"
    DEEPGRAM_INVALID_RESPONSE = "DEEPGRAM_INVALID_RESPONSE"
    REEL_VIDEO_UNAVAILABLE = "REEL_VIDEO_UNAVAILABLE"
    ACTIVE_TRANSCRIPTION_ALREADY_EXISTS = "ACTIVE_TRANSCRIPTION_ALREADY_EXISTS"
    INVALID_TRANSCRIPTION_STATE = "INVALID_TRANSCRIPTION_STATE"
    TRANSCRIPTION_NOT_FOUND = "TRANSCRIPTION_NOT_FOUND"
    OPENROUTER_NOT_CONFIGURED = "OPENROUTER_NOT_CONFIGURED"
    OPENROUTER_AUTH_FAILED = "OPENROUTER_AUTH_FAILED"
    OPENROUTER_REQUEST_FAILED = "OPENROUTER_REQUEST_FAILED"
    OPENROUTER_RATE_LIMITED = "OPENROUTER_RATE_LIMITED"
    OPENROUTER_MODEL_UNAVAILABLE = "OPENROUTER_MODEL_UNAVAILABLE"
    OPENROUTER_INVALID_RESPONSE = "OPENROUTER_INVALID_RESPONSE"
    OPENROUTER_CONTENT_FILTERED = "OPENROUTER_CONTENT_FILTERED"
    TRANSCRIPTION_REQUIRED = "TRANSCRIPTION_REQUIRED"
    TRANSCRIPTION_NOT_COMPLETED = "TRANSCRIPTION_NOT_COMPLETED"
    TRANSCRIPTION_EMPTY = "TRANSCRIPTION_EMPTY"
    ACTIVE_ANALYSIS_ALREADY_EXISTS = "ACTIVE_ANALYSIS_ALREADY_EXISTS"
    INVALID_ANALYSIS_STATE = "INVALID_ANALYSIS_STATE"
    ANALYSIS_NOT_FOUND = "ANALYSIS_NOT_FOUND"
    ANALYSIS_INPUT_CHANGED = "ANALYSIS_INPUT_CHANGED"
    DATABASE_ERROR = "DATABASE_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


_HTTP_STATUS_TO_ERROR_CODE: dict[int, ErrorCode] = {
    status.HTTP_400_BAD_REQUEST: ErrorCode.VALIDATION_ERROR,
    status.HTTP_404_NOT_FOUND: ErrorCode.NOT_FOUND,
    status.HTTP_409_CONFLICT: ErrorCode.VALIDATION_ERROR,
    HTTP_422_UNPROCESSABLE: ErrorCode.VALIDATION_ERROR,
    status.HTTP_502_BAD_GATEWAY: ErrorCode.APIFY_REQUEST_FAILED,
    status.HTTP_503_SERVICE_UNAVAILABLE: ErrorCode.DATABASE_ERROR,
    status.HTTP_504_GATEWAY_TIMEOUT: ErrorCode.APIFY_RUN_TIMEOUT,
}


class AppError(Exception):
    """Base class for expected, user-facing application errors."""

    code: ErrorCode = ErrorCode.INTERNAL_ERROR
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "Внутренняя ошибка сервера"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
        status_code: int | None = None,
    ) -> None:
        self.message = message or self.message
        self.details: dict[str, Any] = details or {}
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)

    def to_response(self) -> JSONResponse:
        return error_response(self.status_code, self.code, self.message, self.details)


class ValidationError(AppError):
    code = ErrorCode.VALIDATION_ERROR
    status_code = HTTP_422_UNPROCESSABLE
    message = "Переданные данные не прошли валидацию"


class NotFoundError(AppError):
    code = ErrorCode.NOT_FOUND
    status_code = status.HTTP_404_NOT_FOUND
    message = "Ресурс не найден"


class CompetitorAlreadyExistsError(AppError):
    code = ErrorCode.COMPETITOR_ALREADY_EXISTS
    status_code = status.HTTP_409_CONFLICT
    message = "Такой конкурент уже отслеживается"


class CompetitorNotFoundError(NotFoundError):
    code = ErrorCode.COMPETITOR_NOT_FOUND
    message = "Конкурент не найден"


class ReelNotFoundError(NotFoundError):
    code = ErrorCode.REEL_NOT_FOUND
    message = "Рилс не найден"


class JobNotFoundError(NotFoundError):
    code = ErrorCode.JOB_NOT_FOUND
    message = "Задача парсинга не найдена"


class ActiveJobAlreadyExistsError(AppError):
    code = ErrorCode.ACTIVE_JOB_ALREADY_EXISTS
    status_code = status.HTTP_409_CONFLICT
    message = "Для этого конкурента уже выполняется задача парсинга"


class InvalidInstagramProfileError(AppError):
    code = ErrorCode.INVALID_INSTAGRAM_PROFILE
    status_code = HTTP_422_UNPROCESSABLE
    message = "Некорректная ссылка или имя профиля Instagram"


class InvalidJobStateError(AppError):
    code = ErrorCode.INVALID_JOB_STATE
    status_code = status.HTTP_409_CONFLICT
    message = "Недопустимое состояние задачи парсинга"


class CompetitorHasActiveJobError(AppError):
    code = ErrorCode.COMPETITOR_HAS_ACTIVE_JOB
    status_code = status.HTTP_409_CONFLICT
    message = "Нельзя удалить конкурента, пока выполняется импорт"


class ApifyError(AppError):
    """Base class for every failure of the Apify integration."""

    code = ErrorCode.APIFY_REQUEST_FAILED
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "Ошибка при обращении к Apify"


class ApifyNotConfiguredError(ApifyError):
    code = ErrorCode.APIFY_NOT_CONFIGURED
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Интеграция с Apify не настроена: задайте APIFY_API_TOKEN и APIFY_ACTOR_ID"


class ApifyRequestFailedError(ApifyError):
    code = ErrorCode.APIFY_REQUEST_FAILED
    message = "Запрос к Apify завершился ошибкой"


class ApifyRunFailedError(ApifyError):
    code = ErrorCode.APIFY_RUN_FAILED
    message = "Запуск Apify Actor завершился неуспешно"


class ApifyRunTimeoutError(ApifyError):
    code = ErrorCode.APIFY_RUN_TIMEOUT
    status_code = status.HTTP_504_GATEWAY_TIMEOUT
    message = "Apify Actor не завершился за отведённое время"


class ApifyDatasetError(ApifyError):
    code = ErrorCode.APIFY_DATASET_ERROR
    message = "Не удалось получить результаты из Apify Dataset"


class ApifyEmptyDatasetError(ApifyError):
    code = ErrorCode.APIFY_EMPTY_DATASET
    message = "Apify не вернул ни одного рилса"


class DeepgramError(AppError):
    """Base class for every failure of the Deepgram integration."""

    code = ErrorCode.DEEPGRAM_REQUEST_FAILED
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "Ошибка при обращении к Deepgram"


class DeepgramNotConfiguredError(DeepgramError):
    code = ErrorCode.DEEPGRAM_NOT_CONFIGURED
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Интеграция с Deepgram не настроена: задайте DEEPGRAM_API_KEY"


class DeepgramRequestFailedError(DeepgramError):
    code = ErrorCode.DEEPGRAM_REQUEST_FAILED
    message = "Запрос к Deepgram завершился ошибкой"


class DeepgramAuthFailedError(DeepgramError):
    code = ErrorCode.DEEPGRAM_AUTH_FAILED
    message = "Deepgram отклонил токен авторизации"


class DeepgramQuotaExceededError(DeepgramError):
    code = ErrorCode.DEEPGRAM_QUOTA_EXCEEDED
    message = "Превышена квота или недостаточно средств в Deepgram"


class DeepgramRateLimitedError(DeepgramError):
    code = ErrorCode.DEEPGRAM_RATE_LIMITED
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    message = "Превышен лимит запросов к Deepgram (429)"


class DeepgramInvalidResponseError(DeepgramError):
    code = ErrorCode.DEEPGRAM_INVALID_RESPONSE
    message = "Deepgram вернул некорректный ответ"


class ReelVideoUnavailableError(AppError):
    code = ErrorCode.REEL_VIDEO_UNAVAILABLE
    status_code = HTTP_422_UNPROCESSABLE
    message = "Для этого рилса нет доступной ссылки на видео"


class ActiveTranscriptionAlreadyExistsError(AppError):
    code = ErrorCode.ACTIVE_TRANSCRIPTION_ALREADY_EXISTS
    status_code = status.HTTP_409_CONFLICT
    message = "Для этого рилса уже выполняется или ожидает транскрибация"


class InvalidTranscriptionStateError(AppError):
    code = ErrorCode.INVALID_TRANSCRIPTION_STATE
    status_code = status.HTTP_409_CONFLICT
    message = "Недопустимое состояние транскрибации для этого действия"


class TranscriptionNotFoundError(NotFoundError):
    code = ErrorCode.TRANSCRIPTION_NOT_FOUND
    message = "Транскрибация не найдена"


class OpenRouterError(AppError):
    code = ErrorCode.OPENROUTER_REQUEST_FAILED
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "Ошибка при обращении к OpenRouter"


class OpenRouterNotConfiguredError(OpenRouterError):
    code = ErrorCode.OPENROUTER_NOT_CONFIGURED
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Интеграция с OpenRouter не настроена"


class OpenRouterAuthFailedError(OpenRouterError):
    code = ErrorCode.OPENROUTER_AUTH_FAILED
    message = "Ошибка авторизации в OpenRouter"


class OpenRouterRequestFailedError(OpenRouterError):
    code = ErrorCode.OPENROUTER_REQUEST_FAILED
    message = "Запрос к OpenRouter завершился ошибкой"


class OpenRouterModelUnavailableError(OpenRouterError):
    code = ErrorCode.OPENROUTER_MODEL_UNAVAILABLE
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Модель OpenRouter недоступна"


class OpenRouterRateLimitedError(OpenRouterError):
    code = ErrorCode.OPENROUTER_RATE_LIMITED
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    message = "Превышен лимит запросов к OpenRouter"


class OpenRouterInvalidResponseError(OpenRouterError):
    code = ErrorCode.OPENROUTER_INVALID_RESPONSE
    message = "Некорректный ответ от OpenRouter"


class OpenRouterContentFilteredError(OpenRouterError):
    code = ErrorCode.OPENROUTER_CONTENT_FILTERED
    status_code = HTTP_422_UNPROCESSABLE
    message = "Ответ отклонен фильтрами контента"


class TranscriptionRequiredError(AppError):
    code = ErrorCode.TRANSCRIPTION_REQUIRED
    status_code = status.HTTP_409_CONFLICT
    message = "Для анализа требуется транскрибация"


class TranscriptionNotCompletedError(AppError):
    code = ErrorCode.TRANSCRIPTION_NOT_COMPLETED
    status_code = status.HTTP_409_CONFLICT
    message = "Транскрибация еще не завершена"


class TranscriptionEmptyError(AppError):
    code = ErrorCode.TRANSCRIPTION_EMPTY
    status_code = HTTP_422_UNPROCESSABLE
    message = "Транскрибация пуста, нечего анализировать"


class ActiveAnalysisAlreadyExistsError(AppError):
    code = ErrorCode.ACTIVE_ANALYSIS_ALREADY_EXISTS
    status_code = status.HTTP_409_CONFLICT
    message = "Для этого рилса уже выполняется или ожидает анализ"


class InvalidAnalysisStateError(AppError):
    code = ErrorCode.INVALID_ANALYSIS_STATE
    status_code = status.HTTP_409_CONFLICT
    message = "Недопустимое состояние анализа для этого действия"


class AnalysisNotFoundError(NotFoundError):
    code = ErrorCode.ANALYSIS_NOT_FOUND
    message = "Анализ не найден"


class AnalysisInputChangedError(AppError):
    code = ErrorCode.ANALYSIS_INPUT_CHANGED
    status_code = status.HTTP_409_CONFLICT
    message = "Входные данные для анализа изменились"


class DatabaseError(AppError):
    code = ErrorCode.DATABASE_ERROR
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "База данных временно недоступна"


class InternalError(AppError):
    code = ErrorCode.INTERNAL_ERROR
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "Внутренняя ошибка сервера"


def error_payload(
    code: ErrorCode, message: str, details: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Build the unified error body."""
    return {"error": {"code": str(code), "message": message, "details": details or {}}}


def error_response(
    status_code: int,
    code: ErrorCode,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    """Build a unified :class:`JSONResponse` for an error."""
    return JSONResponse(status_code=status_code, content=error_payload(code, message, details))


def _safe_validation_details(exc: RequestValidationError) -> dict[str, Any]:
    """Extract field/reason pairs without leaking internal objects."""
    fields: list[dict[str, str]] = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", ())]
        fields.append(
            {
                "field": ".".join(location) or "body",
                "reason": str(error.get("msg", "invalid value")),
                "type": str(error.get("type", "value_error")),
            }
        )
    return {"fields": fields}


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    """Handle expected application errors."""
    assert isinstance(exc, AppError)
    if exc.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        logger.error("Application error: %s (%s)", exc.code, exc.message)
    else:
        logger.info("Application error: %s (%s)", exc.code, exc.message)
    return exc.to_response()


async def validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    """Handle FastAPI/Pydantic request validation errors."""
    assert isinstance(exc, RequestValidationError)
    return error_response(
        HTTP_422_UNPROCESSABLE,
        ErrorCode.VALIDATION_ERROR,
        "Переданные данные не прошли валидацию",
        _safe_validation_details(exc),
    )


async def http_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    """Convert Starlette/FastAPI HTTPException into the unified format."""
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_STATUS_TO_ERROR_CODE.get(
        exc.status_code,
        ErrorCode.INTERNAL_ERROR
        if exc.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR
        else ErrorCode.VALIDATION_ERROR,
    )
    detail = exc.detail if isinstance(exc.detail, str) else "Запрос не может быть обработан"
    return error_response(exc.status_code, code, detail)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Log unexpected exceptions and return a safe generic error."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_ERROR,
        InternalError.message,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all unified error handlers to the FastAPI application."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
