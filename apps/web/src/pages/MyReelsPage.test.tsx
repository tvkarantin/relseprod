import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MyReelsPage } from './MyReelsPage'

import * as reelsApi from '@/api/reels'
import { makeContent, makeReel } from '@/test/fixtures'
import { renderWithProviders } from '@/test/utils'
import { buildContentPlanCsv } from '@/utils/contentPlan'

vi.mock('@/api/reels')

const mockedReels = vi.mocked(reelsApi)

beforeEach(() => {
  mockedReels.fetchAllMyReels.mockResolvedValue([])
  mockedReels.saveReelContent.mockImplementation(async (id, payload) => ({
    reelId: id,
    ...payload,
    updatedAt: '2026-08-10T12:00:00Z',
  }))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MyReelsPage content plan', () => {
  it('renders the five production stages and their reels', async () => {
    mockedReels.fetchAllMyReels.mockResolvedValue([
      makeReel({ id: 1, caption: 'Идея один', content: makeContent({ contentStatus: 'idea' }) }),
      makeReel({ id: 2, caption: 'Сценарий готов', content: makeContent({ contentStatus: 'script' }) }),
      makeReel({ id: 3, caption: 'Уже снято', content: makeContent({ contentStatus: 'filmed' }) }),
      makeReel({ id: 4, caption: 'Монтаж', content: makeContent({ contentStatus: 'editing' }) }),
      makeReel({ id: 5, caption: 'Опубликовано', content: makeContent({ contentStatus: 'published' }) }),
    ])

    renderWithProviders(<MyReelsPage />, { route: '/my-reels' })

    const stages = ['Доработка', 'Готово', 'Снято', 'В монтаже', 'Выложено']
    for (const stage of stages) {
      expect(await screen.findByRole('region', { name: `Этап «${stage}»` })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Идея один' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Сценарий готов' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Уже снято' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Монтаж' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Опубликовано' })).toBeInTheDocument()
  })

  it('moves a reel through the accessible stage selector and persists all content', async () => {
    const user = userEvent.setup()
    const reel = makeReel({
      id: 17,
      caption: 'Проверить переход',
      content: makeContent({
        contentStatus: 'idea',
        hook: 'Хук',
        script: 'Текст',
        cta: 'CTA',
        notes: 'Заметка',
      }),
    })
    mockedReels.fetchAllMyReels.mockResolvedValue([reel])

    renderWithProviders(<MyReelsPage />, { route: '/my-reels' })

    const select = await screen.findByLabelText('Переместить «Хук» на этап')
    await user.selectOptions(select, 'filmed')

    await waitFor(() => {
      expect(mockedReels.saveReelContent).toHaveBeenCalledWith(17, {
        hook: 'Хук',
        script: 'Текст',
        cta: 'CTA',
        notes: 'Заметка',
        contentStatus: 'filmed',
      })
    })
    const filmed = screen.getByRole('region', { name: 'Этап «Снято»' })
    expect(within(filmed).getByLabelText('Карточка: Хук')).toBeInTheDocument()
  })

  it('moves a card with drag and drop', async () => {
    const reel = makeReel({
      id: 23,
      caption: 'Перетащить карточку',
      content: makeContent({ contentStatus: 'script' }),
    })
    mockedReels.fetchAllMyReels.mockResolvedValue([reel])
    renderWithProviders(<MyReelsPage />, { route: '/my-reels' })

    const card = await screen.findByLabelText('Карточка: Перетащить карточку')
    const editingColumn = screen.getByRole('region', { name: 'Этап «В монтаже»' })
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(() => '23'),
    }

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(editingColumn, { dataTransfer })
    fireEvent.drop(editingColumn, { dataTransfer })

    await waitFor(() => {
      expect(mockedReels.saveReelContent).toHaveBeenCalledWith(
        23,
        expect.objectContaining({ contentStatus: 'editing' }),
      )
    })
  })

  it('keeps all five empty drop zones and links to the idea library', async () => {
    renderWithProviders(<MyReelsPage />, { route: '/my-reels' })

    expect(await screen.findAllByText('Перетащите рилс сюда')).toHaveLength(5)
    expect(screen.getByRole('link', { name: /Разобрать идеи/ })).toHaveAttribute('href', '/reels')
    expect(screen.getByRole('button', { name: /Экспорт CSV/ })).toBeDisabled()
  })
})

describe('buildContentPlanCsv', () => {
  it('exports stage, script fields and protects spreadsheet formulas', () => {
    const csv = buildContentPlanCsv([
      makeReel({
        content: makeContent({
          contentStatus: 'editing',
          hook: '=опасная формула',
          script: 'Основная часть',
        }),
      }),
    ])

    expect(csv).toContain('"В монтаже"')
    expect(csv).toContain('"\'=опасная формула"')
    expect(csv).toContain('"Основная часть"')
  })
})
