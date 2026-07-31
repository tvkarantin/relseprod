import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReelThumbnail } from './ReelThumbnail'

describe('ReelThumbnail', () => {
  it('falls back from a broken image to a video frame', () => {
    render(
      <ReelThumbnail
        src="https://cdn.example.com/expired.jpg"
        videoSrc="https://cdn.example.com/reel.mp4"
        alt="Тестовый рилс"
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Тестовый рилс' }))

    const video = screen.getByLabelText('Тестовый рилс — превью видео')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://cdn.example.com/reel.mp4')
  })

  it('shows the placeholder only when both preview sources fail', () => {
    render(
      <ReelThumbnail
        src="https://cdn.example.com/expired.jpg"
        videoSrc="https://cdn.example.com/expired.mp4"
        alt="Тестовый рилс"
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Тестовый рилс' }))
    fireEvent.error(screen.getByLabelText('Тестовый рилс — превью видео'))

    expect(screen.getByRole('img', { name: 'Тестовый рилс — обложка недоступна' })).toBeInTheDocument()
  })
})
