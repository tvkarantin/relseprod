"""Vercel AI Gateway fallback for transcript translation and structural analysis.

Production deployments on Vercel receive a short-lived OIDC token automatically,
so the analysis pipeline can work without storing a separate OpenRouter API key.
OpenRouter remains the preferred provider when OPENROUTER_API_KEY is configured.
"""

from __future__ import annotations

import json
import os
from typing import Any

from app.core.config import Settings
from app.core.errors import OpenRouterNotConfiguredError
from app.services.openrouter import (
    JSON_SCHEMA,
    SYSTEM_PROMPT_V1,
    OpenRouterAnalysisResult,
    OpenRouterService,
)

AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1"
AI_GATEWAY_MODEL = "openai/gpt-5.4-nano"


class VercelAIGatewayService(OpenRouterService):
    """OpenAI-compatible Vercel AI Gateway client using Vercel OIDC auth."""

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: Any | None = None,
    ) -> None:
        super().__init__(settings, client=client)

    @property
    def api_token(self) -> str:
        return (
            os.getenv("AI_GATEWAY_API_KEY", "").strip()
            or os.getenv("VERCEL_OIDC_TOKEN", "").strip()
        )

    def ensure_configured(self) -> None:
        if not self.api_token:
            raise OpenRouterNotConfiguredError(
                "AI-анализ не настроен: отсутствует Vercel AI Gateway OIDC token"
            )

    @property
    def base_url(self) -> str:
        return AI_GATEWAY_BASE_URL

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def analyze_transcription(
        self,
        transcript: str,
        utterances: list[dict[str, Any]],
        detected_language: str | None,
        duration: float | None,
        creator_profile: dict[str, Any] | None = None,
    ) -> OpenRouterAnalysisResult:
        self.ensure_configured()

        url = f"{self.base_url}/chat/completions"
        user_message_content = {
            "transcript": transcript,
            "detectedLanguage": detected_language,
            "duration": duration,
            "utterances": utterances,
            "creatorProfile": creator_profile or {},
        }
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_V1},
            {
                "role": "user",
                "content": json.dumps(user_message_content, ensure_ascii=False),
            },
        ]

        # Keep the request strictly OpenAI-compatible. OpenRouter-specific
        # provider/plugins fields are intentionally omitted here.
        payload: dict[str, Any] = {
            "model": AI_GATEWAY_MODEL,
            "messages": messages,
            "max_tokens": self.settings.openrouter_max_output_tokens,
            "stream": False,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "reel_analysis",
                    "strict": True,
                    "schema": JSON_SCHEMA,
                },
            },
        }

        return self._execute_with_repair(url, payload, utterances)
