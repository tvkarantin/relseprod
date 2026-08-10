import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { adaptReel, fetchReels, getReelThumbnailUrl, skipReel } from '@/api/reels'
import { queryKeys } from '@/api/queryKeys'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/toastContext'
import { CreatorProfileDialog } from '@/components/profile/CreatorProfileDialog'
import { ReelPlayer } from '@/components/reels/ReelPlayer'
import type { CreatorProfile } from '@/types/creatorProfile'
import { isCreatorProfileReady, loadCreatorProfile } from '@/types/creatorProfile'
import { getErrorMessage } from '@/utils/errors'
import { formatCompactNumber, formatDate, formatDuration, truncate } from '@/utils/format'

const FEED_QUERY = { sort: 'viral' as const, page: 1, limit: 1 }

export function IdeaFeedPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [isProfileOpen, setProfileOpen] = useState(false)
  const [adaptAfterProfile, setAdaptAfterProfile] = useState(false)

  const feedQuery = useQuery({
    queryKey: queryKeys.reels.list(FEED_QUERY),
    queryFn: ({ signal }) => fetchReels(FEED_QUERY, signal),
  })
  const reel = feedQuery.data?.items[0]

  const moveToNext = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
    await feedQuery.refetch()
  }

  const skipMutation = useMutation({
    mutationFn: () => skipReel(reel!.id),
    onSuccess: async () => {
      toast.info('Поняли — такое больше не показываем')
      await moveToNext()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const adaptMutation = useMutation({
    mutationFn: (profile: CreatorProfile) => adaptReel(reel!.id, profile),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
      toast.success('AI уже готовит первую версию сценария')
      navigate(`/reels/${result.reelId}?preparing=1`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const handleAdapt = () => {
    const profile = loadCreatorProfile()
    if (!isCreatorProfileReady(profile)) {
      setAdaptAfterProfile(true)
      setProfileOpen(true)
      return
    }
    adaptMutation.mutate(profile)
  }

  const handleProfileSaved = (profile: CreatorProfile) => {
    if (!adaptAfterProfile) return
    setAdaptAfterProfile(false)
    adaptMutation.mutate(profile)
  }

  if (feedQuery.isLoading) {
    return <div className="page-content idea-feed-state"><LoadingState label="Ищем сильную идею…" /></div>
  }

  if (feedQuery.isError) {
    return <div className="page-content idea-feed-state"><ErrorState error={feedQuery.error} onRetry={() => void feedQuery.refetch()} /></div>
  }

  if (!reel) {
    return (
      <div className="page-content idea-feed-empty">
        <span className="eyebrow">Лента разобрана</span>
        <h1>Новых сильных идей пока нет</h1>
        <p>Добавьте конкурента или обновите мониторинг — мы оценим новые ролики и покажем лучшие первыми.</p>
        <div className="idea-feed-empty-actions">
          <Link className="button button-lime" to="/library?import=competitor">Добавить источник</Link>
          <Link className="button" to="/my-reels">Открыть мои сценарии</Link>
        </div>
      </div>
    )
  }

  const score = reel.viralScore
  const isActing = skipMutation.isPending || adaptMutation.isPending
  const title = truncate(reel.caption || `Рилс @${reel.competitor.instagramUsername}`, 150)

  return (
    <div className="page-content idea-feed-page">
      <header className="idea-feed-header">
        <div>
          <span className="eyebrow">AI-отбор · лучший следующий ролик</span>
          <h1>Одна идея. Одно решение.</h1>
        </div>
        <div className="idea-feed-progress">
          <strong>{feedQuery.data?.total ?? 0}</strong>
          <span>идей осталось</span>
        </div>
      </header>

      <article className={`idea-focus ${isActing ? 'is-acting' : ''}`}>
        <div className="idea-focus-media">
          <ReelPlayer
            videoUrl={reel.videoUrl}
            thumbnailUrl={reel.thumbnailUrl ? getReelThumbnailUrl(reel.id) : null}
            title={title}
          />
          <span className="idea-duration">{formatDuration(reel.duration)}</span>
        </div>

        <div className="idea-focus-content">
          <div className="idea-author-line">
            <span>@{reel.competitor.instagramUsername}</span>
            <span>{formatDate(reel.publishedAt)}</span>
          </div>

          <div className="viral-verdict">
            <div className="viral-score" aria-label={`Viral score ${score?.score ?? 0} из 100`}>
              <strong>{score?.score ?? '—'}</strong>
              <span>/100</span>
            </div>
            <div>
              <span className="viral-label">{score?.label ?? 'AI-оценка'}</span>
              <h2>{score?.primaryReason ?? 'Ролик заметно выделяется среди контента автора'}</h2>
            </div>
          </div>

          <p className="idea-caption">{title}</p>

          <div className="idea-metrics" aria-label="Метрики ролика">
            <span><strong>{formatCompactNumber(reel.viewsCount)}</strong> просмотров</span>
            <span><strong>{formatCompactNumber(reel.likesCount)}</strong> лайков</span>
            <span><strong>{formatCompactNumber(reel.commentsCount)}</strong> комментариев</span>
          </div>

          {score?.reasons && score.reasons.length > 1 ? (
            <ul className="viral-reasons">
              {score.reasons.slice(1).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}

          <div className="idea-decision-copy">
            <strong>Подходит вашему контенту?</strong>
            <span>После выбора AI сам расшифрует, переведёт и соберёт сценарий.</span>
          </div>

          <div className="idea-decisions">
            <button
              type="button"
              className="idea-skip"
              onClick={() => skipMutation.mutate()}
              disabled={isActing}
            >
              {skipMutation.isPending ? 'Пропускаем…' : 'Не интересно'}
              <kbd>←</kbd>
            </button>
            <button
              type="button"
              className="idea-adapt"
              onClick={handleAdapt}
              disabled={isActing}
            >
              <span>{adaptMutation.isPending ? 'Запускаем AI…' : 'Сделать под меня'}</span>
              <small>транскрипт → перевод → сценарий</small>
            </button>
          </div>

          <button type="button" className="profile-inline-link" onClick={() => setProfileOpen(true)}>
            Настроить мой стиль
          </button>
        </div>
      </article>

      {isProfileOpen ? (
        <CreatorProfileDialog
          onClose={() => { setProfileOpen(false); setAdaptAfterProfile(false) }}
          onSaved={handleProfileSaved}
        />
      ) : null}
    </div>
  )
}
