import json

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import (
    OpenRouterAuthFailedError,
    OpenRouterContentFilteredError,
    OpenRouterInvalidResponseError,
    OpenRouterModelUnavailableError,
    OpenRouterNotConfiguredError,
    OpenRouterRateLimitedError,
    OpenRouterRequestFailedError,
)
from app.services.openrouter import OpenRouterService


@pytest.fixture
def openrouter_settings():
    s = Settings(
        openrouter_api_key="test-key",
        openrouter_model="openai/gpt-oss-120b:free",
        openrouter_response_healing=False,
    )
    return s


def make_success_response():
    data = {
        "id": "req-123",
        "model": "openai/gpt-oss-120b:free",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps(
                        {
                            "sourceLanguage": "en",
                            "russianTranscript": "тест",
                            "title": "title",
                            "topic": "topic",
                            "summary": "summary",
                            "hook": {"text": "hook text", "sourceUtteranceIndexes": [0]},
                            "mainPart": [],
                            "conclusion": None,
                            "cta": None,
                        }
                    ),
                }
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
            "completion_tokens_details": {"reasoning_tokens": 5},
        },
    }
    return httpx.Response(200, json=data)


def test_not_configured_error():
    s = Settings(openrouter_api_key="")
    service = OpenRouterService(s)
    with pytest.raises(OpenRouterNotConfiguredError):
        service.analyze_transcription("text", [], None, None)


def test_headers_and_payload(openrouter_settings):
    def handle_request(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer test-key"
        assert "test-key" not in str(request.url)

        payload = json.loads(request.content)
        assert payload["model"] == "openai/gpt-oss-120b:free"
        assert payload["stream"] is False
        assert payload["response_format"]["type"] == "json_schema"
        assert payload["response_format"]["json_schema"]["strict"] is True
        assert payload["reasoning"]["effort"] == "low"
        assert payload["reasoning"]["exclude"] is True
        assert payload["provider"]["require_parameters"] is True

        messages = payload["messages"]
        assert messages[0]["role"] == "system"
        assert "hello" not in messages[0]["content"]
        assert "hello" in messages[1]["content"]
        return make_success_response()

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    service = OpenRouterService(openrouter_settings, client=client)
    res = service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)
    assert res.russian_transcript == "тест"
    assert res.metadata.provider_request_id == "req-123"


def test_healing_enabled():
    s = Settings(
        openrouter_api_key="test-key",
        openrouter_model="openai/gpt-oss-120b:free",
        openrouter_response_healing=True,
    )

    def handle_request(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["plugins"][0]["id"] == "response-healing"
        return make_success_response()

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    service = OpenRouterService(s, client=client)
    service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)


def test_http_errors(openrouter_settings):
    responses = [
        (401, OpenRouterAuthFailedError),
        (403, OpenRouterAuthFailedError),
        (402, OpenRouterRequestFailedError),
        (404, OpenRouterModelUnavailableError),
        (429, OpenRouterRateLimitedError),
        (500, OpenRouterRequestFailedError),
    ]

    for status_code, exc_class in responses:

        def handler(req: httpx.Request, sc: int = status_code) -> httpx.Response:
            return httpx.Response(sc, json={"error": {"message": "err"}})

        client = httpx.Client(transport=httpx.MockTransport(handler))
        service = OpenRouterService(openrouter_settings, client=client)
        with pytest.raises(exc_class):
            service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)


def test_top_level_error(openrouter_settings):
    def handle_request(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": {"message": "Some internal error", "code": 500}})

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    service = OpenRouterService(openrouter_settings, client=client)
    with pytest.raises(OpenRouterRequestFailedError):
        service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)


def test_refusal(openrouter_settings):
    def handle_request(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"choices": [{"message": {"refusal": "I can't do that", "content": None}}]}
        )

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    service = OpenRouterService(openrouter_settings, client=client)
    with pytest.raises(OpenRouterContentFilteredError):
        service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)


def test_invalid_json(openrouter_settings):
    def handle_request(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "not a json"}}]})

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    s = Settings(openrouter_api_key="test-key", openrouter_invalid_response_retries=0)
    service = OpenRouterService(s, client=client)
    with pytest.raises(OpenRouterInvalidResponseError):
        service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)


def test_retry_on_invalid_json(openrouter_settings):
    attempts = 0

    def handle_request(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(200, json={"choices": [{"message": {"content": "not a json"}}]})
        return make_success_response()

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    s = Settings(openrouter_api_key="test-key", openrouter_invalid_response_retries=1)
    service = OpenRouterService(s, client=client)
    res = service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)
    assert res.russian_transcript == "тест"
    assert attempts == 2


def test_negative_or_missing_index(openrouter_settings):
    def handle_request(request: httpx.Request) -> httpx.Response:
        data = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "sourceLanguage": "en",
                                "russianTranscript": "тест",
                                "title": "title",
                                "topic": "topic",
                                "summary": "summary",
                                "hook": {"text": "hook text", "sourceUtteranceIndexes": [-1]},
                                "mainPart": [],
                                "conclusion": None,
                                "cta": None,
                            }
                        )
                    }
                }
            ]
        }
        return httpx.Response(200, json=data)

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    s = Settings(openrouter_api_key="test-key", openrouter_invalid_response_retries=0)
    service = OpenRouterService(s, client=client)
    with pytest.raises(OpenRouterInvalidResponseError, match="Некорректный индекс -1"):
        service.analyze_transcription("hello", [{"index": 0}], "en", 10.0)


def test_markdown_stripped(openrouter_settings):
    def handle_request(request: httpx.Request) -> httpx.Response:
        content = (
            "```json\n"
            + json.dumps(
                {
                    "sourceLanguage": "en",
                    "russianTranscript": "markdown",
                    "title": "t",
                    "topic": "t",
                    "summary": "s",
                    "hook": None,
                    "mainPart": [],
                    "conclusion": None,
                    "cta": None,
                }
            )
            + "\n```"
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    client = httpx.Client(transport=httpx.MockTransport(handle_request))
    service = OpenRouterService(openrouter_settings, client=client)
    res = service.analyze_transcription("hello", [], "en", 10.0)
    assert res.russian_transcript == "markdown"
