import json

import httpx

from app.core.config import Settings
from app.services.localized_openrouter import LocalizedOpenRouterService


def _response(transcript: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "id": "req-localized",
            "model": "openai/gpt-oss-120b:free",
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "sourceLanguage": "en",
                                "russianTranscript": transcript,
                                "title": "Title",
                                "topic": "Topic",
                                "summary": "Summary",
                                "hook": {"text": "Hook", "sourceUtteranceIndexes": [0]},
                                "mainPart": [],
                                "conclusion": None,
                                "cta": None,
                            }
                        )
                    }
                }
            ],
        },
    )


def _settings() -> Settings:
    return Settings(
        openrouter_api_key="test-key",
        openrouter_model="openai/gpt-oss-120b:free",
        openrouter_response_healing=False,
    )


def test_english_mode_does_not_translate_english_source():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        system = payload["messages"][0]["content"]
        user = json.loads(payload["messages"][1]["content"])
        assert "DO NOT translate" in system
        assert "All generated title, topic, summary, hook, mainPart, conclusion and cta text must be in English" in system
        assert user["outputLanguage"] == "en"
        assert user["creatorProfile"]["language"] == "en"
        return _response("Keep this exact English transcript")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    service = LocalizedOpenRouterService(_settings(), client=client)
    result = service.analyze_transcription(
        "Keep this exact English transcript",
        [{"index": 0}],
        "en",
        10.0,
        {"language": "en", "niche": "marketing"},
    )
    assert result.russian_transcript == "Keep this exact English transcript"


def test_russian_mode_requests_translation_and_russian_output():
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        system = payload["messages"][0]["content"]
        user = json.loads(payload["messages"][1]["content"])
        assert "Переведи всю речь на естественный русский язык" in system
        assert "Весь адаптированный текст должен быть на русском языке" in system
        assert user["outputLanguage"] == "ru"
        return _response("Русская версия")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    service = LocalizedOpenRouterService(_settings(), client=client)
    result = service.analyze_transcription(
        "English source",
        [{"index": 0}],
        "en",
        10.0,
        {"language": "ru"},
    )
    assert result.russian_transcript == "Русская версия"
