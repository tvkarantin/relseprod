import type { MonitoredVideo } from '@/api/monitoring'
import { formatNumber } from '@/utils/format'

export function YouTubeLibraryCard({ video }: { video: MonitoredVideo }) {
  return (
    <article className="monitoring-video-card library-youtube-card">
      <a
        className="monitoring-video-cover"
        href={video.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Открыть видео на YouTube: ${video.title}`}
      >
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : null}
        <span>▶</span>
        <b aria-label={`Рейтинг ${Math.round(video.finalScore ?? 0)}`}>
          {Math.round(video.finalScore ?? 0)}
        </b>
      </a>
      <div className="monitoring-video-body">
        <div className="monitoring-video-meta">
          <span>YouTube · {video.contentType === 'short' ? 'Shorts' : 'Видео'}</span>
          <span>{formatNumber(video.viewCount)} просмотров</span>
        </div>
        <a href={video.url} target="_blank" rel="noreferrer">
          <h3>{video.title}</h3>
        </a>
        <p>{video.channelTitle}</p>
        <a
          className="button button-small library-youtube-open"
          href={video.url}
          target="_blank"
          rel="noreferrer"
        >
          Открыть на YouTube ↗
        </a>
      </div>
    </article>
  )
}
