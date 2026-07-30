"""Deepgram Speech-to-Text REST API client.

All communication with Deepgram happens here: the frontend never talks to Deepgram
directly. The token is sent in the ``Authorization: Token`` header and is never
logged, never placed in a URL and never returned to the client.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.core.errors import (
    DeepgramAuthFailedError,
    DeepgramInvalidResponseError,
    DeepgramNotConfiguredError,
    DeepgramQuotaExceededError,
    DeepgramRateLimitedError,
    DeepgramRequestFailedError,
)

logger = logging.getLogger(__name__)

_HTTP_ERROR_MESSAGES: dict[int, str] = {
    401: "Deepgram отклонил токен авторизации (401)",
    403: "Доступ к Deepgram запрещен (403)",
    402: "Недостаточно средств на аккаунте Deepgram (402)",
    429: "Превышен лимит запросов к Deepgram (429)",
}


@dataclass(slots=True)
class DeepgramWord:
    word: str
    punctuated_word: str | None = None
    start: float = 0.0
    end: float = 0.0
    confidence: float = 0.0
    language: str | None = None
    speaker: int | None = None


@dataclass(slots=True)
class DeepgramUtterance:
    start: float = 0.0
    end: float = 0.0
    confidence: float = 0.0
    channel: int | None = None
    transcript: str = ""
    speaker: int | None = None
    words: list[DeepgramWord] = field(default_factory=list)


@dataclass(slots=True)
class DeepgramParagraph:
    start: float = 0.0
    end: float = 0.0
    sentences: list[Any] = field(default_factory=list)
    transcript: str = ""


@dataclass(slots=True)
class DeepgramTranscript:
    transcript: str
    confidence: float | None
    dominant_language: str | None
    languages: list[str]
    words: list[DeepgramWord]
    utterances: list[DeepgramUtterance]
    paragraphs: list[DeepgramParagraph]
    request_id: str | None
    duration: float | None
    model: str


class DeepgramService:
    """Typed wrapper over Deepgram Pre-Recorded Speech-to-Text REST API."""

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: httpx.Client | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._client = client
        self._owns_client = client is None

    def ensure_configured(self) -> None:
        if not self.settings.deepgram_configured:
            raise DeepgramNotConfiguredError(
                "Интеграция с Deepgram не настроена: задайте DEEPGRAM_API_KEY"
            )

    @property
    def base_url(self) -> str:
        return self.settings.deepgram_base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Token {self.settings.deepgram_api_key}",
            "Content-Type": "application/json",
        }

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            timeout_sec = float(self.settings.deepgram_timeout_seconds)
            self._client = httpx.Client(timeout=httpx.Timeout(timeout_sec, connect=15.0))
        return self._client

    def close(self) -> None:
        if self._client is not None and self._owns_client:
            self._client.close()
            self._client = None

    def __enter__(self) -> DeepgramService:
        return self

    def __exit__(self, *_exc_info: object) -> None:
        self.close()

    def transcribe_url(self, video_url: str) -> DeepgramTranscript:
        self.ensure_configured()
        url = f"{self.base_url}/listen"
        params = {
            "model": self.settings.deepgram_model,
            "language": self.settings.deepgram_language,
            "smart_format": str(self.settings.deepgram_smart_format).lower(),
            "utterances": str(self.settings.deepgram_utterances).lower(),
            "paragraphs": str(self.settings.deepgram_paragraphs).lower(),
            "numerals": str(self.settings.deepgram_numerals).lower(),
            "punctuate": str(self.settings.deepgram_punctuate).lower(),
        }
        body = {"url": video_url}

        try:
            response = self._get_client().post(
                url, headers=self._headers(), params=params, json=body
            )
        except httpx.TimeoutException as exc:
            logger.warning("Deepgram request timed out")
            raise DeepgramRequestFailedError(
                "Превышено время ожидания ответа от Deepgram",
                details={"operation": "listen"},
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("Deepgram request failed: %s", type(exc).__name__)
            raise DeepgramRequestFailedError(
                "Не удалось связаться с Deepgram",
                details={"operation": "listen"},
            ) from exc

        if response.status_code == 401 or response.status_code == 403:
            raise DeepgramAuthFailedError(
                _HTTP_ERROR_MESSAGES[response.status_code],
                details={"statusCode": response.status_code, "operation": "listen"},
            )
        if response.status_code == 402:
            raise DeepgramQuotaExceededError(
                _HTTP_ERROR_MESSAGES[402],
                details={"statusCode": 402, "operation": "listen"},
            )
        if response.status_code == 429:
            raise DeepgramRateLimitedError(
                _HTTP_ERROR_MESSAGES[429],
                details={"statusCode": 429, "operation": "listen"},
            )
        if response.status_code >= 400:
            logger.warning("Deepgram returned HTTP %s", response.status_code)
            raise DeepgramRequestFailedError(
                f"Deepgram вернул ошибку HTTP {response.status_code}",
                details={"statusCode": response.status_code, "operation": "listen"},
            )

        try:
            payload = response.json()
        except ValueError as exc:
            logger.warning("Deepgram returned non-JSON body")
            raise DeepgramInvalidResponseError(
                "Deepgram вернул некорректный JSON",
                details={"operation": "listen"},
            ) from exc

        return self._normalize_response(payload, self.settings.deepgram_model)

    @staticmethod
    def _normalize_response(payload: Any, model: str) -> DeepgramTranscript:
        if not isinstance(payload, dict):
            raise DeepgramInvalidResponseError("Deepgram вернул неожиданный формат ответа")

        metadata = payload.get("metadata", {})
        request_id = metadata.get("request_id") if isinstance(metadata, dict) else None
        duration = metadata.get("duration") if isinstance(metadata, dict) else None

        results = payload.get("results")
        if not isinstance(results, dict):
            raise DeepgramInvalidResponseError("В ответе Deepgram отсутствуют результаты")

        channels = results.get("channels")
        if not isinstance(channels, list) or not channels:
            raise DeepgramInvalidResponseError("В ответе Deepgram отсутствуют каналы")

        first_channel = channels[0]
        if not isinstance(first_channel, dict):
            raise DeepgramInvalidResponseError("Некорректный формат канала Deepgram")

        alternatives = first_channel.get("alternatives")
        if not isinstance(alternatives, list) or not alternatives:
            raise DeepgramInvalidResponseError("В ответе Deepgram отсутствуют альтернативы")

        alt = alternatives[0]
        if not isinstance(alt, dict):
            raise DeepgramInvalidResponseError("Некорректный формат альтернативы Deepgram")

        transcript = alt.get("transcript", "")
        if not isinstance(transcript, str):
            transcript = ""

        confidence = alt.get("confidence")
        if not isinstance(confidence, (int, float)):
            confidence = None

        words: list[DeepgramWord] = []
        raw_words = alt.get("words", [])
        if isinstance(raw_words, list):
            for w in raw_words:
                if isinstance(w, dict):
                    p_word = w.get("punctuated_word")
                    p_word_str = p_word if isinstance(p_word, str) else None
                    start_v = w.get("start", 0.0)
                    start_f = float(start_v) if isinstance(start_v, (int, float)) else 0.0
                    end_v = w.get("end", 0.0)
                    end_f = float(end_v) if isinstance(end_v, (int, float)) else 0.0
                    conf_v = w.get("confidence", 0.0)
                    conf_f = float(conf_v) if isinstance(conf_v, (int, float)) else 0.0
                    lang_v = w.get("language")
                    lang_str = lang_v if isinstance(lang_v, str) else None
                    spk_v = w.get("speaker")
                    spk_int = int(spk_v) if isinstance(spk_v, (int, float)) else None

                    words.append(
                        DeepgramWord(
                            word=str(w.get("word", "")),
                            punctuated_word=p_word_str,
                            start=start_f,
                            end=end_f,
                            confidence=conf_f,
                            language=lang_str,
                            speaker=spk_int,
                        )
                    )

        utterances: list[DeepgramUtterance] = []
        raw_utterances = results.get("utterances", [])
        if isinstance(raw_utterances, list):
            for u in raw_utterances:
                if isinstance(u, dict):
                    u_words: list[DeepgramWord] = []
                    for uw in u.get("words", []):
                        if isinstance(uw, dict):
                            p_w = uw.get("punctuated_word")
                            p_w_str = p_w if isinstance(p_w, str) else None
                            s_v = uw.get("start", 0.0)
                            s_f = float(s_v) if isinstance(s_v, (int, float)) else 0.0
                            e_v = uw.get("end", 0.0)
                            e_f = float(e_v) if isinstance(e_v, (int, float)) else 0.0
                            c_v = uw.get("confidence", 0.0)
                            c_f = float(c_v) if isinstance(c_v, (int, float)) else 0.0
                            l_v = uw.get("language")
                            l_str = l_v if isinstance(l_v, str) else None
                            sp_v = uw.get("speaker")
                            sp_int = int(sp_v) if isinstance(sp_v, (int, float)) else None

                            u_words.append(
                                DeepgramWord(
                                    word=str(uw.get("word", "")),
                                    punctuated_word=p_w_str,
                                    start=s_f,
                                    end=e_f,
                                    confidence=c_f,
                                    language=l_str,
                                    speaker=sp_int,
                                )
                            )
                    ustart_v = u.get("start", 0.0)
                    ustart_f = float(ustart_v) if isinstance(ustart_v, (int, float)) else 0.0
                    uend_v = u.get("end", 0.0)
                    uend_f = float(uend_v) if isinstance(uend_v, (int, float)) else 0.0
                    uconf_v = u.get("confidence", 0.0)
                    uconf_f = float(uconf_v) if isinstance(uconf_v, (int, float)) else 0.0
                    uch_v = u.get("channel")
                    uch_int = int(uch_v) if isinstance(uch_v, (int, float)) else None
                    ut_v = u.get("transcript", "")
                    ut_str = str(ut_v) if isinstance(ut_v, str) else ""
                    usp_v = u.get("speaker")
                    usp_int = int(usp_v) if isinstance(usp_v, (int, float)) else None

                    utterances.append(
                        DeepgramUtterance(
                            start=ustart_f,
                            end=uend_f,
                            confidence=uconf_f,
                            channel=uch_int,
                            transcript=ut_str,
                            speaker=usp_int,
                            words=u_words,
                        )
                    )

        paragraphs: list[DeepgramParagraph] = []
        p_obj = alt.get("paragraphs", {})
        if isinstance(p_obj, dict):
            raw_paragraphs = p_obj.get("paragraphs", [])
            if isinstance(raw_paragraphs, list):
                for p in raw_paragraphs:
                    if isinstance(p, dict):
                        pstart_v = p.get("start", 0.0)
                        pstart_f = float(pstart_v) if isinstance(pstart_v, (int, float)) else 0.0
                        pend_v = p.get("end", 0.0)
                        pend_f = float(pend_v) if isinstance(pend_v, (int, float)) else 0.0
                        sent_v = p.get("sentences", [])
                        sent_list = sent_v if isinstance(sent_v, list) else []
                        pt_v = p.get("transcript", "")
                        pt_str = str(pt_v) if isinstance(pt_v, str) else ""

                        paragraphs.append(
                            DeepgramParagraph(
                                start=pstart_f,
                                end=pend_f,
                                sentences=sent_list,
                                transcript=pt_str,
                            )
                        )

        lang_counts: dict[str, int] = {}
        for w in words:
            if w.language and isinstance(w.language, str):
                lang_code = w.language.strip()
                if lang_code:
                    lang_counts[lang_code] = lang_counts.get(lang_code, 0) + 1

        sorted_langs = sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
        languages = [lang_code for lang_code, _count in sorted_langs]
        dominant_language = languages[0] if languages else None

        return DeepgramTranscript(
            transcript=transcript,
            confidence=confidence,
            dominant_language=dominant_language,
            languages=languages,
            words=words,
            utterances=utterances,
            paragraphs=paragraphs,
            request_id=request_id if isinstance(request_id, str) else None,
            duration=float(duration) if isinstance(duration, (int, float)) else None,
            model=model,
        )
