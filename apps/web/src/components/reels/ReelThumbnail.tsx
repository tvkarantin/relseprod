import { useEffect, useState } from 'react'

interface ReelThumbnailProps {
  src: string | null
  alt: string
}

/**
 * Thumbnail with a graceful fallback.
 *
 * Instagram CDN links expire, so a broken image must degrade to a neutral
 * placeholder — never to a random stock photo.
 */
export function ReelThumbnail({ src, alt }: ReelThumbnailProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div className="reel-placeholder" role="img" aria-label={`${alt} — обложка недоступна`}>
        <span aria-hidden="true">▶</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
