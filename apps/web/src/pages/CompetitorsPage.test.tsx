import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CompetitorsPage } from './CompetitorsPage'

import { ApiError } from '@/api/client'
import * as competitorsApi from '@/api/competitors'
import * as jobsApi from '@/api/jobs'
import { makeCompetitor, makeJob } from '@/test/fixtures'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/api/competitors')
vi.mock('@/api/jobs')

const mockedCompetitors = vi.mocked(competitorsApi)
const mockedJobs = vi.mocked(jobsApi)

beforeEach(() => {
  mockedCompetitors.fetchCompetitors.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('CompetitorsPage', () => {
  it('shows the empty state when nothing is tracked', async () => {
    renderWithProviders(<CompetitorsPage />)

    expect(await screen.findByText(/Пока нет конкурентов/)).toBeInTheDocument()
  })

  it('renders the list returned by the API', async () => {
    mockedCompetitors.fetchCompetitors.mockResolvedValue([
      makeCompetitor({ id: 1, instagramUsername: 'natgeo', reelsCount: 24 }),
      makeCompetitor({ id: 2, instagramUsername: 'nasa', status: 'idle', reelsCount: 0 }),
    ])

    renderWithProviders(<CompetitorsPage />)

    expect(await screen.findByText('@natgeo')).toBeInTheDocument()
    expect(screen.getByText('@nasa')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('shows an error state and can retry', async () => {
    mockedCompetitors.fetchCompetitors.mockRejectedValueOnce(
      new ApiError('Не удалось связаться с сервером', { code: 'NETWORK_ERROR', status: 0 }),
    )
    const user = userEvent.setup()

    renderWithProviders(<CompetitorsPage />)

    expect(await screen.findByText(/Нет связи с сервером/)).toBeInTheDocument()

    mockedCompetitors.fetchCompetitors.mockResolvedValue([makeCompetitor()])
    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('@example')).toBeInTheDocument()
  })

  it('creates a competitor from the form', async () => {
    const user = userEvent.setup()
    mockedCompetitors.createCompetitor.mockResolvedValue(
      makeCompetitor({ instagramUsername: 'newuser' }),
    )

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText(/Пока нет конкурентов/)

    await user.type(
      screen.getByLabelText('Instagram-аккаунт конкурента'),
      'https://instagram.com/newuser',
    )
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    await waitFor(() =>
      expect(mockedCompetitors.createCompetitor).toHaveBeenCalledWith(
        'https://instagram.com/newuser',
      ),
    )
    expect(await screen.findByText(/добавлен/)).toBeInTheDocument()
  })

  it('submits the form when Enter is pressed', async () => {
    const user = userEvent.setup()
    mockedCompetitors.createCompetitor.mockResolvedValue(makeCompetitor())

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText(/Пока нет конкурентов/)

    await user.type(screen.getByLabelText('Instagram-аккаунт конкурента'), 'someone{Enter}')

    await waitFor(() =>
      expect(mockedCompetitors.createCompetitor).toHaveBeenCalledWith('someone'),
    )
  })

  it('shows a duplicate error next to the field', async () => {
    const user = userEvent.setup()
    mockedCompetitors.createCompetitor.mockRejectedValue(
      new ApiError('Этот Instagram-аккаунт уже добавлен', {
        code: 'COMPETITOR_ALREADY_EXISTS',
        status: 409,
      }),
    )

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText(/Пока нет конкурентов/)

    await user.type(screen.getByLabelText('Instagram-аккаунт конкурента'), 'duplicate')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('уже добавлен')
  })

  it('rejects an empty profile without calling the API', async () => {
    const user = userEvent.setup()

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText(/Пока нет конкурентов/)

    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(mockedCompetitors.createCompetitor).not.toHaveBeenCalled()
  })

  it('starts an import and polls the job until it completes', async () => {
    const user = userEvent.setup()
    mockedCompetitors.fetchCompetitors.mockResolvedValue([
      makeCompetitor({ id: 1, instagramUsername: 'natgeo', status: 'idle' }),
    ])
    mockedCompetitors.startImport.mockResolvedValue({ jobId: 55, status: 'queued' })
    mockedJobs.fetchJob
      .mockResolvedValueOnce(makeJob({ id: 55, status: 'running', progress: 50 }))
      .mockResolvedValue(
        makeJob({ id: 55, status: 'completed', progress: 100, reelsCreated: 7, reelsUpdated: 2 }),
      )

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText('@natgeo')

    await user.click(screen.getByRole('button', { name: 'Импортировать Reels' }))

    await waitFor(() => expect(mockedCompetitors.startImport).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/Ожидание завершения Actor/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')

    expect(
      await screen.findByText(/добавлено 7, обновлено 2/, undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
  })

  it('shows a retry button when the job fails', async () => {
    const user = userEvent.setup()
    mockedCompetitors.fetchCompetitors.mockResolvedValue([makeCompetitor({ id: 1 })])
    mockedCompetitors.startImport.mockResolvedValue({ jobId: 60, status: 'queued' })
    mockedJobs.fetchJob.mockResolvedValue(
      makeJob({ id: 60, status: 'failed', progress: 20, errorMessage: 'Apify недоступен' }),
    )
    mockedJobs.retryJob.mockResolvedValue({ jobId: 61, status: 'queued' })

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText('@example')
    await user.click(screen.getByRole('button', { name: 'Импортировать Reels' }))

    // The message shows both in the job panel and in a toast.
    expect((await screen.findAllByText('Apify недоступен')).length).toBeGreaterThan(0)

    const panel = document.querySelector('.job-panel') as HTMLElement
    await user.click(within(panel).getByRole('button', { name: 'Повторить' }))

    await waitFor(() => expect(mockedJobs.retryJob).toHaveBeenCalledWith(60))
  })

  it('deletes a competitor after confirmation', async () => {
    const user = userEvent.setup()
    mockedCompetitors.fetchCompetitors.mockResolvedValue([
      makeCompetitor({ id: 3, instagramUsername: 'removeme' }),
    ])
    mockedCompetitors.deleteCompetitor.mockResolvedValue(undefined)

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText('@removeme')

    await user.click(screen.getByRole('button', { name: /Удалить конкурента @removeme/ }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Удалить @removeme\?/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    await waitFor(() => expect(mockedCompetitors.deleteCompetitor).toHaveBeenCalledWith(3))
  })

  it('closes the confirmation dialog on Escape without deleting', async () => {
    const user = userEvent.setup()
    mockedCompetitors.fetchCompetitors.mockResolvedValue([makeCompetitor({ id: 3 })])

    renderWithProviders(<CompetitorsPage />)
    await screen.findByText('@example')

    await user.click(screen.getByRole('button', { name: /Удалить конкурента/ }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(mockedCompetitors.deleteCompetitor).not.toHaveBeenCalled()
  })
})
