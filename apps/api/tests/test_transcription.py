"""Tests for Deepgram transcription integration and endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import ErrorCode
from app.models import Competitor, Reel, ReelTranscription, TranscriptionStatus
from app.services.deepgram import DeepgramService
from app.tasks.transcribe_reel import transcribe_reel_job

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

TOKEN = "test-deepgram-token"


def make_settings(**overrides: Any) -> Settings:
    defaults: dict[str, Any] = {
        "deepgram_api_key": TOKEN,
        "deepgram_base_url": "https://api.deepgram.com/v1",
        "deepgram_model": "nova-3",
        "deepgram_language": "multi",
        "deepgram_timeout_seconds": 30,
    }
    return Settings(**(defaults | overrides))


def make_deepgram_service(handler: Any, **overrides: Any) -> DeepgramService:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return DeepgramService(make_settings(**overrides), client=client)


def sample_deepgram_response(
    transcript: str = "Привет мир. Это тест.",
    words: list[Any] | None = None,
    utterances: list[Any] | None = None,
    paragraphs: list[Any] | None = None,
) -> dict[str, Any]:
    if words is None:
        words = [
            {"word": "Привет", "start": 0.0, "end": 0.5, "confidence": 0.99, "language": "ru"},
            {"word": "мир.", "start": 0.5, "end": 1.0, "confidence": 0.98, "language": "ru"},
            {"word": "Это", "start": 1.2, "end": 1.5, "confidence": 0.95, "language": "ru"},
            {"word": "тест.", "start": 1.5, "end": 2.0, "confidence": 0.97, "language": "ru"},
        ]
    if utterances is None:
        utterances = [
            {
                "start": 0.0,
                "end": 2.0,
                "confidence": 0.97,
                "transcript": transcript,
                "words": words,
            }
        ]
    if paragraphs is None:
        paragraphs = [
            {
                "start": 0.0,
                "end": 2.0,
                "transcript": transcript,
                "sentences": [{"text": transcript}],
            }
        ]
    return {
        "metadata": {"request_id": "req-123", "duration": 2.5},
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": transcript,
                            "confidence": 0.97,
                            "words": words,
                            "paragraphs": {"paragraphs": paragraphs},
                        }
                    ]
                }
            ],
            "utterances": utterances,
        },
    }


def test_app_starts_without_deepgram_key() -> None:
    settings = make_settings(deepgram_api_key="")
    assert not settings.deepgram_configured


def test_ensure_configured_raises_when_missing() -> None:
    service = make_deepgram_service(lambda r: httpx.Response(200, json={}), deepgram_api_key="")
    with pytest.raises(Exception) as exc_info:
        service.ensure_configured()
    assert "DEEPGRAM_API_KEY" in str(exc_info.value)


def test_deepgram_request_headers_and_params() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = request.read().decode()
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=sample_deepgram_response())

    with make_deepgram_service(handler) as service:
        res = service.transcribe_url("https://example.com/video.mp4")

    assert res.transcript == "Привет мир. Это тест."
    assert seen["auth"] == f"Token {TOKEN}"
    assert TOKEN not in seen["url"]
    assert "https://example.com/video.mp4" in seen["body"]
    assert seen["params"]["model"] == "nova-3"
    assert seen["params"]["language"] == "multi"
    assert seen["params"]["smart_format"] == "true"
    assert seen["params"]["utterances"] == "true"
    assert seen["params"]["paragraphs"] == "true"


def test_dominant_language_and_languages_calculation() -> None:
    words = [
        {"word": "Hello", "language": "en"},
        {"word": "world", "language": "en"},
        {"word": "Bonjour", "language": "fr"},
    ]
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=sample_deepgram_response(words=words))

    with make_deepgram_service(handler) as service:
        res = service.transcribe_url("https://example.com/video.mp4")

    assert res.dominant_language == "en"
    assert res.languages == ["en", "fr"]


def test_empty_transcript_handling() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=sample_deepgram_response(
                transcript="", words=[], utterances=[], paragraphs=[]
            ),
        )

    with make_deepgram_service(handler) as service:
        res = service.transcribe_url("https://example.com/video.mp4")

    assert res.transcript == ""
    assert res.dominant_language is None
    assert res.languages == []


@pytest.mark.parametrize(
    ("status_code", "expected_code"),
    [
        (401, ErrorCode.DEEPGRAM_AUTH_FAILED),
        (403, ErrorCode.DEEPGRAM_AUTH_FAILED),
        (402, ErrorCode.DEEPGRAM_QUOTA_EXCEEDED),
        (429, ErrorCode.DEEPGRAM_RATE_LIMITED),
        (500, ErrorCode.DEEPGRAM_REQUEST_FAILED),
    ],
)
def test_deepgram_http_error_codes(status_code: int, expected_code: ErrorCode) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"error": "failed"})

    with make_deepgram_service(handler) as service, pytest.raises(Exception) as exc_info:
        service.transcribe_url("https://example.com/video.mp4")

    assert getattr(exc_info.value, "code", None) is expected_code


def test_deepgram_invalid_response_formats() -> None:
    def handler1(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not json")

    with make_deepgram_service(handler1) as service, pytest.raises(Exception) as exc_info:
        service.transcribe_url("https://example.com/video.mp4")
    assert getattr(exc_info.value, "code", None) is ErrorCode.DEEPGRAM_INVALID_RESPONSE

    def handler2(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"metadata": {}})

    with make_deepgram_service(handler2) as service, pytest.raises(Exception) as exc_info:
        service.transcribe_url("https://example.com/video.mp4")
    assert getattr(exc_info.value, "code", None) is ErrorCode.DEEPGRAM_INVALID_RESPONSE


def test_transcription_api_flow(client: TestClient, db_session: Session) -> None:
    competitor = Competitor(instagram_username="user1", profile_url="https://ig.com/user1")
    db_session.add(competitor)
    db_session.commit()

    reel = Reel(
        competitor_id=competitor.id,
        shortcode="ABC",
        video_url="https://example.com/reel.mp4",
    )
    db_session.add(reel)
    db_session.commit()

    resp = client.get(f"/api/v1/reels/{reel.id}/transcription")
    assert resp.status_code == 200
    assert resp.json() is None

    resp = client.post(f"/api/v1/reels/{reel.id}/transcription")
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "queued"

    resp = client.post(f"/api/v1/reels/{reel.id}/transcription")
    assert resp.status_code == 409


def test_transcription_retry_flow(client: TestClient, db_session: Session) -> None:
    competitor = Competitor(instagram_username="user2", profile_url="https://ig.com/user2")
    db_session.add(competitor)
    db_session.commit()

    reel = Reel(
        competitor_id=competitor.id,
        shortcode="XYZ",
        video_url="https://example.com/reel.mp4",
    )
    db_session.add(reel)
    db_session.commit()

    transcription = ReelTranscription(
        reel_id=reel.id,
        status=TranscriptionStatus.FAILED,
        error_code="DEEPGRAM_REQUEST_FAILED",
        error_message="Error",
    )
    db_session.add(transcription)
    db_session.commit()

    resp = client.post(f"/api/v1/reels/{reel.id}/transcription/retry")
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


def test_background_task_execution(
    db_session: Session, settings: Settings, monkeypatch: Any
) -> None:
    from app.tasks import transcribe_reel as task_module

    competitor = Competitor(instagram_username="user3", profile_url="https://ig.com/user3")
    db_session.add(competitor)
    db_session.commit()

    reel = Reel(
        competitor_id=competitor.id,
        shortcode="BG1",
        video_url="https://example.com/reel.mp4",
    )
    db_session.add(reel)
    db_session.commit()

    transcription = ReelTranscription(
        reel_id=reel.id,
        status=TranscriptionStatus.QUEUED,
    )
    db_session.add(transcription)
    db_session.commit()
    t_id = transcription.id

    def mock_transcribe(self: Any, url: str) -> Any:
        from app.services.deepgram import DeepgramTranscript
        return DeepgramTranscript(
            transcript="Background success",
            confidence=0.99,
            dominant_language="ru",
            languages=["ru"],
            words=[],
            utterances=[],
            paragraphs=[],
            request_id="req-bg",
            duration=1.0,
            model="nova-3",
        )

    monkeypatch.setattr(DeepgramService, "transcribe_url", mock_transcribe)
    monkeypatch.setattr(
        task_module, "get_session_factory", lambda _settings: (lambda: db_session)
    )

    transcribe_reel_job(t_id, settings)

    t = db_session.get(ReelTranscription, t_id)
    assert t.status == TranscriptionStatus.COMPLETED
    assert t.transcript == "Background success"


def test_reel_cascade_delete(db_session: Session) -> None:
    competitor = Competitor(instagram_username="user4", profile_url="https://ig.com/user4")
    db_session.add(competitor)
    db_session.commit()

    reel = Reel(
        competitor_id=competitor.id,
        shortcode="DEL",
        video_url="https://example.com/reel.mp4",
    )
    db_session.add(reel)
    db_session.commit()

    transcription = ReelTranscription(
        reel_id=reel.id,
        status=TranscriptionStatus.COMPLETED,
        transcript="Test",
    )
    db_session.add(transcription)
    db_session.commit()

    db_session.delete(reel)
    db_session.commit()

    assert db_session.query(ReelTranscription).count() == 0
