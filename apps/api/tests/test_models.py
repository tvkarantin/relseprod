"""Database-level tests for the ORM models."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import (
    Competitor,
    CompetitorStatus,
    ContentStatus,
    ParsingJob,
    ParsingJobStatus,
    Reel,
    ReelContent,
    ReelImportMode,
)
from app.repositories import CompetitorRepository, ParsingJobRepository, ReelRepository

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def make_competitor(username: str = "example") -> Competitor:
    return Competitor(
        instagram_username=username,
        profile_url=f"https://www.instagram.com/{username}/",
    )


def test_create_competitor_applies_defaults(db_session: Session) -> None:
    competitor = make_competitor()
    db_session.add(competitor)
    db_session.flush()

    assert competitor.id is not None
    assert competitor.status is CompetitorStatus.IDLE
    assert competitor.reels_count == 0
    assert competitor.last_parsed_at is None
    assert competitor.created_at.tzinfo is not None
    assert competitor.created_at.utcoffset() == UTC.utcoffset(None)


def test_competitor_username_is_unique(db_session: Session) -> None:
    db_session.add(make_competitor("duplicate"))
    db_session.flush()

    db_session.add(make_competitor("duplicate"))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_create_reel_linked_to_competitor(db_session: Session) -> None:
    competitor = make_competitor("with_reels")
    db_session.add(competitor)
    db_session.flush()

    reel = Reel(
        competitor_id=competitor.id,
        instagram_id="17900000000000000",
        shortcode="CxAbCdEf",
        original_url="https://www.instagram.com/reel/CxAbCdEf/",
        caption="Пример подписи",
        views_count=1_200_000,
        likes_count=None,
        comments_count=None,
        published_at=datetime(2026, 5, 2, 12, 0, tzinfo=UTC),
        duration=32.5,
        raw_data={"source": "test", "nested": {"ok": True}},
    )
    db_session.add(reel)
    db_session.flush()
    db_session.refresh(competitor)

    assert reel.id is not None
    assert reel.competitor is competitor
    assert competitor.reels == [reel]
    assert reel.raw_data == {"source": "test", "nested": {"ok": True}}
    assert reel.likes_count is None
    assert reel.published_at == datetime(2026, 5, 2, 12, 0, tzinfo=UTC)


def test_reel_shortcode_is_unique_per_competitor(db_session: Session) -> None:
    first = make_competitor("first")
    second = make_competitor("second")
    db_session.add_all([first, second])
    db_session.flush()

    db_session.add(Reel(competitor_id=first.id, shortcode="SAME"))
    db_session.flush()

    # The same shortcode is allowed for a different competitor.
    db_session.add(Reel(competitor_id=second.id, shortcode="SAME"))
    db_session.flush()

    db_session.add(Reel(competitor_id=first.id, shortcode="SAME"))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_create_reel_content_defaults_to_new(db_session: Session) -> None:
    competitor = make_competitor("content_owner")
    db_session.add(competitor)
    db_session.flush()
    reel = Reel(competitor_id=competitor.id, shortcode="CONTENT1")
    db_session.add(reel)
    db_session.flush()

    content = ReelContent(reel_id=reel.id, hook="Хук", script="Сценарий")
    db_session.add(content)
    db_session.flush()
    db_session.refresh(reel)

    assert content.content_status is ContentStatus.NEW
    assert content.cta is None
    assert content.notes is None
    assert reel.content is content
    assert content.reel is reel


def test_reel_content_reel_id_is_unique(db_session: Session) -> None:
    competitor = make_competitor("one_to_one")
    db_session.add(competitor)
    db_session.flush()
    reel = Reel(competitor_id=competitor.id, shortcode="ONE2ONE")
    db_session.add(reel)
    db_session.flush()

    db_session.add(ReelContent(reel_id=reel.id))
    db_session.flush()

    db_session.add(ReelContent(reel_id=reel.id))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_create_parsing_job_applies_defaults(db_session: Session) -> None:
    competitor = make_competitor("job_owner")
    db_session.add(competitor)
    db_session.flush()

    job = ParsingJob(competitor_id=competitor.id)
    db_session.add(job)
    db_session.flush()

    assert job.status is ParsingJobStatus.QUEUED
    assert job.import_mode is ReelImportMode.POPULAR
    assert job.progress == 0
    assert job.reels_created == 0
    assert job.reels_updated == 0
    assert job.error_message is None
    assert job.started_at is None
    assert job.completed_at is None
    assert job.is_active is True
    assert job.competitor is competitor


def test_deleting_competitor_cascades_to_reels_content_and_jobs(db_session: Session) -> None:
    competitor = make_competitor("cascade")
    db_session.add(competitor)
    db_session.flush()

    reel = Reel(competitor_id=competitor.id, shortcode="CASCADE1")
    db_session.add(reel)
    db_session.flush()
    db_session.add(ReelContent(reel_id=reel.id, hook="Хук"))
    db_session.add(ParsingJob(competitor_id=competitor.id))
    db_session.flush()

    competitor_id = competitor.id
    db_session.delete(competitor)
    db_session.flush()
    db_session.expire_all()

    assert db_session.get(Competitor, competitor_id) is None
    assert db_session.scalar(select(func.count()).select_from(Reel)) == 0
    assert db_session.scalar(select(func.count()).select_from(ReelContent)) == 0
    assert db_session.scalar(select(func.count()).select_from(ParsingJob)) == 0


def test_deleting_reel_cascades_to_content_only(db_session: Session) -> None:
    competitor = make_competitor("reel_cascade")
    db_session.add(competitor)
    db_session.flush()
    reel = Reel(competitor_id=competitor.id, shortcode="RC1")
    db_session.add(reel)
    db_session.flush()
    db_session.add(ReelContent(reel_id=reel.id))
    db_session.flush()

    db_session.delete(reel)
    db_session.flush()
    db_session.expire_all()

    assert db_session.scalar(select(func.count()).select_from(ReelContent)) == 0
    assert db_session.get(Competitor, competitor.id) is not None


def test_repositories_expose_basic_lookups(db_session: Session) -> None:
    competitors = CompetitorRepository(db_session)
    reels = ReelRepository(db_session)
    jobs = ParsingJobRepository(db_session)

    competitor = competitors.add(make_competitor("repo_user"))
    assert competitors.get(competitor.id) is competitor
    assert competitors.get_by_username("REPO_USER") is competitor
    assert competitors.get_by_username("missing") is None
    assert competitors.exists_by_username("repo_user") is True

    reel = reels.add(Reel(competitor_id=competitor.id, shortcode="REPO1", instagram_id="42"))
    assert reels.get_by_shortcode(competitor.id, "REPO1") is reel
    assert reels.get_by_instagram_id(competitor.id, "42") is reel
    assert reels.count_for_competitor(competitor.id) == 1
    assert reels.list_for_competitor(competitor.id) == [reel]

    job = jobs.add(ParsingJob(competitor_id=competitor.id))
    assert jobs.get_active_for_competitor(competitor.id) is job

    job.status = ParsingJobStatus.COMPLETED
    db_session.flush()
    assert jobs.get_active_for_competitor(competitor.id) is None

    reels.delete(reel)
    assert reels.count_for_competitor(competitor.id) == 0
