import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { fetchReel, saveReelContent } from '@/api/reels'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { ReelContentEditor, type ReelContentEditorHandle } from '@/components/forms/ReelContentEditor'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReelPlayer } from '@/components/reels/ReelPlayer'
import { ReelTranscriptionControls } from '@/components/reels/ReelTranscriptionControls'
import { ReelAnalysisControls } from '@/components/reels/ReelAnalysisControls'
import type { ReelContentFormValues } from '@/schemas/reelContent'
import type { Reel } from '@/types/reel'
import { formatDateTime, formatDuration, formatNumber, truncate } from '@/utils/format'

export function ReelDetailsPage() {
  const params = useParams()
  const reelId = Number(params.reelId)
  const queryClient = useQueryClient()
  const editorRef = useRef<ReelContentEditorHandle>(null)

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
  const title = reel.caption ? truncate(reel.caption, 60) : `Рилс @${reel.competitor.instagramUsername}`

  return (
    <div className="page-content">
      <PageHeader
        title={title}
        description={`@${reel.competitor.instagramUsername}`}
        actions={
          <>
            <Link to="/reels" className="button">
              ← К библиотеке
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
          </>
        }
      />

      <div className="reel-details">
        <div>
          <div className="surface reel-media">
            <ReelPlayer
              videoUrl={reel.videoUrl}
              thumbnailUrl={reel.thumbnailUrl}
              title={title}
            />
          </div>

          <div className="surface reel-meta" style={{ marginTop: 14 }}>
            <div className="meta-row">
              <span>Автор</span>
              <strong>
                <a href={reel.competitor.profileUrl} target="_blank" rel="noopener noreferrer">
                  @{reel.competitor.instagramUsername}
                </a>
              </strong>
            </div>
            <div className="meta-row">
              <span>Опубликован</span>
              <strong>{formatDateTime(reel.publishedAt)}</strong>
            </div>
            <div className="meta-row">
              <span>Просмотры</span>
              <strong>{formatNumber(reel.viewsCount)}</strong>
            </div>
            <div className="meta-row">
              <span>Лайки</span>
              <strong>{formatNumber(reel.likesCount)}</strong>
            </div>
            <div className="meta-row">
              <span>Комментарии</span>
              <strong>{formatNumber(reel.commentsCount)}</strong>
            </div>
            <div className="meta-row">
              <span>Длительность</span>
              <strong>{formatDuration(reel.duration)}</strong>
            </div>

            {reel.caption ? (
              <div className="reel-caption-block">{reel.caption}</div>
            ) : null}
          </div>
        </div>

        <div>
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
          />
          {/* Remounting on reelId resets the editor when navigating between reels. */}
          <ReelContentEditor
            ref={editorRef}
            key={reel.id}
            reelId={reel.id}
            content={reel.content}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  )
}
