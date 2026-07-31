import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { YouTubeMonitoringPage } from './YouTubeMonitoringPage'

import { monitoringApi } from '@/api/monitoring'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/api/monitoring')

const mockedMonitoring = vi.mocked(monitoringApi)

beforeEach(() => {
  mockedMonitoring.topics.mockResolvedValue([])
  mockedMonitoring.channels.mockResolvedValue([])
  const video = {
    id: 17,
    externalId: 'youtube-17',
    platform: 'youtube',
    url: 'https://youtube.com/watch?v=youtube-17',
    title: 'Найденное видео',
    description: null,
    channelId: 'channel-17',
    channelTitle: 'Автор',
    thumbnailUrl: null,
    publishedAt: '2026-07-31T08:00:00Z',
    durationSeconds: 60,
    contentType: 'video',
    viewCount: 1000,
    likeCount: 100,
    commentCount: 10,
    viewsPerHour: 20,
    engagementRate: 11,
    finalScore: 88,
    category: 'strong',
    status: 'recommended',
    recommendation: null,
  }
  mockedMonitoring.videos.mockResolvedValueOnce([video]).mockResolvedValue([])
  mockedMonitoring.addToLibrary.mockResolvedValue({
    ...video,
    status: 'saved',
  })
})

describe('YouTubeMonitoringPage', () => {
  it('moves a found video to the library and removes it from results', async () => {
    const user = userEvent.setup()
    renderWithProviders(<YouTubeMonitoringPage />, { route: '/youtube-monitoring' })

    expect(await screen.findByText('Найденное видео')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'В библиотеку' }))

    await waitFor(() => {
      expect(mockedMonitoring.addToLibrary).toHaveBeenCalledWith(17)
      expect(screen.queryByText('Найденное видео')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Видео перенесено в основную библиотеку')).toBeInTheDocument()
  })
})
