import { useEffect, useState } from 'react'

interface ReelThumbnailProps {
  src: string | null
  videoSrc?: string | null
  alt: string
}

/**
 * Thumbnail with a layered fallback.
 *
 * Instagram image CDN links often expire earlier than the reel itself. In
 * cards we can still show a real preview frame from the video before falling
 * back to the neutral placeholder.
 */
export function ReelThumbnail({ src, videoSrc = null, alt }: ReelThumbnailProps) {
  const [media, setMedia] = useState<'image' | 'video' | 'placeholder'>(
    src ? 'image' : videoSrc ? 'video' : 'placeholder',
  )

  useEffect(() => {
    setMedia(src ? 'image' : videoSrc ? 'video' : 'placeholder')
  }, [src, videoSrc])

  if (media === 'placeholder') {
    return (
      <div className="reel-placeholder" role="img" aria-label={`${alt} — обложка недоступна`}>
        <span aria-hidden="true">▶</span>
      </div>
    )
  }

  if (media === 'video' && videoSrc) {
    return (
      <video
        className="reel-thumbnail-video"
        src={videoSrc}
        muted
        playsInline
        preload="metadata"
        aria-label={`${alt} — превью видео`}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.duration > 0) video.currentTime = Math.min(0.1, video.duration / 2)
        }}
        onError={() => setMedia('placeholder')}
      />
    )
  }

  return (
    <img
      src={src ?? undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setMedia(videoSrc ? 'video' : 'placeholder')}
    />
  )
}
