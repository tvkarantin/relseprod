import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReelDetailsPage } from './ReelDetailsPage'

import { ApiError } from '@/api/client'
import * as reelsApi from '@/api/reels'
import { AUTOSAVE_DELAY_MS } from '@/hooks/useAutosave'
import { makeContent, makeReel } from '@/test/fixtures'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/api/reels')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useParams: () => ({ reelId: '1' }) }
})

const mockedReels = vi.mocked(reelsApi)

function savedResponse(overrides: Record<string, unknown> = {}) {
  return {
    reelId: 1,
    hook: '',
    script: '',
    cta: '',
    notes: '',
    contentStatus: 'new' as const,
    updatedAt: '2026-07-26T18:30:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockedReels.fetchReel.mockResolvedValue(makeReel())
  mockedReels.saveReelContent.mockResolvedValue(savedResponse())
  mockedReels.takeReelToWork.mockResolvedValue(savedResponse({ contentStatus: 'idea' }))
  mockedReels.deleteReel.mockResolvedValue(undefined)
})

afterEach(() => {
  // Restore real timers even if a test failed mid-way, otherwise the leak
  // would freeze every following test.
  vi.useRealTimers()
  vi.clearAllMocks()
})

/**
 * Render the page under fake timers and wait for the initial query.
 *
 * `userEvent` cannot be combined with fake timers here (its internal delays
 * deadlock), so timer-driven tests use `fireEvent` to change a field and then
 * advance the clock explicitly.
 */
async function renderWithFakeTimers() {
  vi.useFakeTimers()
  const result = renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50)
  })
  return result
}

/** Type into a field in one go and let the debounce elapse. */
async function changeField(field: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(field, { target: { value } })
  })
}

async function advancePastDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50)
  })
}

describe('ReelDetailsPage — rendering', () => {
  it('loads the reel and fills the editor', async () => {
    mockedReels.fetchReel.mockResolvedValue(
      makeReel({
        content: makeContent({ hook: 'Существующий хук', script: 'Существующий сценарий' }),
      }),
    )

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    expect(await screen.findByLabelText(/Хук/)).toHaveValue('Существующий хук')
    expect(screen.getByLabelText(/Основная часть/)).toHaveValue('Существующий сценарий')
  })

  it('renders metrics and the Instagram link', async () => {
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await screen.findByLabelText(/Хук/)
    expect(screen.getByText('100 000')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Открыть в Instagram/ })
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('falls back to the thumbnail when there is no video', async () => {
    mockedReels.fetchReel.mockResolvedValue(makeReel({ videoUrl: null }))

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await screen.findByLabelText(/Хук/)
    expect(screen.getByRole('img', { name: /Как снимать рилсы/ })).toBeInTheDocument()
  })

  it('falls back to a placeholder when both video and thumbnail are missing', async () => {
    mockedReels.fetchReel.mockResolvedValue(makeReel({ videoUrl: null, thumbnailUrl: null }))

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await screen.findByLabelText(/Хук/)
    expect(screen.getByRole('img', { name: /обложка недоступна/ })).toBeInTheDocument()
  })

  it('shows an error state when the reel is missing', async () => {
    mockedReels.fetchReel.mockRejectedValue(
      new ApiError('Рилс не найден', { code: 'REEL_NOT_FOUND', status: 404 }),
    )

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    expect(await screen.findByText('Рилс не найден')).toBeInTheDocument()
  })

  it('moves a new reel to work from the header', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await user.click(await screen.findByRole('button', { name: 'Взять в работу' }))

    await waitFor(() => expect(mockedReels.takeReelToWork).toHaveBeenCalledWith(1))
    expect(screen.getByText('Рилс перенесён в «Мои рилсы»')).toBeInTheDocument()
  })

  it('deletes a rejected reel without a confirmation dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await user.click(await screen.findByRole('button', { name: 'Не подошёл' }))

    await waitFor(() => expect(mockedReels.deleteReel).toHaveBeenCalledWith(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Рилс удалён из библиотеки')).toBeInTheDocument()
  })

  it('shows the workflow tag for a reel already in work', async () => {
    mockedReels.fetchReel.mockResolvedValue(
      makeReel({ content: makeContent({ contentStatus: 'script' }) }),
    )
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await screen.findByLabelText(/Хук/)
    expect(document.querySelector('.reel-detail-status')).toHaveTextContent('Сценарий')
    expect(screen.queryByRole('button', { name: 'Взять в работу' })).not.toBeInTheDocument()
  })
})

describe('ReelDetailsPage — autosave', () => {
  it('does not save on the initial load', async () => {
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await screen.findByLabelText(/Хук/)
    await new Promise((resolve) => setTimeout(resolve, AUTOSAVE_DELAY_MS + 200))

    expect(mockedReels.saveReelContent).not.toHaveBeenCalled()
    expect(screen.getByTestId('save-state')).toHaveTextContent('Сохранено')
  })

  it('marks the form dirty immediately and saves after the debounce', async () => {
    await renderWithFakeTimers()

    await changeField(screen.getByLabelText(/Хук/), 'Новый хук')

    expect(screen.getByTestId('save-state')).toHaveTextContent('Есть изменения')
    expect(mockedReels.saveReelContent).not.toHaveBeenCalled()

    await advancePastDebounce()

    expect(mockedReels.saveReelContent).toHaveBeenCalledTimes(1)
    expect(mockedReels.saveReelContent).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ hook: 'Новый хук' }),
    )
  })

  it('sends one request for a burst of typing', async () => {
    await renderWithFakeTimers()
    const hook = screen.getByLabelText(/Хук/)

    // Several edits inside one debounce window.
    for (const value of ['а', 'аб', 'абв', 'абвг', 'абвгд', 'абвгде']) {
      await changeField(hook, value)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
    }
    expect(mockedReels.saveReelContent).not.toHaveBeenCalled()

    await advancePastDebounce()

    expect(mockedReels.saveReelContent).toHaveBeenCalledTimes(1)
    expect(mockedReels.saveReelContent).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ hook: 'абвгде' }),
    )
  })

  it('shows the saved state after a successful save', async () => {
    await renderWithFakeTimers()
    mockedReels.saveReelContent.mockResolvedValue(savedResponse({ hook: 'Х' }))

    await changeField(screen.getByLabelText(/Хук/), 'Х')
    expect(screen.getByTestId('save-state')).toHaveTextContent('Есть изменения')

    await advancePastDebounce()

    expect(screen.getByTestId('save-state')).toHaveTextContent('Сохранено')
  })

  it('saves the status change', async () => {
    await renderWithFakeTimers()

    await changeField(screen.getByLabelText(/Статус/), 'script')
    await advancePastDebounce()

    expect(mockedReels.saveReelContent).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ contentStatus: 'script' }),
    )
  })

  it('keeps the text and offers a manual retry when saving fails', async () => {
    mockedReels.saveReelContent.mockRejectedValue(
      new ApiError('База данных временно недоступна', {
        code: 'DATABASE_ERROR',
        status: 503,
      }),
    )
    await renderWithFakeTimers()

    await changeField(screen.getByLabelText(/Хук/), 'Важный текст')
    await advancePastDebounce()

    expect(screen.getByTestId('save-state')).toHaveTextContent('Ошибка сохранения')
    // The user's input must survive the failure.
    expect(screen.getByLabelText(/Хук/)).toHaveValue('Важный текст')
    expect(screen.getByRole('alert')).toHaveTextContent('Текст не потерян')

    mockedReels.saveReelContent.mockResolvedValue(savedResponse({ hook: 'Важный текст' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(screen.getByTestId('save-state')).toHaveTextContent('Сохранено')
  })

  it('reports a validation error and does not send the request', async () => {
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })
    await screen.findByLabelText(/Хук/)

    const hook = screen.getByLabelText(/Хук/) as HTMLTextAreaElement
    // Bypass typing 501 characters one by one.
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set
      setter?.call(hook, 'x'.repeat(501))
      hook.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(await screen.findByText(/Максимум 500 символов/)).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, AUTOSAVE_DELAY_MS + 200))
    expect(mockedReels.saveReelContent).not.toHaveBeenCalled()
  })

  it('shows a character counter for the hook', async () => {
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })

    await screen.findByLabelText(/Хук/)
    expect(screen.getByText('0/500')).toBeInTheDocument()
    expect(screen.getByText('0/1000')).toBeInTheDocument()
    // script and notes share the same limit
    expect(screen.getAllByText('0/10000')).toHaveLength(2)
  })

  it('a stale response cannot overwrite newer input', async () => {
    let resolveFirst: ((value: ReturnType<typeof savedResponse>) => void) | undefined
    mockedReels.saveReelContent
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValue(savedResponse({ hook: 'АБ' }))

    await renderWithFakeTimers()
    const hook = screen.getByLabelText(/Хук/)

    await changeField(hook, 'А')
    await advancePastDebounce()
    expect(mockedReels.saveReelContent).toHaveBeenCalledTimes(1)

    // Type more while the first request is still in flight.
    await changeField(hook, 'АБ')
    await advancePastDebounce()
    expect(mockedReels.saveReelContent).toHaveBeenCalledTimes(2)

    // Only now let the stale first response land.
    await act(async () => {
      resolveFirst?.(savedResponse({ hook: 'А' }))
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(screen.getByLabelText(/Хук/)).toHaveValue('АБ')
    expect(screen.getByTestId('save-state')).toHaveTextContent('Сохранено')
  })
})

describe('ReelDetailsPage — unsaved changes guard', () => {
  it('does not warn when everything is saved', async () => {
    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })
    await screen.findByLabelText(/Хук/)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('warns while changes are pending', async () => {
    const user = userEvent.setup()

    renderWithProviders(<ReelDetailsPage />, { route: '/reels/1' })
    await screen.findByLabelText(/Хук/)

    await user.type(screen.getByLabelText(/Хук/), 'ч')

    await waitFor(() =>
      expect(screen.getByTestId('save-state')).toHaveTextContent('Есть изменения'),
    )

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
