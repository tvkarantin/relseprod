import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UsageLimitsCard, type UsageLimitsState } from './UsageLimitsCard'

const limits = (daily: number, weekly: number): UsageLimitsState => ({
  daily: { remainingPercent: daily, resetAt: '2026-08-13T18:59:00.000Z' },
  weekly: { remainingPercent: weekly, resetAt: '2026-08-17T19:00:00.000Z' },
})

afterEach(() => {
  window.localStorage.clear()
  vi.useRealTimers()
})

describe('UsageLimitsCard', () => {
  it('shows the 100% milestone for one minute and then hides it', () => {
    vi.useFakeTimers()
    render(<UsageLimitsCard limits={limits(100, 100)} />)

    expect(screen.getByTestId('usage-limits-card')).toBeInTheDocument()
    expect(screen.getAllByText('Осталось 100%')).toHaveLength(2)

    act(() => vi.advanceTimersByTime(60_000))

    expect(screen.queryByTestId('usage-limits-card')).not.toBeInTheDocument()
  })

  it('shows the 50% milestone temporarily', () => {
    vi.useFakeTimers()
    render(<UsageLimitsCard limits={limits(50, 82)} transientDurationMs={1_000} />)

    expect(screen.getByText('Осталось 50%')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.queryByTestId('usage-limits-card')).not.toBeInTheDocument()
  })

  it('stays visible at 10% remaining', () => {
    vi.useFakeTimers()
    render(<UsageLimitsCard limits={limits(10, 48)} />)

    expect(screen.getByText('Осталось 10%')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(120_000))

    expect(screen.getByTestId('usage-limits-card')).toBeInTheDocument()
  })

  it('keeps the weekly state when the daily limit is exhausted', () => {
    render(<UsageLimitsCard limits={limits(0, 48)} />)

    expect(screen.getByText('Дневной лимит закончился')).toBeInTheDocument()
    expect(screen.getByText('Осталось 48%')).toBeInTheDocument()
    expect(screen.getByText('Недельный лимит AI')).toBeInTheDocument()
  })
})
