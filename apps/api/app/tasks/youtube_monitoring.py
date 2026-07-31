"""Cron entrypoint for YouTube monitoring.

Run this from a scheduler, never from a request handler:
``python -m app.tasks.youtube_monitoring``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.api.v1.monitoring import run_topic
from app.core.config import get_settings
from app.database.session import session_scope
from app.models.monitoring import MonitoringTopic


def run_due_topics() -> int:
    settings = get_settings()
    if not settings.youtube_monitoring_enabled:
        return 0
    with session_scope(settings) as db:
        topics = db.scalars(
            select(MonitoringTopic).where(MonitoringTopic.is_active.is_(True))
        ).all()
        due = [
            topic
            for topic in topics
            if topic.last_checked_at is None
            or topic.last_checked_at
            <= datetime.now(UTC) - timedelta(hours=topic.check_interval_hours)
        ]
        ids = [(topic.id, topic.user_id) for topic in due]
    for topic_id, user_id in ids:
        run_topic(topic_id, user_id, settings)
    return len(ids)


if __name__ == "__main__":  # pragma: no cover
    print(f"Processed {run_due_topics()} YouTube monitoring topics")
