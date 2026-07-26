import { describe, expect, it } from 'vitest'

import {
  EMPTY_VALUE,
  formatCompactNumber,
  formatDate,
  formatDuration,
  formatNumber,
  truncate,
} from './format'

describe('formatCompactNumber', () => {
  it.each([
    [1200, '1,2 тыс.'],
    [1_500_000, '1,5 млн'],
    [999, '999'],
    [0, '0'],
  ])('formats %s', (input, expected) => {
    // Intl uses a non-breaking space; normalize it for a stable assertion.
    expect(formatCompactNumber(input).replace(/\u00a0/g, ' ')).toBe(expected)
  })

  it('never turns an unknown value into zero', () => {
    expect(formatCompactNumber(null)).toBe(EMPTY_VALUE)
    expect(formatCompactNumber(undefined)).toBe(EMPTY_VALUE)
  })
})

describe('formatNumber', () => {
  it('groups digits in the ru locale', () => {
    expect(formatNumber(1234567).replace(/\u00a0/g, ' ')).toBe('1 234 567')
  })

  it('returns an em dash for null', () => {
    expect(formatNumber(null)).toBe(EMPTY_VALUE)
  })
})

describe('formatDuration', () => {
  it.each([
    [28.5, '0:29'],
    [0, '0:00'],
    [61, '1:01'],
    [125, '2:05'],
  ])('formats %s seconds', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })

  it('returns an em dash for null or negative input', () => {
    expect(formatDuration(null)).toBe(EMPTY_VALUE)
    expect(formatDuration(-5)).toBe(EMPTY_VALUE)
  })
})

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-07-20T10:00:00Z')).toContain('2026')
  })

  it('handles null and invalid input', () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE)
    expect(formatDate('not-a-date')).toBe(EMPTY_VALUE)
  })
})

describe('truncate', () => {
  it('keeps short text unchanged', () => {
    expect(truncate('короткий', 20)).toBe('короткий')
  })

  it('adds an ellipsis to long text', () => {
    expect(truncate('a'.repeat(30), 10)).toBe(`${'a'.repeat(10)}…`)
  })

  it('returns an empty string for null', () => {
    expect(truncate(null, 10)).toBe('')
  })
})
