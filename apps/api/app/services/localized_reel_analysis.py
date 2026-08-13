"""Language-aware analysis orchestration metadata."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.services.reel_analysis import ReelAnalysisService

if TYPE_CHECKING:
    from app.models.reel_analysis import ReelAnalysis


class LocalizedReelAnalysisService(ReelAnalysisService):
    """Include the selected output language in the prompt version metadata."""

    def create_or_retry_analysis(
        self,
        reel_id: int,
        creator_profile: dict[str, Any] | None = None,
    ) -> ReelAnalysis:
        analysis = super().create_or_retry_analysis(reel_id, creator_profile)
        profile = creator_profile or {}
        language = "en" if str(profile.get("language", "ru")).lower() == "en" else "ru"
        analysis.prompt_version = f"v3-localized-{language}"
        self.session.commit()
        return analysis
