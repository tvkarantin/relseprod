import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReelThumbnail } from './ReelThumbnail'

describe('ReelThumbnail', () => {
  it('shows a placeholder instead of falling back to the first video frame', () => {
    const { container } = render(
      <ReelThumbnail
        src="https://cdn.example.com/expired.jpg"
        videoSrc="https://cdn.example.com/reel.mp4"
        alt="Тестовый рилс"
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Тестовый рилс' }))

    expect(screen.getByRole('img', { name: 'Тестовый рилс — обложка недоступна' })).toBeInTheDocument()
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('shows a placeholder when the Instagram cover is missing', () => {
    const { container } = render(
      <ReelThumbnail
        src={null}
        videoSrc="https://cdn.example.com/reel.mp4"
        alt="Тестовый рилс"
      />,
    )

    expect(screen.getByRole('img', { name: 'Тестовый рилс — обложка недоступна' })).toBeInTheDocument()
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })
})
