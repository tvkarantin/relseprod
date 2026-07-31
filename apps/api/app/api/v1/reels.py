"""Reels library and script editor endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.models.enums import ContentStatus
from app.models.reel import Reel
from app.repositories.reels import ReelSort
from app.schemas.analysis import ReelAnalysisSummary
from app.schemas.common import ErrorResponse
from app.schemas.reel import ReelPage, ReelView
from app.schemas.reel_content import ReelContentSaved, ReelContentView, ReelContentWrite
from app.schemas.transcription import TranscriptionSummary
from app.services.reel_content import WORKING_STATUSES, ReelContentService, ReelLibraryService
from app.services.reel_media import ReelThumbnailFetchError, fetch_reel_thumbnail

router = APIRouter(prefix="/reels", tags=["reels"])

ReelId = Annotated[int, Path(gt=0, description="Идентификатор рилса")]
PageParam = Annotated[int, Query(ge=1, description="Номер страницы")]
LimitParam = Annotated[int, Query(ge=1, le=100, description="Размер страницы")]
SearchParam = Annotated[str | None, Query(max_length=200, description="Поиск по тексту и автору")]
CompetitorIdParam = Annotated[int | None, Query(gt=0, description="Фильтр по конкуренту")]
SortParam = Annotated[ReelSort, Query(description="Сортировка библиотеки")]

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
    a = reel.analysis
    analysis_summary = (
        ReelAnalysisSummary(
            id=a.id,
            status=a.status,
            topic=a.topic,
            error_code=a.error_code,
            updated_at=a.updated_at,
        )
        if a
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
        analysis=analysis_summary,
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
    sort: SortParam = "date",
    page: PageParam = 1,
    limit: LimitParam = 20,
) -> ReelPage:
    """Return one page of the library.

    Popularity sorting is global across every matching competitor and is
    applied before pagination.
    """
    items, total, pages = ReelLibraryService(db).list_reels(
        competitor_id=competitor_id,
        search=search,
        sort=sort,
        page=page,
        limit=limit,
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
    "/{reel_id}/thumbnail",
    response_class=Response,
    summary="Получить превью рилса",
    responses={404: {"description": "Превью недоступно"}},
)
def get_reel_thumbnail(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
) -> Response:
    """Proxy an Instagram thumbnail so browser hotlink protection cannot hide it."""
    reel = ReelLibraryService(db).get_reel(reel_id)
    if not reel.thumbnail_url:
        raise HTTPException(status_code=404, detail="Превью рилса недоступно")

    try:
        thumbnail = fetch_reel_thumbnail(reel.thumbnail_url)
    except ReelThumbnailFetchError as exc:
        raise HTTPException(status_code=404, detail="Превью рилса недоступно") from exc

    return Response(
        content=thumbnail.content,
        media_type=thumbnail.media_type,
        headers={"Cache-Control": "private, max-age=3600"},
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


@router.post(
    "/{reel_id}/take-to-work",
    response_model=ReelContentSaved,
    summary="Взять рилс в работу",
    responses={404: {"model": ErrorResponse, "description": "Рилс не найден"}},
)
def take_reel_to_work(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
) -> ReelContentSaved:
    """Move a library reel into “My reels” with the initial working status."""
    content = ReelLibraryService(db).take_to_work(reel_id)
    return ReelContentSaved(
        reel_id=reel_id,
        hook=content.hook or "",
        script=content.script or "",
        cta=content.cta or "",
        notes=content.notes or "",
        content_status=content.content_status,
        updated_at=content.updated_at,
    )


@router.delete(
    "/{reel_id}",
    status_code=204,
    summary="Удалить неподошедший рилс",
    responses={404: {"model": ErrorResponse, "description": "Рилс не найден"}},
)
def delete_reel(
    reel_id: ReelId,
    db: Annotated[Session, Depends(DbSession)],
) -> Response:
    """Delete a rejected reel from the library without an extra dialog."""
    ReelLibraryService(db).delete_reel(reel_id)
    return Response(status_code=204)


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
