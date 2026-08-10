"""Explainable viral-potential scoring for imported reels."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import UTC, datetime
from statistics import median
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.reel import Reel

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _safe_rate(numerator: int | None, denominator: int | None) -> float:
    if not denominator or denominator <= 0:
        return 0.0
    return max(0, numerator or 0) / denominator


def _age_hours(reel: Reel, now: datetime) -> float:
    if reel.published_at is None:
        return 24.0 * 30
    published = reel.published_at
    if published.tzinfo is None:
        published = published.replace(tzinfo=UTC)
    return max(1.0, (now - published).total_seconds() / 3600)


def _format_multiplier(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


def calculate_viral_scores(
    session: Session,
    reels: list[Reel],
    *,
    now: datetime | None = None,
) -> dict[int, dict[str, object]]:
    """Return stable scores and plain-language reasons for ``reels``.

    Each reel is compared with the other stored reels by the same author. A
    median is used instead of a mean so one historic outlier cannot make every
    new post look weak.
    """
    if not reels:
        return {}

    active_now = now or datetime.now(UTC)
    competitor_ids = {reel.competitor_id for reel in reels}
    baselines = list(
        session.scalars(select(Reel).where(Reel.competitor_id.in_(competitor_ids)))
    )
    by_competitor: dict[int, list[Reel]] = defaultdict(list)
    for baseline in baselines:
        by_competitor[baseline.competitor_id].append(baseline)

    result: dict[int, dict[str, object]] = {}
    for reel in reels:
        peers = [item for item in by_competitor[reel.competitor_id] if item.id != reel.id]
        if not peers:
            peers = by_competitor[reel.competitor_id]

        peer_views = [
            item.views_count for item in peers if item.views_count and item.views_count > 0
        ]
        usual_views = float(median(peer_views)) if peer_views else float(reel.views_count or 1)
        views = float(reel.views_count or 0)
        view_multiplier = views / max(usual_views, 1.0)

        engagement_rate = _safe_rate(
            (reel.likes_count or 0) + (reel.comments_count or 0), reel.views_count
        )
        peer_engagement = [
            _safe_rate((item.likes_count or 0) + (item.comments_count or 0), item.views_count)
            for item in peers
            if item.views_count
        ]
        usual_engagement = (
            median(peer_engagement) if peer_engagement else max(engagement_rate, 0.01)
        )
        engagement_multiplier = engagement_rate / max(usual_engagement, 0.001)

        comment_rate = _safe_rate(reel.comments_count, reel.views_count)
        age_hours = _age_hours(reel, active_now)
        views_per_hour = views / age_hours
        peer_velocity = [
            (item.views_count or 0) / _age_hours(item, active_now)
            for item in peers
            if item.views_count
        ]
        usual_velocity = median(peer_velocity) if peer_velocity else max(views_per_hour, 1.0)
        velocity_multiplier = views_per_hour / max(usual_velocity, 1.0)

        freshness = math.exp(-age_hours / (24 * 21))
        view_signal = min(1.0, math.log2(max(view_multiplier, 0.0) + 1) / 3)
        engagement_signal = min(1.0, engagement_multiplier / 2.5)
        comment_signal = min(1.0, comment_rate / 0.015)
        velocity_signal = min(1.0, velocity_multiplier / 3)
        score = round(
            100
            * (
                0.42 * view_signal
                + 0.22 * engagement_signal
                + 0.12 * comment_signal
                + 0.16 * velocity_signal
                + 0.08 * freshness
            )
        )
        score = max(1, min(99, score))

        reasons: list[str] = []
        if view_multiplier >= 1.15:
            reasons.append(
                f"{_format_multiplier(view_multiplier)}× выше обычных просмотров автора"
            )
        elif view_multiplier < 0.8:
            reasons.append(
                f"Пока {round(view_multiplier * 100)}% от обычных просмотров автора"
            )
        else:
            reasons.append("Просмотры на обычном для автора уровне")

        if engagement_multiplier >= 1.2:
            reasons.append(
                f"Вовлечённость на {round((engagement_multiplier - 1) * 100)}% выше нормы автора"
            )
        elif engagement_rate > 0:
            reasons.append(f"{engagement_rate * 100:.1f}% вовлечённости".replace(".", ","))

        if velocity_multiplier >= 1.25:
            reasons.append(
                f"Набирает просмотры в {_format_multiplier(velocity_multiplier)}× быстрее обычного"
            )
        if age_hours <= 72:
            reasons.append("Опубликован менее 3 дней назад")
        if comment_rate >= 0.01:
            reasons.append("Высокая доля комментариев")

        label = (
            "Сильный сигнал"
            if score >= 75
            else "Есть потенциал"
            if score >= 55
            else "Обычный темп"
        )
        result[reel.id] = {
            "score": score,
            "label": label,
            "primary_reason": reasons[0],
            "reasons": reasons[:3],
            "view_multiplier": round(view_multiplier, 2),
            "engagement_rate": round(engagement_rate, 4),
            "views_per_hour": round(views_per_hour, 1),
        }

    return result
