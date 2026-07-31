import { Link } from 'react-router-dom'

import { ReelThumbnail } from './ReelThumbnail'

import { getReelThumbnailUrl } from '@/api/reels'
import { CONTENT_STATUS_LABELS, type Reel } from '@/types/reel'
import { formatCompactNumber, formatDate, formatDuration, truncate } from '@/utils/format'

type Category = 'ai' | 'growth' | 'editing' | 'script' | 'analytics' | 'errors' | 'sales' | 'default'

const CATEGORY_LABELS: Record<Category, string> = {
  ai: 'AI',
  growth: 'Рост',
  editing: 'Монтаж',
  script: 'Сценарий',
  analytics: 'Аналитика',
  errors: 'Ошибки',
  sales: 'Продажи',
  default: 'Контент',
}

function getCategoryFromReel(reel: Reel): Category {
  const caption = (reel.caption ?? '').toLowerCase()
  if (caption.includes('ai') || caption.includes('искусственн')) return 'ai'
  if (caption.includes('рост') || caption.includes('подписчик')) return 'growth'
  if (caption.includes('монтаж') || caption.includes('переход')) return 'editing'
  if (caption.includes('сценарий') || caption.includes('формул')) return 'script'
  if (caption.includes('аналитик') || caption.includes('время')) return 'analytics'
  if (caption.includes('ошибк')) return 'errors'
  if (caption.includes('продаж') || caption.includes('заработ')) return 'sales'
  return 'default'
}

export function ReelCard({ reel, viewMode = 'grid' }: { reel: Reel; viewMode?: 'grid' | 'list' }) {
  const title = reel.caption ? truncate(reel.caption, viewMode === 'list' ? 120 : 80) : 'Без описания'
  const category = getCategoryFromReel(reel)
  const username = reel.competitor.instagramUsername

  return (
    <article className={`reel-card surface${viewMode === 'list' ? ' list-view' : ''}`}>
      <Link to={`/reels/${reel.id}`} className="reel-cover" aria-label={`Открыть рилс: ${title}`}>
        <ReelThumbnail
          src={reel.thumbnailUrl ? getReelThumbnailUrl(reel.id) : null}
          videoSrc={reel.videoUrl}
          alt={title}
        />
        {reel.duration !== null ? (
          <span className="reel-cover-badge">{formatDuration(reel.duration)}</span>
        ) : null}
      </Link>

      <div className="reel-body">
        <Link to={`/reels/${reel.id}`} className="reel-title-link">
          <h3 className="reel-title">{title}</h3>
        </Link>

        <div className="reel-author">
          <div className="reel-author-avatar">
            <img
              src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`}
              alt=""
              loading="lazy"
            />
          </div>
          <span className="reel-author-name">@{username}</span>
          <span className="reel-verified" title="Верифицирован">✓</span>
          <span className="reel-author-date">{formatDate(reel.publishedAt)}</span>
        </div>

        <div className="reel-metrics">
          <span className="reel-metric" title="Просмотры">
            <span className="reel-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </span>
            {formatCompactNumber(reel.viewsCount)}
          </span>
          <span className="reel-metric" title="Лайки">
            <span className="reel-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </span>
            {formatCompactNumber(reel.likesCount)}
          </span>
          <span className="reel-metric" title="Комментарии">
            <span className="reel-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            </span>
            {formatCompactNumber(reel.commentsCount)}
          </span>
        </div>

        <div className="reel-footer">
          <div className="reel-footer-left">
            {reel.content.contentStatus === 'new' ? (
              <span className={`category-badge cat-${category}`}>
                {CATEGORY_LABELS[category]}
              </span>
            ) : (
              <span className={`content-badge content-${reel.content.contentStatus}`}>
                {CONTENT_STATUS_LABELS[reel.content.contentStatus]}
              </span>
            )}
          </div>
          <button type="button" className="reel-menu-btn" aria-label="Ещё">
            •••
          </button>
        </div>
      </div>
    </article>
  )
}
