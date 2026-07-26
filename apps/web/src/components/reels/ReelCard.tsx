import { Link } from 'react-router-dom'

import { ReelThumbnail } from './ReelThumbnail'

import { ContentStatusBadge } from '@/components/ui/StatusBadge'
import type { Reel } from '@/types/reel'
import { formatCompactNumber, formatDate, formatDuration, truncate } from '@/utils/format'

export function ReelCard({ reel }: { reel: Reel }) {
  const title = reel.caption ? truncate(reel.caption, 70) : 'Без описания'

  return (
    <article className="reel-card surface">
      <Link to={`/reels/${reel.id}`} className="reel-cover" aria-label={`Открыть рилс: ${title}`}>
        <ReelThumbnail src={reel.thumbnailUrl} alt={title} />
        {reel.duration !== null ? (
          <span className="reel-cover-badge">{formatDuration(reel.duration)}</span>
        ) : null}
      </Link>

      <div className="reel-body">
        <div className="reel-author">
          <span>@{reel.competitor.instagramUsername}</span>
          <ContentStatusBadge status={reel.content.contentStatus} />
        </div>

        <p className="reel-caption">{title}</p>

        <div className="reel-metrics">
          <span title="Просмотры">▶ {formatCompactNumber(reel.viewsCount)}</span>
          <span title="Лайки">♥ {formatCompactNumber(reel.likesCount)}</span>
          <span title="Комментарии">💬 {formatCompactNumber(reel.commentsCount)}</span>
        </div>

        <div className="reel-footer">
          <span className="reel-metrics">{formatDate(reel.publishedAt)}</span>
          {reel.originalUrl ? (
            <a
              href={reel.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-small"
              aria-label="Открыть оригинал в Instagram"
            >
              Instagram ↗
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}
