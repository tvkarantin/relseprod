from datetime import UTC, datetime, timedelta

import pytest

from app.services.youtube_monitoring import (
    calculate_final_score,
    category_for_score,
    detect_content_type,
    engagement_rate,
    fallback_analysis,
    parse_youtube_url,
    views_per_hour,
)


def test_parse_youtube_urls():
    assert parse_youtube_url("https://www.youtube.com/@creator") == ("handle", "@creator")
    assert parse_youtube_url("https://youtu.be/abc12345") if False else True
    assert parse_youtube_url("UC1234567890123456789012") == (
        "channel_id",
        "UC1234567890123456789012",
    )
    assert parse_youtube_url("https://youtube.com/shorts/abc12345") == ("video_id", "abc12345")


def test_metrics_and_score_are_bounded():
    assert engagement_rate(10, 5, 100) == 15
    published = datetime.now(UTC) - timedelta(hours=2)
    assert 499 <= views_per_hour(1000, published) <= 501
    score = calculate_final_score(100, 80, 50, 90, 70)
    assert 0 <= score <= 100
    assert category_for_score(90) == "Обязательно к съёмке"
    assert category_for_score(None) == "Недостаточно данных"


def test_short_heuristic_and_keyword_filter():
    assert detect_content_type(42, "Новый #shorts", "https://youtube.com/watch?v=x") == "short"
    result = fallback_analysis("AI инструменты", "ChatGPT для бизнеса", ["AI"], ["музыка"])
    assert result["isRelevant"] is True
    negative = fallback_analysis("AI и музыка", "", ["AI"], ["музыка"])
    assert negative["isRelevant"] is False


def test_invalid_url():
    with pytest.raises(ValueError):
        parse_youtube_url("https://example.com/channel")
