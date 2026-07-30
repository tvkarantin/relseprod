"""Tests for the idempotent reel importer."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pytest

from app.models import Competitor, ContentStatus, Reel, ReelContent
from app.repositories.reels import ReelRepository
from app.services.reel_importer import ReelImporter
from app.services.reel_normalizer import NormalizedReel

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


@pytest.fixture
def competitor(db_session: Session) -> Competitor:
    item = Competitor(
        instagram_username="importer",
        profile_url="https://www.instagram.com/importer/",
    )
    db_session.add(item)
    db_session.flush()
    return item


@pytest.fixture
def importer() -> ReelImporter:
    return ReelImporter()


def make_reel(**overrides: object) -> NormalizedReel:
    defaults: dict[str, object] = {
        "instagram_id": "1790000001",
        "shortcode": "SHORT001",
        "original_url": "https://www.instagram.com/reel/SHORT001/",
        "video_url": "https://cdn.example.com/v1.mp4",
        "thumbnail_url": "https://cdn.example.com/t1.jpg",
        "caption": "Первая версия",
        "views_count": 1000,
        "likes_count": 100,
        "comments_count": 10,
        "published_at": datetime(2026, 5, 2, 12, 0, tzinfo=UTC),
        "duration": 30.0,
        "raw_data": {"v": 1},
    }
    return NormalizedReel(**(defaults | overrides))  # type: ignore[arg-type]


def test_new_reel_is_created_with_its_content_row(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    result = importer.import_reels(db_session, competitor, [make_reel()])

    assert (result.created, result.updated, result.skipped) == (1, 0, 0)

    stored = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert stored is not None
    assert stored.views_count == 1000
    assert stored.content is not None
    assert stored.content.content_status is ContentStatus.NEW
    assert stored.content.hook is None
    assert stored.content.script is None


def test_reimport_updates_metrics_without_creating_duplicates(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    importer.import_reels(db_session, competitor, [make_reel()])

    updated_payload = make_reel(
        caption="Обновлённая подпись",
        views_count=5000,
        likes_count=450,
        comments_count=75,
        video_url="https://cdn.example.com/v2.mp4",
        thumbnail_url="https://cdn.example.com/t2.jpg",
        duration=41.5,
        raw_data={"v": 2},
    )
    result = importer.import_reels(db_session, competitor, [updated_payload])

    assert (result.created, result.updated) == (0, 1)
    assert ReelRepository(db_session).count_for_competitor(competitor.id) == 1

    stored = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert stored is not None
    assert stored.caption == "Обновлённая подпись"
    assert stored.views_count == 5000
    assert stored.likes_count == 450
    assert stored.comments_count == 75
    assert stored.video_url == "https://cdn.example.com/v2.mp4"
    assert stored.thumbnail_url == "https://cdn.example.com/t2.jpg"
    assert stored.duration == pytest.approx(41.5)
    assert stored.raw_data == {"v": 2}


def test_reimport_preserves_user_authored_content(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    importer.import_reels(db_session, competitor, [make_reel()])
    stored = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert stored is not None and stored.content is not None

    stored.content.hook = "Мой хук"
    stored.content.script = "Мой сценарий"
    stored.content.cta = "Мой призыв"
    stored.content.notes = "Мои заметки"
    stored.content.content_status = ContentStatus.READY
    db_session.flush()

    importer.import_reels(db_session, competitor, [make_reel(views_count=99_999)])
    db_session.expire_all()

    refreshed = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert refreshed is not None and refreshed.content is not None
    assert refreshed.views_count == 99_999, "external metrics must refresh"
    assert refreshed.content.hook == "Мой хук"
    assert refreshed.content.script == "Мой сценарий"
    assert refreshed.content.cta == "Мой призыв"
    assert refreshed.content.notes == "Мои заметки"
    assert refreshed.content.content_status is ContentStatus.READY


def test_reel_matched_by_instagram_id_when_shortcode_missing(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    importer.import_reels(db_session, competitor, [make_reel()])

    result = importer.import_reels(
        db_session,
        competitor,
        [make_reel(shortcode=None, views_count=7777)],
    )

    assert (result.created, result.updated) == (0, 1)
    assert ReelRepository(db_session).count_for_competitor(competitor.id) == 1


def test_reel_first_seen_with_only_a_shortcode_gains_the_instagram_id_later(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    importer.import_reels(db_session, competitor, [make_reel(instagram_id=None)])

    stored = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert stored is not None
    assert stored.instagram_id is None

    result = importer.import_reels(db_session, competitor, [make_reel()])

    assert (result.created, result.updated) == (0, 1)
    db_session.expire_all()
    refreshed = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert refreshed is not None
    assert refreshed.instagram_id == "1790000001"
    assert ReelRepository(db_session).count_for_competitor(competitor.id) == 1


def test_missing_values_do_not_erase_previously_stored_data(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    importer.import_reels(db_session, competitor, [make_reel()])

    importer.import_reels(
        db_session,
        competitor,
        [make_reel(caption=None, likes_count=None, video_url=None)],
    )
    db_session.expire_all()

    stored = ReelRepository(db_session).get_by_shortcode(competitor.id, "SHORT001")
    assert stored is not None
    assert stored.caption == "Первая версия"
    assert stored.likes_count == 100
    assert stored.video_url == "https://cdn.example.com/v1.mp4"


def test_competitor_reels_count_reflects_the_actual_database_count(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    # A reel imported earlier, before this run.
    db_session.add(Reel(competitor_id=competitor.id, shortcode="PREEXISTING"))
    db_session.flush()
    competitor.reels_count = 999  # deliberately wrong

    importer.import_reels(
        db_session,
        competitor,
        [
            make_reel(shortcode="NEW1", instagram_id="1"),
            make_reel(shortcode="NEW2", instagram_id="2"),
        ],
    )

    assert competitor.reels_count == 3, "count must come from the database, not old value + created"


def test_one_broken_reel_does_not_abort_the_rest(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    # A set is not JSON-serializable, so this row fails on flush.
    reels = [
        make_reel(shortcode="GOOD1", instagram_id="10"),
        make_reel(shortcode="BROKEN", instagram_id="11", raw_data={"bad": {1, 2}}),
        make_reel(shortcode="GOOD2", instagram_id="12"),
    ]

    result = importer.import_reels(db_session, competitor, reels)

    assert result.created == 2, "valid reels must still be imported"
    assert result.skipped == 1
    assert result.errors and result.errors[0].startswith("BROKEN:")

    repository = ReelRepository(db_session)
    assert repository.get_by_shortcode(competitor.id, "GOOD1") is not None
    assert repository.get_by_shortcode(competitor.id, "GOOD2") is not None
    assert repository.get_by_shortcode(competitor.id, "BROKEN") is None
    assert competitor.reels_count == 2


def test_duplicate_items_inside_one_batch_are_not_duplicated(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    result = importer.import_reels(
        db_session,
        competitor,
        [make_reel(views_count=10), make_reel(views_count=20)],
    )

    assert (result.created, result.updated) == (1, 1)
    assert ReelRepository(db_session).count_for_competitor(competitor.id) == 1


def test_empty_batch_is_a_no_op(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    result = importer.import_reels(db_session, competitor, [])

    assert (result.created, result.updated, result.skipped) == (0, 0, 0)
    assert competitor.reels_count == 0


def test_reels_of_two_competitors_do_not_collide(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    other = Competitor(instagram_username="other", profile_url="https://www.instagram.com/other/")
    db_session.add(other)
    db_session.flush()

    importer.import_reels(db_session, competitor, [make_reel()])
    result = importer.import_reels(db_session, other, [make_reel()])

    assert result.created == 1
    assert ReelRepository(db_session).count_for_competitor(competitor.id) == 1
    assert ReelRepository(db_session).count_for_competitor(other.id) == 1


def test_content_row_is_not_duplicated_on_reimport(
    db_session: Session, competitor: Competitor, importer: ReelImporter
) -> None:
    importer.import_reels(db_session, competitor, [make_reel()])
    importer.import_reels(db_session, competitor, [make_reel(views_count=2)])

    from sqlalchemy import func, select

    total_content = db_session.scalar(select(func.count()).select_from(ReelContent))
    assert total_content == 1
