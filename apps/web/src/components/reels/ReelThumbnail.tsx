import { useEffect, useState } from 'react'

import './ReelThumbnail.css'

interface ReelThumbnailProps {
  src: string | null
  /** Kept for backwards compatibility; cards intentionally never use a video frame as a cover. */
  videoSrc?: string | null
  alt: string
}

/**
 * Render the actual Instagram cover without cropping it into the wide card.
 *
 * A blurred copy fills the horizontal card background while the real cover is
 * shown in full above it. If the cover cannot be loaded we deliberately show
 * a placeholder instead of seeking the first frame of the Reel.
 */
export function ReelThumbnail({ src, alt }: ReelThumbnailProps) {
  const [media, setMedia] = useState<'image' | 'placeholder'>(src ? 'image' : 'placeholder')

  useEffect(() => {
    setMedia(src ? 'image' : 'placeholder')
  }, [src])

  if (media === 'placeholder') {
    return (
      <div className="reel-placeholder" role="img" aria-label={`${alt} — обложка недоступна`}>
        <span aria-hidden="true">▶</span>
      </div>
    )
  }

  return (
    <span className="reel-thumbnail-stack">
      <img
        className="reel-thumbnail-backdrop"
        src={src ?? undefined}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      <img
        className="reel-thumbnail-image"
        src={src ?? undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setMedia('placeholder')}
      />
    </span>
  )
}
