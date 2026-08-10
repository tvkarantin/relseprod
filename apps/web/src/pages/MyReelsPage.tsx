import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Download,
  Eye,
  GripVertical,
  MoveRight,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'

import { getReelThumbnailUrl, fetchAllMyReels, saveReelContent } from '@/api/reels'
import { queryKeys } from '@/api/queryKeys'
import { ErrorState } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/toastContext'
import { ReelThumbnail } from '@/components/reels/ReelThumbnail'
import type { ContentStatus, Reel } from '@/types/reel'
import { buildContentPlanCsv } from '@/utils/contentPlan'
import { formatCompactNumber, formatDate, truncate } from '@/utils/format'

type BoardStatus = 'idea' | 'script' | 'filmed' | 'editing' | 'published'

interface BoardColumn {
  status: BoardStatus
  title: string
  description: string
}

interface MoveReelInput {
  reel: Reel
  status: BoardStatus
}

const BOARD_COLUMNS: readonly BoardColumn[] = [
  { status: 'idea', title: 'Доработка', description: 'Нужно довести сценарий' },
  { status: 'script', title: 'Готово', description: 'Можно ставить камеру' },
  { status: 'filmed', title: 'Снято', description: 'Материал уже записан' },
  { status: 'editing', title: 'В монтаже', description: 'Ролик собирается' },
  { status: 'published', title: 'Выложено', description: 'Опубликовано и настроено' },
]

const COLUMN_BY_STATUS = new Map(BOARD_COLUMNS.map((column) => [column.status, column]))

function toBoardStatus(status: ContentStatus): BoardStatus | null {
  if (status === 'ready') return 'script'
  if (status === 'archived') return 'published'
  return COLUMN_BY_STATUS.has(status as BoardStatus) ? (status as BoardStatus) : null
}

function reelTitle(reel: Reel): string {
  return reel.content.hook || reel.caption || `Рилс #${reel.id}`
}

function downloadContentPlan(reels: Reel[]): void {
  const csv = `\uFEFF${buildContentPlanCsv(reels)}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `reels-content-plan-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ContentPlanSkeleton() {
  return (
    <div className="content-plan-board is-loading" aria-label="Загрузка контент-плана">
      {BOARD_COLUMNS.map((column) => (
        <section className="content-plan-column" key={column.status}>
          <div className="content-plan-column-head">
            <span className="skeleton-line skeleton-title" />
            <span className="skeleton-line skeleton-copy" />
          </div>
          <div className="content-plan-column-body">
            <div className="content-plan-card-skeleton" />
            <div className="content-plan-card-skeleton is-short" />
          </div>
        </section>
      ))}
    </div>
  )
}

interface ContentPlanCardProps {
  reel: Reel
  stage: BoardStatus
  isMoving: boolean
  onDragStart: (event: DragEvent<HTMLElement>, reelId: number) => void
  onDragEnd: () => void
  onMove: (reel: Reel, status: BoardStatus) => void
}

function ContentPlanCard({
  reel,
  stage,
  isMoving,
  onDragStart,
  onDragEnd,
  onMove,
}: ContentPlanCardProps) {
  const title = reelTitle(reel)
  const scriptPreview = reel.content.script || reel.caption || 'Добавьте детали сценария'

  return (
    <article
      className={`content-plan-card${isMoving ? ' is-moving' : ''}`}
      draggable={!isMoving}
      onDragStart={(event) => onDragStart(event, reel.id)}
      onDragEnd={onDragEnd}
      aria-label={`Карточка: ${title}`}
    >
      <div className="content-plan-card-media">
        <Link to={`/reels/${reel.id}`} aria-label={`Открыть рилс: ${title}`}>
          <ReelThumbnail
            src={reel.thumbnailUrl ? getReelThumbnailUrl(reel.id) : null}
            videoSrc={reel.videoUrl}
            alt={title}
          />
        </Link>
        <span className="content-plan-drag-handle" aria-hidden="true">
          <GripVertical size={15} />
        </span>
      </div>

      <div className="content-plan-card-copy">
        <Link to={`/reels/${reel.id}`} className="content-plan-card-title">
          {truncate(title, 72)}
        </Link>
        <p>{truncate(scriptPreview, 96)}</p>
      </div>

      <div className="content-plan-card-meta">
        <span>@{reel.competitor.instagramUsername}</span>
        <span title="Просмотры"><Eye size={12} /> {formatCompactNumber(reel.viewsCount)}</span>
        <span>{formatDate(reel.publishedAt)}</span>
      </div>

      <label className="content-plan-stage-select">
        <span className="visually-hidden">Переместить «{title}» на этап</span>
        <MoveRight size={13} aria-hidden="true" />
        <select
          value={stage}
          disabled={isMoving}
          onChange={(event) => onMove(reel, event.target.value as BoardStatus)}
        >
          {BOARD_COLUMNS.map((column) => (
            <option value={column.status} key={column.status}>
              {column.title}
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}

export function MyReelsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [draggedReelId, setDraggedReelId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<BoardStatus | null>(null)

  const reelsQuery = useQuery({
    queryKey: queryKeys.reels.contentPlan(),
    queryFn: ({ signal }) => fetchAllMyReels(signal),
  })

  const moveReel = useMutation({
    mutationFn: ({ reel, status }: MoveReelInput) =>
      saveReelContent(reel.id, {
        hook: reel.content.hook,
        script: reel.content.script,
        cta: reel.content.cta,
        notes: reel.content.notes,
        contentStatus: status,
      }),
    onMutate: async ({ reel, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.reels.contentPlan() })
      const previous = queryClient.getQueryData<Reel[]>(queryKeys.reels.contentPlan())
      queryClient.setQueryData<Reel[]>(
        queryKeys.reels.contentPlan(),
        (items = []) =>
          items.map((item) =>
            item.id === reel.id
              ? { ...item, content: { ...item.content, contentStatus: status } }
              : item,
          ),
      )
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.reels.contentPlan(), context.previous)
      }
      toast.error(error instanceof Error ? error.message : 'Не удалось переместить рилс')
    },
    onSuccess: (saved, { reel, status }) => {
      queryClient.setQueryData<Reel[]>(
        queryKeys.reels.contentPlan(),
        (items = []) =>
          items.map((item) =>
            item.id === reel.id
              ? {
                  ...item,
                  content: {
                    ...item.content,
                    contentStatus: saved.contentStatus,
                    updatedAt: saved.updatedAt,
                  },
                }
              : item,
          ),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reel.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      toast.success(`Рилс перемещён: ${COLUMN_BY_STATUS.get(status)?.title}`)
    },
  })

  const reels = useMemo(() => reelsQuery.data ?? [], [reelsQuery.data])
  const reelsByColumn = useMemo(() => {
    const result = new Map<BoardStatus, Reel[]>(
      BOARD_COLUMNS.map((column) => [column.status, []]),
    )
    for (const reel of reels) {
      const status = toBoardStatus(reel.content.contentStatus)
      if (status) result.get(status)?.push(reel)
    }
    return result
  }, [reels])

  const requestMove = (reel: Reel, status: BoardStatus) => {
    if (toBoardStatus(reel.content.contentStatus) === status) return
    moveReel.mutate({ reel, status })
  }

  const handleDragStart = (event: DragEvent<HTMLElement>, reelId: number) => {
    setDraggedReelId(reelId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(reelId))
  }

  const handleDragEnd = () => {
    setDraggedReelId(null)
    setDropTarget(null)
  }

  const handleDrop = (event: DragEvent<HTMLElement>, status: BoardStatus) => {
    event.preventDefault()
    const transferredId = Number(event.dataTransfer.getData('text/plain'))
    const reelId = draggedReelId ?? (Number.isFinite(transferredId) ? transferredId : null)
    const reel = reels.find((item) => item.id === reelId)
    if (reel) requestMove(reel, status)
    handleDragEnd()
  }

  return (
    <div className="page-content content-plan-page">
      <header className="content-plan-header">
        <div className="content-plan-heading">
          <span className="content-plan-eyebrow">Мои рилсы · производство</span>
          <h1>Контент-план</h1>
          <p>Весь путь рилса — от доработки сценария до публикации.</p>
          <span className="content-plan-hint">
            <GripVertical size={13} aria-hidden="true" />
            Перетаскивайте карточки между этапами или меняйте статус внутри карточки
          </span>
        </div>
        <div className="content-plan-actions">
          <Link className="button button-lime" to="/reels">
            <Sparkles size={15} aria-hidden="true" />
            Разобрать идеи
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <button
            className="button content-plan-export"
            type="button"
            disabled={reels.length === 0}
            onClick={() => downloadContentPlan(reels)}
          >
            <Download size={15} aria-hidden="true" />
            Экспорт CSV
          </button>
        </div>
      </header>

      {reelsQuery.isLoading ? (
        <ContentPlanSkeleton />
      ) : reelsQuery.isError ? (
        <ErrorState error={reelsQuery.error} onRetry={() => void reelsQuery.refetch()} />
      ) : (
        <div className="content-plan-board-wrap">
          <div className="content-plan-board" aria-label="Этапы контент-плана">
            {BOARD_COLUMNS.map((column) => {
              const columnReels = reelsByColumn.get(column.status) ?? []
              const isDropTarget = dropTarget === column.status
              return (
                <section
                  className={`content-plan-column${isDropTarget ? ' is-drop-target' : ''}`}
                  key={column.status}
                  aria-label={`Этап «${column.title}»`}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDropTarget(column.status)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDropTarget(null)
                    }
                  }}
                  onDrop={(event) => handleDrop(event, column.status)}
                >
                  <div className="content-plan-column-head">
                    <div>
                      <h2>{column.title}</h2>
                      <span className="content-plan-count">{columnReels.length}</span>
                    </div>
                    <p>{column.description}</p>
                  </div>

                  <div className="content-plan-column-body">
                    {columnReels.length === 0 ? (
                      <div className="content-plan-empty">
                        <span aria-hidden="true">+</span>
                        <p>Перетащите рилс сюда</p>
                      </div>
                    ) : (
                      columnReels.map((reel) => (
                        <ContentPlanCard
                          key={reel.id}
                          reel={reel}
                          stage={column.status}
                          isMoving={moveReel.isPending && moveReel.variables?.reel.id === reel.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onMove={requestMove}
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {!reelsQuery.isLoading && !reelsQuery.isError && reels.length === 0 ? (
        <div className="content-plan-first-step">
          <div>
            <strong>Контент-план пока пуст</strong>
            <span>Возьмите первый референс из библиотеки — он появится в «Доработке».</span>
          </div>
          <Link to="/reels" className="button">
            Открыть библиотеку <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  )
}
