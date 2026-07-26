/** Display helpers. Unknown values render as an em dash, never as zero. */

export const EMPTY_VALUE = '—'

const compactFormatter = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** 1200 → "1,2 тыс."; null → "—". */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE
  return compactFormatter.format(value)
}

/** Full number with thin spaces, e.g. "1 234 567". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return dateFormatter.format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return dateTimeFormatter.format(date)
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
