/** Display helpers. Unknown values render as an em dash, never as zero. */

import { getAppLocale } from '@/i18n/LanguageProvider'

export const EMPTY_VALUE = '—'

/** 1200 → compact locale-specific number; null → "—". */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE
  return new Intl.NumberFormat(getAppLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Full locale-specific number. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE
  return new Intl.NumberFormat(getAppLocale()).format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return new Intl.DateTimeFormat(getAppLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return new Intl.DateTimeFormat(getAppLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** 28.5 → "0:29" (seconds are rounded to the nearest whole). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
    return EMPTY_VALUE
  }
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** Short preview of a long text, used on cards. */
export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return ''
  const clean = text.trim()
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength).trimEnd()}…`
}
