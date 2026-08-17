import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReelsPage } from './ReelsPage'

import { ApiError } from '@/api/client'
import * as competitorsApi from '@/api/competitors'
import { monitoringApi } from '@/api/monitoring'
import * as reelsApi from '@/api/reels'
import { makeCompetitor, makeReel, page } from '@/test/fixtures'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/api/reels')
vi.mock('@/api/competitors')
vi.mock('@/api/monitoring')

const mockedReels = vi.mocked(reelsApi)
const mockedCompetitors = vi.mocked(competitorsApi)
const mockedMonitoring = vi.mocked(monitoringApi)

beforeEach(() => {
  mockedCompetitors.fetchCompetitors.mockResolvedValue([
    makeCompetitor({ id: 1, instagramUsername: 'natgeo' }),
    makeCompetitor({ id: 2, instagramUsername: 'nasa' }),
  ])
  mockedReels.fetchReels.mockResolvedValue(page([]))
  mockedMonitoring.libraryVideos.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ReelsPage', () => {
  it('shows a loading skeleton before data arrives', () => {
    mockedReels.fetchReels.mockReturnValue(new Promise(() => {}))

    const { container } = renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(container.querySelectorAll('.skeleton-card').length).toBeGreaterThan(0)
  })

  it('shows the empty state with an add competitor action', async () => {
    renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(await screen.findByText('Здесь пока пусто')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Добавить конкурента/ })).toBeInTheDocument()
  })

  it('renders reel cards with real metrics', async () => {
    mockedReels.fetchReels.mockResolvedValue(
      page([
        makeReel({
          id: 10,
          caption: 'Как снимать рилсы',
          viewsCount: 1_200_000,
          likesCount: 5000,
          commentsCount: 120,
        }),
      ]),
    )

    renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(await screen.findByText('Как снимать рилсы')).toBeInTheDocument()
    const card = screen.getByText('Как снимать рилсы').closest('.reel-card') as HTMLElement
    expect(within(card).getByText(/@example/)).toBeInTheDocument()
    expect(screen.getByTitle('Просмотры')).toHaveTextContent('1,2 млн')
    expect(screen.getByTitle('Лайки')).toHaveTextContent('5 тыс.')
  })

  it('shows videos transferred from monitoring in the main library', async () => {
    mockedMonitoring.libraryVideos.mockResolvedValue([
      {
        id: 7,
        externalId: 'youtube-7',
        platform: 'youtube',
        url: 'https://youtube.com/watch?v=youtube-7',
        title: 'Видео из мониторинга',
        description: 'AI workflow',
        channelId: 'channel-7',
        channelTitle: 'YouTube автор',
        thumbnailUrl: 'https://img.youtube.com/vi/youtube-7/hqdefault.jpg',
        publishedAt: '2026-07-31T08:00:00Z',
        durationSeconds: 45,
        contentType: 'video',
        viewCount: 12000,
        likeCount: 800,
        commentCount: 30,
        viewsPerHour: 100,
        engagementRate: 6.9,
        finalScore: 91,
        category: 'viral',
        status: 'saved',
        recommendation: null,
      },
    ])

    renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(await screen.findByText('Видео из мониторинга')).toBeInTheDocument()
    expect(screen.getByText('YouTube автор')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Открыть видео на YouTube/ })).toHaveAttribute(
      'href',
      'https://youtube.com/watch?v=youtube-7',
    )
  })

  it('renders an em dash instead of a fake zero for unknown metrics', async () => {
    mockedReels.fetchReels.mockResolvedValue(
      page([makeReel({ viewsCount: null, likesCount: null, commentsCount: null })]),
    )

    renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(await screen.findByTitle('Просмотры')).toHaveTextContent('—')
    expect(screen.getByTitle('Лайки')).toHaveTextContent('—')
  })

  it('links each card to its details page', async () => {
    mockedReels.fetchReels.mockResolvedValue(page([makeReel({ id: 42 })]))

    renderWithProviders(<ReelsPage />, { route: '/reels' })

    const link = await screen.findByRole('link', { name: /Открыть рилс/ })
    expect(link).toHaveAttribute('href', '/reels/42')
  })

  it('debounces the search and resets paging', async () => {
    const user = userEvent.setup()
    mockedReels.fetchReels.mockResolvedValue(page([makeReel()]))

    renderWithProviders(<ReelsPage />, { route: '/reels?page=3' })
    await screen.findByText('Как снимать рилсы')

    await user.type(screen.getByLabelText(/Поиск по библиотеке/), 'маркетинг')

    await waitFor(
      () =>
        expect(mockedReels.fetchReels).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'маркетинг', page: 1 }),
          expect.anything(),
        ),
      { timeout: 3000 },
    )
  })

  it('shows a dedicated empty state when the search finds nothing', async () => {
    mockedReels.fetchReels.mockResolvedValue(page([]))

    renderWithProviders(<ReelsPage />, { route: '/reels?search=ничего' })

    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument()
  })

  it('filters by competitor and resets the page', async () => {
    const user = userEvent.setup()
    mockedReels.fetchReels.mockResolvedValue(page([makeReel()]))

    renderWithProviders(<ReelsPage />, { route: '/reels?page=2' })
    await screen.findByText('Как снимать рилсы')

    await user.selectOptions(screen.getByLabelText('Фильтр по конкуренту'), '2')

    await waitFor(() =>
      expect(mockedReels.fetchReels).toHaveBeenLastCalledWith(
        expect.objectContaining({ competitorId: 2, page: 1 }),
        expect.anything(),
      ),
    )
  })

  it('reads filters from the URL on first render', async () => {
    mockedReels.fetchReels.mockResolvedValue(page([makeReel()]))

    renderWithProviders(<ReelsPage />, { route: '/reels?search=test&competitor_id=2&page=2' })

    await waitFor(() =>
      expect(mockedReels.fetchReels).toHaveBeenCalledWith(
        { competitorId: 2, search: 'test', sort: 'date', page: 2, limit: 10 },
        expect.anything(),
      ),
    )
  })

  it('requests the selected sorting from the server', async () => {
    const user = userEvent.setup()
    mockedReels.fetchReels.mockResolvedValue(page([makeReel()]))

    renderWithProviders(<ReelsPage />, { route: '/reels' })
    await screen.findByText('Как снимать рилсы')

    expect(mockedReels.fetchReels).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'date' }),
      expect.anything(),
    )

    await user.selectOptions(screen.getByLabelText('Сортировка'), 'likes')

    await waitFor(() =>
      expect(mockedReels.fetchReels).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'likes', page: 1 }),
        expect.anything(),
      ),
    )
  })

  it('paginates and disables the boundaries', async () => {
    const user = userEvent.setup()
    mockedReels.fetchReels.mockResolvedValue(
      page([makeReel()], { page: 1, total: 45, pages: 3 }),
    )

    renderWithProviders(<ReelsPage />, { route: '/reels' })
    await screen.findByText('Как снимать рилсы')

    expect(screen.getByRole('button', { name: /Предыдущая страница/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Страница 2' }))

    await waitFor(() =>
      expect(mockedReels.fetchReels).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    )
  })

  it('shows an error state with retry', async () => {
    mockedReels.fetchReels.mockRejectedValueOnce(
      new ApiError('Ошибка сервера', { code: 'INTERNAL_ERROR', status: 500 }),
    )
    const user = userEvent.setup()

    renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(await screen.findByText(/Не удалось загрузить данные/)).toBeInTheDocument()

    mockedReels.fetchReels.mockResolvedValue(page([makeReel()]))
    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Как снимать рилсы')).toBeInTheDocument()
  })

  it('opens the competitor import dialog without navigating away', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ReelsPage />, { route: '/reels' })

    await user.click(await screen.findByRole('button', { name: '+ Добавить ссылку' }))

    expect(screen.getByRole('dialog', { name: 'Добавить конкурента' })).toBeInTheDocument()
    expect(screen.getByLabelText('Instagram-аккаунт или ссылка')).toBeInTheDocument()
  })

  it('opens the competitor import dialog from the dashboard route parameter', async () => {
    renderWithProviders(<ReelsPage />, { route: '/reels?import=competitor' })

    expect(
      await screen.findByRole('dialog', { name: 'Добавить конкурента' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Instagram-аккаунт или ссылка')).toHaveFocus()
    expect(screen.getByRole('radio', { name: /Популярные/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Последние 5/ })).not.toBeChecked()
  })

  it('starts an import with the selected latest mode', async () => {
    const user = userEvent.setup()
    mockedCompetitors.createCompetitor.mockResolvedValue(
      makeCompetitor({ id: 9, instagramUsername: 'latestcreator' }),
    )
    mockedCompetitors.startImport.mockResolvedValue({ jobId: 15, status: 'queued' })
    renderWithProviders(<ReelsPage />, { route: '/reels?import=competitor' })

    await user.type(
      await screen.findByLabelText('Instagram-аккаунт или ссылка'),
      'latestcreator',
    )
    await user.click(screen.getByRole('radio', { name: /Последние 5/ }))
    await user.click(screen.getByRole('button', { name: 'Добавить и импортировать' }))

    await waitFor(() =>
      expect(mockedCompetitors.startImport).toHaveBeenCalledWith(9, 'latest'),
    )
  })

  it('shows category tabs', async () => {
    renderWithProviders(<ReelsPage />, { route: '/reels' })

    expect(await screen.findByText('Все')).toBeInTheDocument()
    expect(screen.getByText('Тренды')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Продажи')).toBeInTheDocument()
    expect(screen.getByText('Монтаж')).toBeInTheDocument()
    expect(screen.getByText('Сценарии')).toBeInTheDocument()
  })
})
