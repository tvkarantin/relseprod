import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReelDetailsPage } from './ReelDetailsPage'

import * as transcriptionsApi from '@/api/transcriptions'
import * as reelsApi from '@/api/reels'
import { makeContent, makeReel } from '@/test/fixtures'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/api/reels')
vi.mock('@/api/transcriptions')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useParams: () => ({ reelId: '1' }) }
})

const mockedReels = vi.mocked(reelsApi)
const mockedTranscriptions = vi.mocked(transcriptionsApi)

beforeEach(() => {
  mockedReels.fetchReel.mockResolvedValue(
    makeReel({
      videoUrl: 'https://example.com/video.mp4',
      transcription: null,
    }),
  )
  mockedTranscriptions.fetchTranscription.mockResolvedValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ReelTranscriptionControls', () => {
  it('shows prompt and start button when no transcription exists', async () => {
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    expect(await screen.findByText('Получите точную расшифровку речи из видео')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Расшифровать видео' })).toBeInTheDocument()
  })

  it('disables button and shows warning when videoUrl is missing', async () => {
    mockedReels.fetchReel.mockResolvedValue(
      makeReel({
        videoUrl: null,
        transcription: null,
      }),
    )

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    expect(await screen.findByText(/Для этого рилса нет доступной ссылки на видео/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Расшифровать видео' })).toBeDisabled()
  })

  it('starts transcription on button click', async () => {
    mockedTranscriptions.startTranscription.mockResolvedValue({
      id: 10,
      status: 'queued',
      provider: 'deepgram',
      model: 'nova-3',
      transcript: null,
      dominantLanguage: null,
      languages: null,
      confidence: null,
      words: null,
      utterances: null,
      paragraphs: null,
      providerRequestId: null,
      providerDuration: null,
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-07-30T10:00:00Z',
    })

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    const startBtn = await screen.findByRole('button', { name: 'Расшифровать видео' })
    await act(async () => {
      fireEvent.click(startBtn)
    })

    expect(mockedTranscriptions.startTranscription).toHaveBeenCalledWith(1)
  })

  it('displays completed transcription with actions', async () => {
    mockedTranscriptions.fetchTranscription.mockResolvedValue({
      id: 10,
      status: 'completed',
      provider: 'deepgram',
      model: 'nova-3',
      transcript: 'Это расшифрованная речь из видео.',
      dominantLanguage: 'ru',
      languages: ['ru'],
      confidence: 0.98,
      words: [],
      utterances: [],
      paragraphs: [],
      providerRequestId: 'req-1',
      providerDuration: 10.0,
      errorCode: null,
      errorMessage: null,
      startedAt: '2026-07-30T10:00:00Z',
      completedAt: '2026-07-30T10:01:00Z',
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-07-30T10:01:00Z',
    })

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    expect(await screen.findByText('Расшифровка готова')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Посмотреть' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скопировать' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перенести в основную часть' })).toBeInTheDocument()
  })

  it('transfers transcript to script field when script is empty', async () => {
    mockedTranscriptions.fetchTranscription.mockResolvedValue({
      id: 10,
      status: 'completed',
      provider: 'deepgram',
      model: 'nova-3',
      transcript: 'Новый текст расшифровки.',
      dominantLanguage: 'ru',
      languages: ['ru'],
      confidence: 0.98,
      words: [],
      utterances: [],
      paragraphs: [],
      providerRequestId: 'req-1',
      providerDuration: 10.0,
      errorCode: null,
      errorMessage: null,
      startedAt: '2026-07-30T10:00:00Z',
      completedAt: '2026-07-30T10:01:00Z',
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-07-30T10:01:00Z',
    })

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    const transferBtn = await screen.findByRole('button', { name: 'Перенести в основную часть' })
    await act(async () => {
      fireEvent.click(transferBtn)
    })

    expect(screen.getByLabelText(/Основная часть/)).toHaveValue('Новый текст расшифровки.')
  })

  it('shows confirmation dialog when script already contains text', async () => {
    mockedReels.fetchReel.mockResolvedValue(
      makeReel({
        videoUrl: 'https://example.com/video.mp4',
        content: makeContent({ script: 'Старый сценарий' }),
      }),
    )

    mockedTranscriptions.fetchTranscription.mockResolvedValue({
      id: 10,
      status: 'completed',
      provider: 'deepgram',
      model: 'nova-3',
      transcript: 'Новый текст расшифровки.',
      dominantLanguage: 'ru',
      languages: ['ru'],
      confidence: 0.98,
      words: [],
      utterances: [],
      paragraphs: [],
      providerRequestId: 'req-1',
      providerDuration: 10.0,
      errorCode: null,
      errorMessage: null,
      startedAt: '2026-07-30T10:00:00Z',
      completedAt: '2026-07-30T10:01:00Z',
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-07-30T10:01:00Z',
    })

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    const transferBtn = await screen.findByRole('button', { name: 'Перенести в основную часть' })
    await act(async () => {
      fireEvent.click(transferBtn)
    })

    expect(await screen.findByText('Заменить текст?')).toBeInTheDocument()
    expect(screen.getByText('Основная часть уже содержит текст. Заменить её расшифровкой?')).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Заменить' })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(screen.getByLabelText(/Основная часть/)).toHaveValue('Новый текст расшифровки.')
  })
})
