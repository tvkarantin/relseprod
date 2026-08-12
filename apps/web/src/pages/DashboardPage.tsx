import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Clapperboard,
  Eye,
  FileText,
  Instagram,
  Lightbulb,
  Plus,
  RefreshCw,
  Send,
  Users,
  Video,
  Youtube,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import { apiClient, buildQuery } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { fetchAllMyReels, fetchDashboardSummary } from '@/api/reels'
import { formatNumber } from '@/utils/format'
import './dashboard-realsflow.css'
import './dashboard-account.css'

type SocialPlatform = 'instagram' | 'youtube'

interface ConnectedSocialAccount {
  platform: SocialPlatform
  identifier: string
}

interface SocialAccountSummary {
  platform: SocialPlatform
  identifier: string
  displayName: string
  avatarUrl: string | null
  views: number | null
  subscribers: number | null
  publications: number | null
  viewsLabel: string
  updatedAt: string
}

const SOCIAL_ACCOUNT_STORAGE_KEY = 'realsflow:connected-social-account:v1'

function setSpotlight(event: ReactPointerEvent<HTMLElement>) {
  const element = event.currentTarget
  const rect = element.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100
  element.style.setProperty('--glow-x', `${x.toFixed(1)}%`)
  element.style.setProperty('--glow-y', `${y.toFixed(1)}%`)
}

function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article
      className={`rf-spotlight-card ${className}`}
      onPointerMove={setSpotlight}
    >
      {children}
    </article>
  )
}

function TypeName({ value }: { value: string }) {
  const [visible, setVisible] = useState('')

  useEffect(() => {
    let index = 0
    setVisible('')
    const timer = window.setInterval(() => {
      index += 1
      setVisible(value.slice(0, index))
      if (index >= value.length) window.clearInterval(timer)
    }, 120)
    return () => window.clearInterval(timer)
  }, [value])

  return (
    <span className="rf-typed-name">
      {visible}
      <i aria-hidden="true" />
    </span>
  )
}

function getGreeting(hour: number) {
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function formatToday(date: Date) {
  const label = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function loadConnectedSocialAccount(): ConnectedSocialAccount | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SOCIAL_ACCOUNT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConnectedSocialAccount>
    if (
      (parsed.platform === 'instagram' || parsed.platform === 'youtube') &&
      typeof parsed.identifier === 'string' &&
      parsed.identifier.trim()
    ) {
      return {
        platform: parsed.platform,
        identifier: parsed.identifier.trim(),
      }
    }
  } catch {
    return null
  }
  return null
}

function saveConnectedSocialAccount(account: ConnectedSocialAccount | null) {
  if (typeof window === 'undefined') return
  if (!account) {
    window.localStorage.removeItem(SOCIAL_ACCOUNT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(SOCIAL_ACCOUNT_STORAGE_KEY, JSON.stringify(account))
}

async function fetchSocialAccountSummary(
  account: ConnectedSocialAccount,
  signal?: AbortSignal,
): Promise<SocialAccountSummary> {
  const query = buildQuery({
    platform: account.platform,
    identifier: account.identifier,
  })
  return apiClient.get<SocialAccountSummary>(`/dashboard/social-account${query}`, signal)
}

function metricValue(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : formatNumber(value)
}

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  })
  const contentPlanQuery = useQuery({
    queryKey: queryKeys.reels.contentPlan(),
    queryFn: ({ signal }) => fetchAllMyReels(signal),
  })

  const [connectedAccount, setConnectedAccount] = useState<ConnectedSocialAccount | null>(
    loadConnectedSocialAccount,
  )
  const [isConnectOpen, setConnectOpen] = useState(false)
  const [draftPlatform, setDraftPlatform] = useState<SocialPlatform>(
    connectedAccount?.platform ?? 'instagram',
  )
  const [draftIdentifier, setDraftIdentifier] = useState(connectedAccount?.identifier ?? '')

  const accountQuery = useQuery({
    queryKey: [
      'dashboard',
      'social-account',
      connectedAccount?.platform ?? 'none',
      connectedAccount?.identifier ?? '',
    ],
    queryFn: ({ signal }) => {
      if (!connectedAccount) throw new Error('Аккаунт не подключён')
      return fetchSocialAccountSummary(connectedAccount, signal)
    },
    enabled: Boolean(connectedAccount),
    retry: 1,
  })

  const summary = summaryQuery.data
  const publishedCount = useMemo(
    () =>
      contentPlanQuery.data?.filter(
        (reel) => reel.content.contentStatus === 'published',
      ).length,
    [contentPlanQuery.data],
  )

  const stats = useMemo(
    () => [
      {
        label: 'Новые идеи',
        value: summary?.ideasCount,
        note: 'В ленте идей',
        icon: Lightbulb,
      },
      {
        label: 'Сценарии',
        value: summary?.scriptsCount,
        note: 'В работе',
        icon: FileText,
      },
      {
        label: 'Готово к съёмке',
        value: summary?.readyCount,
        note: 'Готовы к следующему шагу',
        icon: Clapperboard,
      },
      {
        label: 'Опубликовано',
        value: publishedCount,
        note: 'В контент-плане',
        icon: Send,
      },
    ],
    [publishedCount, summary],
  )

  const handleConnect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const identifier = draftIdentifier.trim()
    if (!identifier) return
    const nextAccount = { platform: draftPlatform, identifier }
    saveConnectedSocialAccount(nextAccount)
    setConnectedAccount(nextAccount)
    setConnectOpen(false)
  }

  const openConnect = (platform: SocialPlatform) => {
    setDraftPlatform(platform)
    setDraftIdentifier(
      connectedAccount?.platform === platform ? connectedAccount.identifier : '',
    )
    setConnectOpen(true)
  }

  const disconnectAccount = () => {
    saveConnectedSocialAccount(null)
    setConnectedAccount(null)
    setConnectOpen(false)
    setDraftIdentifier('')
  }

  const now = new Date()
  const account = accountQuery.data
  const AccountPlatformIcon =
    (account?.platform ?? connectedAccount?.platform) === 'youtube' ? Youtube : Instagram

  return (
    <div className="rf-dashboard-page">
      <section className="rf-hero">
        <div className="rf-hero-copy">
          <div className="rf-day-chip">
            <span>☀</span>
            <strong>{formatToday(now)}</strong>
            <i />
            Хорошего дня!
          </div>
          <h1>
            {getGreeting(now.getHours())},
            <br />
            <TypeName value="Андрей" />
          </h1>
          <p>
            RealsFlow помогает управлять идеями, сценариями
            <br className="rf-desktop-break" /> и контентом — от задумки до публикации.
          </p>
          <div className="rf-hero-actions">
            <Link to="/ideas" className="rf-primary-button">
              <Plus size={19} /> Создать сценарий
            </Link>
            <Link to="/library" className="rf-secondary-button">
              <BookOpen size={19} /> Открыть библиотеку
            </Link>
          </div>
        </div>

        <div
          className="rf-story-stack"
          aria-label="Анимированная схема от идеи к рилсу"
          onPointerMove={setSpotlight}
        >
          <div className="rf-orbit-line" />
          <div className="rf-story-card rf-story-card-back">
            <span>контент</span>
          </div>
          <div className="rf-story-card rf-story-card-mid">
            <span>сценарий</span>
          </div>
          <div className="rf-story-card rf-story-card-front">
            <div className="rf-play">▶</div>
            <em>Идея</em>
            <b>→ сценарий</b>
            <b>→ рилс</b>
          </div>
          <div className="rf-spark">✦</div>
        </div>
      </section>

      <section className="rf-stat-grid" aria-label="Сводка">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <SpotlightCard key={label} className="rf-stat-card">
            <div className="rf-stat-top">
              <Icon size={21} />
              <span>{label}</span>
            </div>
            <strong>{value === undefined ? '—' : formatNumber(value)}</strong>
            <small>{note}</small>
          </SpotlightCard>
        ))}
      </section>

      <section className="rf-account-section" aria-labelledby="rf-account-title">
        <div className="rf-account-heading">
          <div>
            <span className="rf-account-kicker">Аналитика</span>
            <h2 id="rf-account-title">Ваш аккаунт</h2>
            <p>Подключи Instagram или YouTube и смотри главные цифры без лишних отчётов.</p>
          </div>

          {connectedAccount ? (
            <div className="rf-account-actions">
              <button
                type="button"
                className="rf-account-icon-button"
                onClick={() => accountQuery.refetch()}
                aria-label="Обновить статистику"
                title="Обновить"
              >
                <RefreshCw size={17} className={accountQuery.isFetching ? 'is-spinning' : ''} />
              </button>
              <button
                type="button"
                className="rf-account-text-button"
                onClick={() => openConnect(connectedAccount.platform)}
              >
                Изменить
              </button>
              <button
                type="button"
                className="rf-account-text-button is-muted"
                onClick={disconnectAccount}
              >
                Отключить
              </button>
            </div>
          ) : null}
        </div>

        {!connectedAccount || isConnectOpen ? (
          <form className="rf-account-connect" onSubmit={handleConnect}>
            <div className="rf-account-platforms" aria-label="Платформа">
              <button
                type="button"
                className={`rf-account-platform ${draftPlatform === 'instagram' ? 'is-active' : ''}`}
                onClick={() => setDraftPlatform('instagram')}
              >
                <Instagram size={18} />
                Instagram
              </button>
              <button
                type="button"
                className={`rf-account-platform ${draftPlatform === 'youtube' ? 'is-active' : ''}`}
                onClick={() => setDraftPlatform('youtube')}
              >
                <Youtube size={19} />
                YouTube
              </button>
            </div>

            <label className="rf-account-input">
              <span>
                {draftPlatform === 'instagram'
                  ? 'Username или ссылка на профиль'
                  : '@handle, Channel ID или ссылка на канал'}
              </span>
              <div>
                <input
                  value={draftIdentifier}
                  onChange={(event) => setDraftIdentifier(event.target.value)}
                  placeholder={
                    draftPlatform === 'instagram'
                      ? '@username'
                      : '@channel или youtube.com/@channel'
                  }
                  autoComplete="off"
                  required
                />
                <button type="submit">Подключить</button>
              </div>
            </label>

            {connectedAccount ? (
              <button
                type="button"
                className="rf-account-cancel"
                onClick={() => setConnectOpen(false)}
              >
                Отмена
              </button>
            ) : null}
          </form>
        ) : accountQuery.isError ? (
          <div className="rf-account-error" role="alert">
            <div>
              <strong>Не удалось обновить статистику</strong>
              <span>Проверь аккаунт или ссылку и попробуй ещё раз.</span>
            </div>
            <button type="button" onClick={() => accountQuery.refetch()}>
              Повторить
            </button>
          </div>
        ) : (
          <div className="rf-account-summary">
            <div className="rf-account-profile">
              <div className="rf-account-avatar">
                {account?.avatarUrl ? (
                  <img src={account.avatarUrl} alt="" />
                ) : (
                  <AccountPlatformIcon size={23} aria-hidden="true" />
                )}
              </div>
              <div>
                <span className="rf-account-platform-label">
                  <AccountPlatformIcon size={14} />
                  {(account?.platform ?? connectedAccount.platform) === 'youtube'
                    ? 'YouTube'
                    : 'Instagram'}
                </span>
                <strong>
                  {account?.displayName ??
                    (accountQuery.isLoading ? 'Загружаем аккаунт…' : connectedAccount.identifier)}
                </strong>
                <small>{account?.identifier ?? connectedAccount.identifier}</small>
              </div>
            </div>

            <div className="rf-account-metrics" aria-label="Статистика аккаунта">
              <article className="rf-account-metric">
                <span><Eye size={18} /> Просмотры</span>
                <strong>{metricValue(account?.views)}</strong>
                <small>{account?.viewsLabel ?? 'Обновляем данные'}</small>
              </article>
              <article className="rf-account-metric">
                <span><Users size={18} /> Подписчики</span>
                <strong>{metricValue(account?.subscribers)}</strong>
                <small>Сейчас</small>
              </article>
              <article className="rf-account-metric">
                <span><Video size={18} /> Публикации</span>
                <strong>{metricValue(account?.publications)}</strong>
                <small>Всего на аккаунте</small>
              </article>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
