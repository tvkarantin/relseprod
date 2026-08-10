import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import {
  deleteReel,
  fetchReel,
  getReelThumbnailUrl,
  saveReelContent,
  takeReelToWork,
} from '@/api/reels'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/toastContext'
import { ReelContentEditor, type ReelContentEditorHandle } from '@/components/forms/ReelContentEditor'
import { ReelPlayer } from '@/components/reels/ReelPlayer'
import { ReelTranscriptionControls } from '@/components/reels/ReelTranscriptionControls'
import { ReelAnalysisControls } from '@/components/reels/ReelAnalysisControls'
import type { ReelContentFormValues } from '@/schemas/reelContent'
import { CONTENT_STATUS_LABELS, type Reel } from '@/types/reel'
import { getErrorMessage } from '@/utils/errors'
import { formatDateTime, formatDuration, formatNumber, truncate } from '@/utils/format'
import { useReelAnalysisPolling } from '@/hooks/useReelAnalysisPolling'
import { useTranscriptionPolling } from '@/hooks/useTranscriptionPolling'

function AutomaticPreparationStatus({ reelId }: { reelId: number }) {
  const transcription = useTranscriptionPolling(reelId, { waitForCreation: true }).transcription
  const analysis = useReelAnalysisPolling(reelId, { waitForCreation: true }).analysis

  const transcriptionDone = transcription?.status === 'completed'
  const analysisDone = analysis?.status === 'completed'
  const failed = transcription?.status === 'failed' || analysis?.status === 'failed'

  return (
    <section className={`automatic-preparation ${analysisDone ? 'is-complete' : ''} ${failed ? 'is-failed' : ''}`} aria-live="polite">
      <div className="automatic-preparation-head">
        <div>
          <span className="eyebrow">Автоматическая подготовка</span>
          <h2>{analysisDone ? 'Первая версия сценария готова' : failed ? 'Подготовка остановилась' : 'AI адаптирует ролик под ваш стиль'}</h2>
        </div>
        {!analysisDone && !failed ? <span className="preparation-pulse" aria-hidden="true" /> : null}
      </div>
      <ol className="preparation-steps">
        <li className={transcriptionDone ? 'done' : transcription?.status === 'failed' ? 'failed' : 'active'}>
          <i /> <span>Расшифровка речи</span>
        </li>
        <li className={analysisDone ? 'done' : transcriptionDone ? 'active' : ''}>
          <i /> <span>Перевод и структура</span>
        </li>
        <li className={analysisDone ? 'done' : analysis?.status === 'processing' ? 'active' : ''}>
          <i /> <span>Адаптация под профиль</span>
        </li>
      </ol>
      {failed ? <p>{transcription?.errorMessage || analysis?.errorMessage || 'Не удалось подготовить сценарий. Попробуйте снова из ленты идей.'}</p> : null}
    </section>
  )
}

export function ReelDetailsPage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const reelId = Number(params.reelId)
  const queryClient = useQueryClient()
  const editorRef = useRef<ReelContentEditorHandle>(null)
  const navigate = useNavigate()
  const toast = useToast()

  const reelQuery = useQuery({
    queryKey: queryKeys.reels.details(reelId),
    queryFn: ({ signal }) => fetchReel(reelId, signal),
    enabled: Number.isFinite(reelId) && reelId > 0,
    // Refetching while the user types would fight the editor state.
    refetchOnWindowFocus: false,
  })

  const saveMutation = useMutation({
    mutationFn: (values: ReelContentFormValues) => saveReelContent(reelId, values),
    onSuccess: (saved) => {
      // Patch the cache in place so the editor keeps its state, then refresh
      // the lists that show the content status.
      queryClient.setQueryData<Reel>(queryKeys.reels.details(reelId), (current) =>
        current
          ? {
              ...current,
              content: {
                ...current.content,
                hook: saved.hook,
                script: saved.script,
                cta: saved.cta,
                notes: saved.notes,
                contentStatus: saved.contentStatus,
                updatedAt: saved.updatedAt,
              },
            }
          : current,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.list({}), exact: false })
      void queryClient.invalidateQueries({ queryKey: ['reels', 'my'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
    },
  })

  const takeToWorkMutation = useMutation({
    mutationFn: () => takeReelToWork(reelId),
    onSuccess: () => {
      toast.success('Рилс перенесён в «Мои рилсы»')
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      navigate('/my-reels?content_status=idea')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rejectMutation = useMutation({
    mutationFn: () => deleteReel(reelId),
    onSuccess: () => {
      toast.info('Рилс удалён из библиотеки')
      queryClient.removeQueries({ queryKey: queryKeys.reels.details(reelId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      navigate('/ideas')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const handleSave = useCallback(
    async (values: ReelContentFormValues) => {
      await saveMutation.mutateAsync(values)
    },
    [saveMutation],
  )

  const handleApplyScript = useCallback((transcript: string) => {
    editorRef.current?.setScript(transcript)
  }, [])

  const handleGetCurrentScript = useCallback(() => {
    return editorRef.current?.getScript() ?? ''
  }, [])

  const handleApplyAnalysis = useCallback((hook: string, script: string, cta: string) => {
    editorRef.current?.setHook(hook)
    editorRef.current?.setScript(script)
    editorRef.current?.setCta(cta)
  }, [])

  const handleGetCurrentValues = useCallback(() => {
    return {
      hook: editorRef.current?.getHook() ?? '',
      script: editorRef.current?.getScript() ?? '',
      cta: editorRef.current?.getCta() ?? ''
    }
  }, [])

  if (!Number.isFinite(reelId) || reelId <= 0) {
    return (
      <div className="page-content">
        <ErrorState error={new Error('Некорректный идентификатор рилса')} />
      </div>
    )
  }

  if (reelQuery.isLoading) {
    return (
      <div className="page-content">
        <LoadingState label="Загружаем рилс…" />
      </div>
    )
  }

  if (reelQuery.isError || !reelQuery.data) {
    return (
      <div className="page-content">
        <ErrorState error={reelQuery.error} onRetry={() => void reelQuery.refetch()} />
      </div>
    )
  }

  const reel = reelQuery.data
  const isAutomaticPreparation = searchParams.get('preparing') === '1'
  const title = reel.caption ? truncate(reel.caption, 60) : `Рилс @${reel.competitor.instagramUsername}`

  return (
    <div className="page-content reel-details-page">
      <header className="reel-detail-header">
        <div className="reel-detail-title">
          <h1>{title}</h1>
          <p>@{reel.competitor.instagramUsername}</p>
        </div>
        <div className="reel-detail-actions">
            {reel.content.contentStatus === 'new' ? (
              <div className="reel-detail-decisions" aria-label="Решение по рилсу">
                <button
                  type="button"
                  className="button button-lime reel-decision-take"
                  disabled={takeToWorkMutation.isPending || rejectMutation.isPending}
                  onClick={() => takeToWorkMutation.mutate()}
                >
                  {takeToWorkMutation.isPending ? 'Переносим…' : 'Взять в работу'}
                </button>
                <button
                  type="button"
                  className="button button-danger reel-decision-reject"
                  disabled={takeToWorkMutation.isPending || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                >
                  {rejectMutation.isPending ? 'Удаляем…' : 'Не подошёл'}
                </button>
              </div>
            ) : (
              <span
                className={`content-badge reel-detail-status content-${reel.content.contentStatus}`}
              >
                {CONTENT_STATUS_LABELS[reel.content.contentStatus]}
              </span>
            )}
            <Link to="/ideas" className="button">
              ← К идеям
            </Link>
            {reel.originalUrl ? (
              <a
                href={reel.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button"
              >
                Открыть в Instagram ↗
              </a>
            ) : null}
        </div>
      </header>

      <div className="reel-details">
        <aside className="reel-detail-media-column">
          <div className="surface reel-media reel-detail-player">
            <ReelPlayer
              videoUrl={reel.videoUrl}
              thumbnailUrl={reel.thumbnailUrl ? getReelThumbnailUrl(reel.id) : null}
              title={title}
            />
          </div>

          <div className="sr-only" aria-label="Данные рилса">
            <span>{formatDateTime(reel.publishedAt)}</span>
            <span>{formatNumber(reel.viewsCount)}</span>
            <span>{formatNumber(reel.likesCount)}</span>
            <span>{formatNumber(reel.commentsCount)}</span>
            <span>{formatDuration(reel.duration)}</span>
          </div>
        </aside>

        <section className="reel-detail-workflow" aria-label="Обработка и сценарий">
          {isAutomaticPreparation ? (
            <AutomaticPreparationStatus reelId={reel.id} />
          ) : (
            <>
              <ReelTranscriptionControls
                reelId={reel.id}
                videoUrl={reel.videoUrl}
                initialTranscription={reel.transcription}
                onApplyScript={handleApplyScript}
                getCurrentScript={handleGetCurrentScript}
              />
              <ReelAnalysisControls
                reelId={reel.id}
                transcription={reel.transcription}
                onApplyScript={handleApplyAnalysis}
                getCurrentValues={handleGetCurrentValues}
                initialValues={{
                  hook: reel.content.hook,
                  script: reel.content.script,
                  cta: reel.content.cta,
                }}
              />
            </>
          )}
          {/* Remounting on reelId resets the editor when navigating between reels. */}
          <ReelContentEditor
            ref={editorRef}
            key={reel.id}
            reelId={reel.id}
            content={reel.content}
            onSave={handleSave}
          />
        </section>
      </div>
    </div>
  )
}
