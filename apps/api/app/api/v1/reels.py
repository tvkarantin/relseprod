"""Reels library and script editor endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.models.enums import ContentStatus
from app.models.reel import Reel
from app.schemas.common import ErrorResponse
from app.schemas.reel import ReelPage, ReelView
from app.schemas.reel_content import ReelContentSaved, ReelContentView, ReelContentWrite
from app.schemas.transcription import TranscriptionSummary
from app.services.reel_content import WORKING_STATUSES, ReelContentService, ReelLibraryService

router = APIRouter(prefix="/reels", tags=["reels"])

ReelId = Annotated[int, Path(gt=0, description="Идентификатор рилса")]
PageParam = Annotated[int, Query(ge=1, description="Номер страницы")]
LimitParam = Annotated[int, Query(ge=1, le=100, description="Размер страницы")]
SearchParam = Annotated[
    str | None, Query(max_length=200, description="Поиск по тексту и автору")
]
CompetitorIdParam = Annotated[
    int | None, Query(gt=0, description="Фильтр по конкуренту")
]

MY_REELS_STATUSES = ", ".join(status.value for status in WORKING_STATUSES)


def _to_view(reel: Reel) -> ReelView:
    """Build the API representation of a reel.

    The content row is always present in the payload: reels without one are
    rendered with empty strings so the editor has a stable shape.
    """
    content = reel.content
    t = reel.transcription
    transcription_summary = (
        TranscriptionSummary(
            id=t.id,
            status=t.status,
            dominant_language=t.dominant_language,
            error_code=t.error_code,
            error_message=t.error_message,
            updated_at=t.updated_at,
        )
        if t
        else None
    )
    return ReelView(
        id=reel.id,
        competitor=reel.competitor,  # type: ignore[arg-type]
        instagram_id=reel.instagram_id,
        shortcode=reel.shortcode,
        original_url=reel.original_url,
        video_url=reel.video_url,
        thumbnail_url=reel.thumbnail_url,
        caption=reel.caption,
        views_count=reel.views_count,
        likes_count=reel.likes_count,
        comments_count=reel.comments_count,
        published_at=reel.published_at,
        duration=reel.duration,
        content=ReelContentView(
            hook=content.hook or "" if content else "",
            script=content.script or "" if content else "",
            cta=content.cta or "" if content else "",
            notes=content.notes or "" if content else "",
            content_status=content.content_status if content else ContentStatus.NEW,
            created_at=content.created_at if content else None,
            updated_at=content.updated_at if content else None,
        ),
        transcription=transcription_summary,
    )


@router.get(
    "",
    response_model=ReelPage,
    summary="Библиотека импортированных рилсов",
)
def list_reels(
    db: Annotated[Session, Depends(DbSession)],
    competitor_id: CompetitorIdParam = None,
    search: SearchParam = None,
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> ReelPage:
    """Return one page of the library.

    Order is fixed (newest published first); there is no ``sort`` parameter.
    """
    items, total, pages = ReelLibraryService(db).list_reels(
        competitor_id=competitor_id, search=search, page=page, limit=limit
    )
    return ReelPage(
        items=[_to_view(reel) for reel in items],
        page=page,
        limit=limit,
        total=total,
        pages=pages,
    )


@router.get(
    "/my",
    response_model=ReelPage,
    summary="Рилсы, с которыми работает пользователь",
)
def list_my_reels(
    db: Annotated[Session, Depends(DbSession)],
    content_status: Annotated[
        ContentStatus | None, Query(description=f"Один из статусов: {MY_REELS_STATUSES}")
    ] = None,
    search: SearchParam = None,
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> ReelPage:
    """Return reels whose content status is anything but ``new``."""
    items, total, pages = ReelLibraryService(db).list_my_reels(
        content_status=content_status, search=search, page=page, limit=limit
    )
    return ReelPage(
        items=[_to_view(reel) for reel in items],
        page=page,
        limit=limit,
        total=total,
        pages=pages,
    )


@router.get(
    "/{reel_id}",
    response_model=ReelView,
    summary="Получить рилс",
    responses={404: {"model": ErrorResponse, "description": "Рилс не найден"}},
)
def get_reel(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
) -> ReelView:
    """Return one reel with its competitor and editor content."""
    return _to_view(ReelLibraryService(db).get_reel(reel_id))


@router.put(
    "/{reel_id}/content",
    response_model=ReelContentSaved,
    summary="Сохранить сценарий рилса",
    responses={
        404: {"model": ErrorResponse, "description": "Рилс не найден"},
        422: {"model": ErrorResponse, "description": "Ошибка валидации"},
    },
)
def save_reel_content(
    reel_id: ReelId,
    payload: ReelContentWrite,
    db: Annotated[Session, Depends(DbSession)],
) -> ReelContentSaved:
    """Persist the editor payload for a reel."""
    content = ReelContentService(db).save_content(reel_id, payload)
    return ReelContentSaved(
        reel_id=reel_id,
        hook=content.hook or "",
        script=content.script or "",
        cta=content.cta or "",
        notes=content.notes or "",
        content_status=content.content_status,
        updated_at=content.updated_at,
    )
