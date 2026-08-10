"""Tests for the reels library, the editor and the dashboard."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.errors import ErrorCode
from app.models import Competitor, ContentStatus, ParsingJob, ParsingJobStatus, Reel, ReelContent

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

REELS = "/api/v1/reels"
MY_REELS = "/api/v1/reels/my"
DASHBOARD = "/api/v1/dashboard/summary"


def error_code(response: Any) -> str:
    payload = response.json()
    assert set(payload) == {"error"}
    return payload["error"]["code"]


def make_competitor(db: Session, username: str = "libowner") -> Competitor:
    competitor = Competitor(
        instagram_username=username,
        profile_url=f"https://www.instagram.com/{username}/",
    )
    db.add(competitor)
    db.commit()
    return competitor


def make_reel(
    db: Session,
    competitor: Competitor,
    shortcode: str,
    *,
    published_at: datetime | None = None,
    content: dict[str, Any] | None = None,
    with_content: bool = True,
    **fields: Any,
) -> Reel:
    reel = Reel(
        competitor_id=competitor.id,
        shortcode=shortcode,
        instagram_id=f"id-{shortcode}",
        original_url=f"https://www.instagram.com/reel/{shortcode}/",
        published_at=published_at,
        **fields,
    )
    db.add(reel)
    db.flush()
    if with_content:
        db.add(ReelContent(reel_id=reel.id, **(content or {})))
    db.commit()
    return reel


@pytest.fixture
def competitor(db_session: Session) -> Competitor:
    return make_competitor(db_session)


# ------------------------------------------------------------------ listing


def test_empty_library_returns_an_empty_page(client: TestClient) -> None:
    body = client.get(REELS).json()

    assert body == {"items": [], "page": 1, "limit": 20, "total": 0, "pages": 0}


def test_library_returns_reels_with_competitor_and_content(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(
        db_session,
        competitor,
        "AAA",
        caption="Как снимать рилсы",
        views_count=1000,
        likes_count=50,
        comments_count=5,
        duration=28.5,
        published_at=datetime(2026, 7, 20, 10, 0, tzinfo=UTC),
        content={"hook": "Мой хук", "content_status": ContentStatus.NEW},
    )

    body = client.get(REELS).json()

    assert body["total"] == 1
    assert body["pages"] == 1
    item = body["items"][0]
    assert item["shortcode"] == "AAA"
    assert item["caption"] == "Как снимать рилсы"
    assert item["viewsCount"] == 1000
    assert item["competitor"] == {
        "id": competitor.id,
        "instagramUsername": "libowner",
        "profileUrl": "https://www.instagram.com/libowner/",
    }
    assert item["content"]["hook"] == "Мой хук"
    assert item["content"]["contentStatus"] == "new"
    assert item["content"]["script"] == ""


def test_reels_are_ordered_by_published_at_desc_with_nulls_last(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    make_reel(db_session, competitor, "OLD", published_at=base)
    make_reel(db_session, competitor, "NEW", published_at=base + timedelta(days=5))
    make_reel(db_session, competitor, "NONE", published_at=None)
    make_reel(db_session, competitor, "MID", published_at=base + timedelta(days=2))

    codes = [item["shortcode"] for item in client.get(REELS).json()["items"]]

    assert codes == ["NEW", "MID", "OLD", "NONE"]


def test_reels_are_sorted_by_global_views_before_pagination(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    other = make_competitor(db_session, "otherowner")
    make_reel(db_session, competitor, "AUTHOR_A_TOP", views_count=9_000)
    make_reel(db_session, competitor, "AUTHOR_A_LOW", views_count=100)
    make_reel(db_session, other, "AUTHOR_B_TOP", views_count=12_000)
    make_reel(db_session, other, "AUTHOR_B_MID", views_count=5_000)

    first = client.get(REELS, params={"sort": "views", "page": 1, "limit": 2}).json()
    second = client.get(REELS, params={"sort": "views", "page": 2, "limit": 2}).json()

    assert [item["shortcode"] for item in first["items"]] == [
        "AUTHOR_B_TOP",
        "AUTHOR_A_TOP",
    ]
    assert [item["shortcode"] for item in second["items"]] == [
        "AUTHOR_B_MID",
        "AUTHOR_A_LOW",
    ]


def test_reels_can_be_sorted_globally_by_likes(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    other = make_competitor(db_session, "otherowner")
    make_reel(db_session, competitor, "MOST_VIEWS", views_count=50_000, likes_count=100)
    make_reel(db_session, other, "MOST_LIKES", views_count=1_000, likes_count=2_000)

    body = client.get(REELS, params={"sort": "likes"}).json()

    assert [item["shortcode"] for item in body["items"]] == ["MOST_LIKES", "MOST_VIEWS"]


def test_unknown_library_sort_is_rejected(client: TestClient) -> None:
    response = client.get(REELS, params={"sort": "author_popularity"})

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


def test_pagination_splits_results_and_reports_totals(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    base = datetime(2026, 7, 1, tzinfo=UTC)
    for index in range(5):
        make_reel(db_session, competitor, f"R{index}", published_at=base + timedelta(days=index))

    first = client.get(REELS, params={"page": 1, "limit": 2}).json()
    second = client.get(REELS, params={"page": 2, "limit": 2}).json()
    third = client.get(REELS, params={"page": 3, "limit": 2}).json()

    assert (first["total"], first["pages"], first["page"]) == (5, 3, 1)
    assert [item["shortcode"] for item in first["items"]] == ["R4", "R3"]
    assert [item["shortcode"] for item in second["items"]] == ["R2", "R1"]
    assert [item["shortcode"] for item in third["items"]] == ["R0"]


def test_page_beyond_the_last_one_returns_empty_items_not_an_error(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "ONLY")

    response = client.get(REELS, params={"page": 99})

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["total"] == 1


@pytest.mark.parametrize("limit", [0, -1, 101, 1000])
def test_invalid_limit_is_rejected(client: TestClient, limit: int) -> None:
    response = client.get(REELS, params={"limit": limit})

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


@pytest.mark.parametrize("page", [0, -5])
def test_invalid_page_is_rejected(client: TestClient, page: int) -> None:
    response = client.get(REELS, params={"page": page})

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


def test_search_longer_than_200_characters_is_rejected(client: TestClient) -> None:
    response = client.get(REELS, params={"search": "x" * 201})

    assert response.status_code == 422


def test_non_positive_competitor_id_is_rejected(client: TestClient) -> None:
    response = client.get(REELS, params={"competitor_id": 0})

    assert response.status_code == 422


def test_competitor_filter_limits_the_results(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    other = make_competitor(db_session, "otherowner")
    make_reel(db_session, competitor, "MINE")
    make_reel(db_session, other, "THEIRS")

    body = client.get(REELS, params={"competitor_id": competitor.id}).json()

    assert body["total"] == 1
    assert body["items"][0]["shortcode"] == "MINE"


# ------------------------------------------------------------------- search


def test_search_matches_the_caption(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "AAA", caption="Разбор маркетинга")
    make_reel(db_session, competitor, "BBB", caption="Про спорт")

    body = client.get(REELS, params={"search": "маркетинг"}).json()

    assert [item["shortcode"] for item in body["items"]] == ["AAA"]


def test_search_matches_the_competitor_username(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    other = make_competitor(db_session, "marketingpro")
    make_reel(db_session, competitor, "AAA")
    make_reel(db_session, other, "BBB")

    body = client.get(REELS, params={"search": "marketingpro"}).json()

    assert [item["shortcode"] for item in body["items"]] == ["BBB"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("hook", "Уникальныйхук"),
        ("script", "Уникальныйсценарий"),
        ("cta", "Уникальныйпризыв"),
        ("notes", "Уникальнаязаметка"),
    ],
)
def test_search_matches_user_content_fields(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    field: str,
    value: str,
) -> None:
    make_reel(db_session, competitor, "MATCH", content={field: value})
    make_reel(db_session, competitor, "OTHER")

    body = client.get(REELS, params={"search": value}).json()

    assert [item["shortcode"] for item in body["items"]] == ["MATCH"]


@pytest.mark.parametrize("term", ["МАРКЕТИНГ", "маркетинг", "МаРкЕтИнГ"])
def test_search_is_case_insensitive(
    client: TestClient, db_session: Session, competitor: Competitor, term: str
) -> None:
    make_reel(db_session, competitor, "AAA", caption="Разбор Маркетинга")

    assert client.get(REELS, params={"search": term}).json()["total"] == 1


def test_search_escapes_like_wildcards(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "PCT", caption="Скидка 50% сегодня")
    make_reel(db_session, competitor, "PLAIN", caption="Обычный текст")

    # A bare "%" must not behave as "match everything".
    percent = client.get(REELS, params={"search": "%"}).json()
    assert [item["shortcode"] for item in percent["items"]] == ["PCT"]

    underscore = client.get(REELS, params={"search": "_"}).json()
    assert underscore["total"] == 0


def test_blank_search_is_treated_as_no_search(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "AAA")

    assert client.get(REELS, params={"search": "   "}).json()["total"] == 1


def test_search_is_trimmed_before_matching(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "AAA", caption="Маркетинг")

    assert client.get(REELS, params={"search": "  Маркетинг  "}).json()["total"] == 1


def test_search_combines_with_the_competitor_filter(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    other = make_competitor(db_session, "second")
    make_reel(db_session, competitor, "MINE", caption="общая тема")
    make_reel(db_session, other, "THEIRS", caption="общая тема")

    body = client.get(REELS, params={"search": "общая", "competitor_id": competitor.id}).json()

    assert [item["shortcode"] for item in body["items"]] == ["MINE"]


def test_search_without_matches_returns_zero_total(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "AAA", caption="Что-то")

    body = client.get(REELS, params={"search": "ничегонетакого"}).json()

    assert body["total"] == 0
    assert body["pages"] == 0
    assert body["items"] == []


# ------------------------------------------------------------------ details


def test_single_reel_is_returned_with_competitor_and_content(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "ONE", content={"hook": "Хук"})

    body = client.get(f"{REELS}/{reel.id}").json()

    assert body["id"] == reel.id
    assert body["competitor"]["instagramUsername"] == "libowner"
    assert body["content"]["hook"] == "Хук"
    assert body["content"]["contentStatus"] == "new"


def test_unknown_reel_returns_404(client: TestClient) -> None:
    response = client.get(f"{REELS}/999999")

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.REEL_NOT_FOUND.value


def test_missing_content_row_is_healed_on_read(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "LEGACY", with_content=False)
    db_session.expire_all()
    assert db_session.get(Reel, reel.id).content is None

    body = client.get(f"{REELS}/{reel.id}").json()

    assert body["content"]["hook"] == ""
    assert body["content"]["contentStatus"] == "new"

    db_session.expire_all()
    assert db_session.get(Reel, reel.id).content is not None, "content must be persisted"


# ------------------------------------------------------------------- editor


def full_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "hook": "",
        "script": "",
        "cta": "",
        "notes": "",
        "contentStatus": "new",
    }
    payload.update(overrides)
    return payload


def test_editor_saves_every_field(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "EDIT")

    response = client.put(
        f"{REELS}/{reel.id}/content",
        json=full_payload(
            hook="Почему рилсы не летят?",
            script="Строка 1\nСтрока 2",
            cta="Напишите «РАЗБОР»",
            notes="Добавить резкий переход",
            contentStatus="script",
        ),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reelId"] == reel.id
    assert body["hook"] == "Почему рилсы не летят?"
    assert body["script"] == "Строка 1\nСтрока 2"
    assert body["cta"] == "Напишите «РАЗБОР»"
    assert body["notes"] == "Добавить резкий переход"
    assert body["contentStatus"] == "script"
    assert body["updatedAt"] is not None


def test_saved_content_is_visible_on_reload(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "PERSIST")
    client.put(f"{REELS}/{reel.id}/content", json=full_payload(hook="Сохранённый хук"))

    body = client.get(f"{REELS}/{reel.id}").json()

    assert body["content"]["hook"] == "Сохранённый хук"


def test_editor_preserves_line_breaks_and_indentation(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "MULTILINE")
    script = "Первая строка\n\n  Отступ сохранён\nПоследняя"

    body = client.put(f"{REELS}/{reel.id}/content", json=full_payload(script=script)).json()

    assert body["script"] == script


@pytest.mark.parametrize(
    "status",
    ["new", "idea", "script", "ready", "filmed", "editing", "published", "archived"],
)
def test_all_content_statuses_are_accepted(
    client: TestClient, db_session: Session, competitor: Competitor, status: str
) -> None:
    reel = make_reel(db_session, competitor, f"ST{status}")

    response = client.put(f"{REELS}/{reel.id}/content", json=full_payload(contentStatus=status))

    assert response.status_code == 200
    assert response.json()["contentStatus"] == status


def test_unknown_content_status_is_rejected(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "BADST")

    response = client.put(f"{REELS}/{reel.id}/content", json=full_payload(contentStatus="invented"))

    assert response.status_code == 422
    assert error_code(response) == ErrorCode.VALIDATION_ERROR.value


@pytest.mark.parametrize(
    ("field", "limit"),
    [("hook", 500), ("script", 10_000), ("cta", 1_000), ("notes", 10_000)],
)
def test_editor_enforces_length_limits(
    client: TestClient, db_session: Session, competitor: Competitor, field: str, limit: int
) -> None:
    reel = make_reel(db_session, competitor, f"LEN{field}")

    ok = client.put(f"{REELS}/{reel.id}/content", json=full_payload(**{field: "x" * limit}))
    assert ok.status_code == 200

    too_long = client.put(
        f"{REELS}/{reel.id}/content", json=full_payload(**{field: "x" * (limit + 1)})
    )
    assert too_long.status_code == 422
    assert error_code(too_long) == ErrorCode.VALIDATION_ERROR.value


def test_editor_on_unknown_reel_returns_404(client: TestClient) -> None:
    response = client.put(f"{REELS}/999999/content", json=full_payload(hook="x"))

    assert response.status_code == 404
    assert error_code(response) == ErrorCode.REEL_NOT_FOUND.value


def test_editor_does_not_touch_instagram_fields(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "EXT", caption="Оригинал", views_count=42)

    client.put(f"{REELS}/{reel.id}/content", json=full_payload(hook="Хук"))
    db_session.expire_all()

    refreshed = db_session.get(Reel, reel.id)
    assert refreshed is not None
    assert refreshed.caption == "Оригинал"
    assert refreshed.views_count == 42


def test_editor_heals_a_missing_content_row(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "NOCONTENT", with_content=False)

    response = client.put(f"{REELS}/{reel.id}/content", json=full_payload(hook="Новый"))

    assert response.status_code == 200
    assert response.json()["hook"] == "Новый"


def test_user_script_survives_a_reimport(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    """The importer refreshes metrics; the editor content must stay intact."""
    from app.services.reel_importer import ReelImporter
    from app.services.reel_normalizer import NormalizedReel

    reel = make_reel(db_session, competitor, "REIMPORT", views_count=100)
    client.put(
        f"{REELS}/{reel.id}/content",
        json=full_payload(hook="Мой хук", script="Мой сценарий", contentStatus="ready"),
    )

    ReelImporter().import_reels(
        db_session,
        competitor,
        [NormalizedReel(shortcode="REIMPORT", instagram_id="id-REIMPORT", views_count=9999)],
    )
    db_session.commit()

    body = client.get(f"{REELS}/{reel.id}").json()
    assert body["viewsCount"] == 9999, "metrics must refresh"
    assert body["content"]["hook"] == "Мой хук"
    assert body["content"]["script"] == "Мой сценарий"
    assert body["content"]["contentStatus"] == "ready"


def test_take_to_work_moves_reel_from_library_to_my_reels(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(
        db_session,
        competitor,
        "TAKE_TO_WORK",
        content={"content_status": ContentStatus.NEW},
    )

    response = client.post(f"{REELS}/{reel.id}/take-to-work")

    assert response.status_code == 200
    assert response.json()["contentStatus"] == "idea"
    assert client.get(REELS).json()["total"] == 0
    my_reels = client.get(MY_REELS).json()
    assert my_reels["total"] == 1
    assert my_reels["items"][0]["shortcode"] == "TAKE_TO_WORK"
    assert my_reels["items"][0]["content"]["contentStatus"] == "idea"


def test_not_suitable_deletes_reel_and_related_content(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "REJECT")
    reel_id = reel.id

    response = client.delete(f"{REELS}/{reel_id}")

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(Reel, reel_id) is None
    assert client.get(f"{REELS}/{reel_id}").status_code == 404


def test_viral_sort_explains_performance_relative_to_author(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    now = datetime.now(UTC)
    make_reel(
        db_session,
        competitor,
        "USUAL_1",
        views_count=900,
        likes_count=35,
        comments_count=3,
        published_at=now - timedelta(days=30),
    )
    make_reel(
        db_session,
        competitor,
        "USUAL_2",
        views_count=1100,
        likes_count=44,
        comments_count=4,
        published_at=now - timedelta(days=20),
    )
    make_reel(
        db_session,
        competitor,
        "BREAKOUT",
        views_count=5200,
        likes_count=410,
        comments_count=72,
        published_at=now - timedelta(hours=18),
    )

    body = client.get(REELS, params={"sort": "viral", "limit": 1}).json()

    assert body["items"][0]["shortcode"] == "BREAKOUT"
    viral = body["items"][0]["viralScore"]
    assert viral["score"] >= 70
    assert "выше обычных просмотров автора" in viral["primaryReason"]
    assert viral["viewMultiplier"] >= 5


def test_skip_hides_reel_without_deleting_source_data(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    reel = make_reel(db_session, competitor, "SKIP_ME")

    response = client.post(f"{REELS}/{reel.id}/skip")

    assert response.status_code == 200
    assert response.json()["contentStatus"] == "skipped"
    assert client.get(REELS).json()["total"] == 0
    db_session.expire_all()
    assert db_session.get(Reel, reel.id) is not None


def test_adapt_starts_the_complete_background_pipeline(
    client: TestClient,
    db_session: Session,
    competitor: Competitor,
    stub_background_tasks: list[tuple[Any, ...]],
) -> None:
    reel = make_reel(
        db_session,
        competitor,
        "ADAPT_ME",
        video_url="https://cdn.example.com/reel.mp4",
    )

    response = client.post(
        f"{REELS}/{reel.id}/adapt",
        json={
            "niche": "Маркетинг",
            "targetAudience": "Основатели B2B",
            "product": "Консалтинг",
            "toneOfVoice": "Спокойно и конкретно",
            "videoLengthSeconds": 45,
            "addressForm": "вы",
            "profanity": "Без мата",
            "expertise": "Практик",
            "favoriteCtas": ["Сохраните разбор"],
        },
    )

    assert response.status_code == 202
    assert response.json()["contentStatus"] == "idea"
    assert response.json()["transcriptionStatus"] == "queued"
    assert len(stub_background_tasks) == 1
    task, args, _kwargs = stub_background_tasks[0]
    assert task.__name__ == "prepare_reel_task"
    assert args[0] == reel.id
    assert args[2]["target_audience"] == "Основатели B2B"


# ------------------------------------------------------------------- my reels


def test_my_reels_excludes_new_status(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "NEW1", content={"content_status": ContentStatus.NEW})
    make_reel(db_session, competitor, "IDEA1", content={"content_status": ContentStatus.IDEA})
    make_reel(db_session, competitor, "READY1", content={"content_status": ContentStatus.READY})

    codes = {item["shortcode"] for item in client.get(MY_REELS).json()["items"]}

    assert codes == {"IDEA1", "READY1"}


def test_my_reels_can_be_filtered_by_status(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "IDEA1", content={"content_status": ContentStatus.IDEA})
    make_reel(db_session, competitor, "READY1", content={"content_status": ContentStatus.READY})

    body = client.get(MY_REELS, params={"content_status": "idea"}).json()

    assert [item["shortcode"] for item in body["items"]] == ["IDEA1"]


def test_my_reels_supports_search_and_pagination(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(
        db_session,
        competitor,
        "FOUND",
        content={"content_status": ContentStatus.SCRIPT, "hook": "особыйхук"},
    )
    make_reel(db_session, competitor, "OTHER", content={"content_status": ContentStatus.SCRIPT})

    found = client.get(MY_REELS, params={"search": "особыйхук"}).json()
    assert [item["shortcode"] for item in found["items"]] == ["FOUND"]

    paged = client.get(MY_REELS, params={"limit": 1, "page": 1}).json()
    assert len(paged["items"]) == 1
    assert paged["total"] == 2
    assert paged["pages"] == 2


def test_my_reels_is_empty_when_nothing_is_in_progress(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_reel(db_session, competitor, "NEW1")

    assert client.get(MY_REELS).json()["total"] == 0


# ----------------------------------------------------------------- dashboard


def test_dashboard_summary_uses_real_counts(
    client: TestClient, db_session: Session, competitor: Competitor
) -> None:
    make_competitor(db_session, "second")
    make_reel(db_session, competitor, "N1")
    make_reel(db_session, competitor, "I1", content={"content_status": ContentStatus.IDEA})
    make_reel(db_session, competitor, "I2", content={"content_status": ContentStatus.IDEA})
    make_reel(db_session, competitor, "S1", content={"content_status": ContentStatus.SCRIPT})
    make_reel(db_session, competitor, "R1", content={"content_status": ContentStatus.READY})
    db_session.add(ParsingJob(competitor_id=competitor.id, status=ParsingJobStatus.RUNNING))
    db_session.add(ParsingJob(competitor_id=competitor.id, status=ParsingJobStatus.COMPLETED))
    db_session.commit()

    body = client.get(DASHBOARD).json()

    assert body == {
        "competitorsCount": 2,
        "reelsCount": 5,
        "ideasCount": 2,
        "scriptsCount": 1,
        "readyCount": 1,
        "activeJobsCount": 1,
    }


def test_dashboard_summary_is_zero_on_an_empty_database(client: TestClient) -> None:
    body = client.get(DASHBOARD).json()

    assert body == {
        "competitorsCount": 0,
        "reelsCount": 0,
        "ideasCount": 0,
        "scriptsCount": 0,
        "readyCount": 0,
        "activeJobsCount": 0,
    }


# --------------------------------------------------------------------- N+1


def test_listing_does_not_issue_a_query_per_reel(
    client: TestClient, db_session: Session, competitor: Competitor, engine: Any
) -> None:
    """Competitor and content are eager loaded, so query count stays flat."""
    for index in range(10):
        make_reel(db_session, competitor, f"N{index}")

    statements: list[str] = []

    def record(_conn: Any, _cursor: Any, statement: str, *_args: Any) -> None:
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        body = client.get(REELS, params={"limit": 10}).json()
    finally:
        event.remove(engine, "before_cursor_execute", record)

    assert len(body["items"]) == 10
    # One COUNT + one joined SELECT. Allow a small margin, but nothing close to
    # the 1 + 2*10 a naive lazy-loading implementation would produce.
    assert len(statements) <= 4, f"possible N+1: {len(statements)} SELECTs"
