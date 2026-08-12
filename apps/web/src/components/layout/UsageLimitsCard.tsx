import { useEffect, useMemo, useState } from 'react'

import { useLanguage } from '@/i18n/LanguageProvider'
import type { AppLanguage } from '@/types/creatorProfile'

type LimitKind = 'daily' | 'weekly'

export interface UsageLimitValue {
  remainingPercent: number
  resetAt: string
}

export interface UsageLimitsState {
  daily: UsageLimitValue
  weekly: UsageLimitValue
}

interface UsageLimitsCardProps {
  limits?: UsageLimitsState
  transientDurationMs?: number
  upgradeHref?: string
  creditsHref?: string
}

const STORAGE_KEY = 'reelsfinder:usage-limits'
const UPDATE_EVENT = 'reelsfinder:usage-limits-updated'
const NOTICE_PREFIX = 'reelsfinder:usage-limit-notice:'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function nextLocalMidnight(): string {
  const next = new Date()
  next.setHours(24, 0, 0, 0)
  return next.toISOString()
}

function nextLocalWeek(): string {
  const next = new Date()
  const daysUntilMonday = ((8 - next.getDay()) % 7) || 7
  next.setDate(next.getDate() + daysUntilMonday)
  next.setHours(0, 0, 0, 0)
  return next.toISOString()
}

export function createDefaultUsageLimits(): UsageLimitsState {
  return {
    daily: { remainingPercent: 100, resetAt: nextLocalMidnight() },
    weekly: { remainingPercent: 100, resetAt: nextLocalWeek() },
  }
}

function normalizeLimits(value: UsageLimitsState): UsageLimitsState {
  return {
    daily: {
      remainingPercent: clampPercent(value.daily.remainingPercent),
      resetAt: value.daily.resetAt,
    },
    weekly: {
      remainingPercent: clampPercent(value.weekly.remainingPercent),
      resetAt: value.weekly.resetAt,
    },
  }
}

function readStoredLimits(): UsageLimitsState {
  if (typeof window === 'undefined') return createDefaultUsageLimits()

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return createDefaultUsageLimits()

  try {
    const parsed = JSON.parse(raw) as UsageLimitsState
    if (!parsed.daily?.resetAt || !parsed.weekly?.resetAt) return createDefaultUsageLimits()
    return normalizeLimits(parsed)
  } catch {
    return createDefaultUsageLimits()
  }
}

export function setUsageLimits(next: UsageLimitsState): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeLimits(next)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: normalized }))
}

function useStoredUsageLimits(): UsageLimitsState {
  const [limits, setLimits] = useState<UsageLimitsState>(() => readStoredLimits())

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLimits(readStoredLimits())
    }
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<UsageLimitsState>).detail
      setLimits(detail ? normalizeLimits(detail) : readStoredLimits())
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(UPDATE_EVENT, onUpdate)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(UPDATE_EVENT, onUpdate)
    }
  }, [])

  return limits
}

function noticeStorageKey(kind: LimitKind, resetAt: string, milestone: 100 | 50): string {
  return `${NOTICE_PREFIX}${kind}:${resetAt}:${milestone}`
}

function hasSeenNotice(kind: LimitKind, resetAt: string, milestone: 100 | 50): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(noticeStorageKey(kind, resetAt, milestone)) === '1'
}

function markNoticeSeen(kind: LimitKind, resetAt: string, milestone: 100 | 50): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(noticeStorageKey(kind, resetAt, milestone), '1')
}

function getTransientMilestones(limits: UsageLimitsState): Array<{ kind: LimitKind; milestone: 100 | 50 }> {
  const result: Array<{ kind: LimitKind; milestone: 100 | 50 }> = []

  ;(['daily', 'weekly'] as const).forEach((kind) => {
    const limit = limits[kind]
    if (limit.remainingPercent === 100 && !hasSeenNotice(kind, limit.resetAt, 100)) {
      result.push({ kind, milestone: 100 })
      return
    }
    if (
      limit.remainingPercent <= 50 &&
      limit.remainingPercent > 10 &&
      !hasSeenNotice(kind, limit.resetAt, 50)
    ) {
      result.push({ kind, milestone: 50 })
    }
  })

  return result
}

function isSameLocalDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

function formatReset(
  kind: LimitKind,
  resetAt: string,
  language: AppLanguage,
  locale: 'ru-RU' | 'en-US',
): string {
  const reset = new Date(resetAt)
  if (Number.isNaN(reset.getTime())) {
    return language === 'en' ? 'Reset time unavailable' : 'Время обновления уточняется'
  }

  const now = new Date()
  const time = reset.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  if (kind === 'daily') {
    if (isSameLocalDay(reset, now)) {
      return language === 'en' ? `Resets today at ${time}` : `Обновится сегодня в ${time}`
    }

    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    if (isSameLocalDay(reset, tomorrow)) {
      return language === 'en' ? `Resets tomorrow at ${time}` : `Обновится завтра в ${time}`
    }

    const date = reset.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    return language === 'en' ? `Resets ${date}` : `Обновится ${date}`
  }

  const days = Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 86_400_000))
  if (language === 'en') {
    if (days === 1) return 'Resets tomorrow'
    if (days < 7) return `Resets in ${days} days`
    return `Resets ${reset.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`
  }

  if (days === 1) return 'Обновится завтра'
  if (days >= 2 && days <= 4) return `Обновится через ${days} дня`
  if (days < 7) return `Обновится через ${days} дней`
  return `Обновится ${reset.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`
}

function LimitRow({
  kind,
  value,
  language,
  locale,
}: {
  kind: LimitKind
  value: UsageLimitValue
  language: AppLanguage
  locale: 'ru-RU' | 'en-US'
}) {
  const remaining = clampPercent(value.remainingPercent)
  const exhausted = remaining === 0
  const title =
    language === 'en'
      ? kind === 'daily' ? 'Daily AI limit' : 'Weekly AI limit'
      : kind === 'daily' ? 'Дневной лимит AI' : 'Недельный лимит AI'
  const exhaustedTitle =
    language === 'en'
      ? `${kind === 'daily' ? 'Daily' : 'Weekly'} limit reached`
      : `${kind === 'daily' ? 'Дневной' : 'Недельный'} лимит закончился`

  return (
    <div className={`rf-limit-row ${exhausted ? 'is-exhausted' : ''}`}>
      <div className="rf-limit-heading">
        <span>{exhausted ? exhaustedTitle : title}</span>
        {!exhausted ? <strong>{language === 'en' ? `${remaining}% left` : `Осталось ${remaining}%`}</strong> : null}
      </div>
      <div
        className="rf-limit-track"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={remaining}
      >
        <span style={{ width: `${remaining}%` }} />
      </div>
      <small>{formatReset(kind, value.resetAt, language, locale)}</small>
    </div>
  )
}

export function UsageLimitsCard({
  limits: controlledLimits,
  transientDurationMs = 60_000,
  upgradeHref = '/#pricing',
  creditsHref = '/#pricing',
}: UsageLimitsCardProps) {
  const { language, locale } = useLanguage()
  const storedLimits = useStoredUsageLimits()
  const limits = useMemo(
    () => normalizeLimits(controlledLimits ?? storedLimits),
    [controlledLimits, storedLimits],
  )
  const persistent = limits.daily.remainingPercent <= 10 || limits.weekly.remainingPercent <= 10
  const [visible, setVisible] = useState(persistent)

  useEffect(() => {
    if (persistent) {
      setVisible(true)
      return
    }

    const milestones = getTransientMilestones(limits)
    if (milestones.length === 0) {
      setVisible(false)
      return
    }

    milestones.forEach(({ kind, milestone }) => markNoticeSeen(kind, limits[kind].resetAt, milestone))
    setVisible(true)
    const timeout = window.setTimeout(() => setVisible(false), transientDurationMs)
    return () => window.clearTimeout(timeout)
  }, [limits, persistent, transientDurationMs])

  if (!visible) return null

  return (
    <aside className="rf-usage-card" data-testid="usage-limits-card" aria-label={language === 'en' ? 'AI limits' : 'Лимиты AI'}>
      <div className="rf-usage-title">
        <strong>{language === 'en' ? 'AI limits' : 'Лимиты AI'}</strong>
        <span>{language === 'en' ? 'Remaining' : 'Сколько осталось'}</span>
      </div>

      <LimitRow kind="daily" value={limits.daily} language={language} locale={locale} />
      <LimitRow kind="weekly" value={limits.weekly} language={language} locale={locale} />

      <div className="rf-usage-actions">
        <a className="rf-upgrade-button" href={upgradeHref}>{language === 'en' ? 'Upgrade to PRO' : 'Перейти на PRO'}</a>
        <a className="rf-credits-button" href={creditsHref}>{language === 'en' ? 'Buy credits' : 'Докупить кредиты'}</a>
      </div>
    </aside>
  )
}
