import { useEffect, useState } from 'react'

import { ReelThumbnail } from './ReelThumbnail'

interface ReelPlayerProps {
  videoUrl: string | null
  thumbnailUrl: string | null
  title: string
}

/**
 * Video with a layered fallback: video → thumbnail → placeholder.
 *
 * Instagram CDN URLs are short-lived and often blocked by CORS, so a failing
 * video must never break the page. No autoplay, no sound.
 */
export function ReelPlayer({ videoUrl, thumbnailUrl, title }: ReelPlayerProps) {
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => setVideoFailed(false), [videoUrl])

  if (videoUrl && !videoFailed) {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        poster={thumbnailUrl ?? undefined}
        onError={() => setVideoFailed(true)}
        aria-label={`Видео: ${title}`}
      >
        <source src={videoUrl} />
      </video>
    )
  }

  return (
    <div className="reel-media-fallback">
      <ReelThumbnail src={thumbnailUrl} alt={title} />
    </div>
  )
}
