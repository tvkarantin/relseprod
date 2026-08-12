import type { MonitoredVideo } from '@/api/monitoring'
import { formatCompactNumber, formatDuration } from '@/utils/format'

export function YouTubeLibraryCard({ video }: { video: MonitoredVideo }) {
  return (
    <article className="reel-card surface library-youtube-card">
      <a
        className="reel-cover"
        href={video.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Открыть видео на YouTube: ${video.title}`}
      >
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : null}
        <span className="reel-platform-badge reel-platform-youtube">
          <span aria-hidden="true">▶</span> YouTube
        </span>
        {video.durationSeconds !== null ? (
          <span className="reel-cover-badge">{formatDuration(video.durationSeconds)}</span>
        ) : null}
      </a>

      <div className="reel-body">
        <a className="reel-title-link" href={video.url} target="_blank" rel="noreferrer">
          <h3 className="reel-title">{video.title}</h3>
        </a>

        <div className="reel-author">
          <div className="reel-author-avatar reel-author-avatar-youtube" aria-hidden="true">
            {video.channelTitle.slice(0, 1).toUpperCase()}
          </div>
          <span className="reel-author-name">{video.channelTitle}</span>
        </div>

        <div className="reel-metrics">
          <span className="reel-metric" title="Просмотры">
            <span className="reel-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </span>
            {formatCompactNumber(video.viewCount)}
          </span>
          <span className="reel-metric" title="Лайки">
            <span className="reel-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </span>
            {formatCompactNumber(video.likeCount)}
          </span>
          <span className="reel-metric" title="Комментарии">
            <span className="reel-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            </span>
            {formatCompactNumber(video.commentCount)}
          </span>
        </div>
      </div>
    </article>
  )
}
