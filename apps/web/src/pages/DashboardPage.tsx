import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Bookmark,
  Eye,
  Instagram,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  Video,
  Youtube,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { apiClient, buildQuery } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { fetchDashboardSummary, fetchReels, getReelThumbnailUrl } from '@/api/reels'
import { formatNumber } from '@/utils/format'
import './dashboard-realsflow.css'

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
      return { platform: parsed.platform, identifier: parsed.identifier.trim() }
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

async function fetchSocialAccountSummary(account: ConnectedSocialAccount, signal?: AbortSignal): Promise<SocialAccountSummary> {
  const query = buildQuery({ platform: account.platform, identifier: account.identifier })
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
  const viralQuery = useQuery({
    queryKey: ['dashboard', 'viral-reels'],
    queryFn: ({ signal }) => fetchReels({ sort: 'viral', page: 1, limit: 8 }, signal),
  })

  const [connectedAccount, setConnectedAccount] = useState<ConnectedSocialAccount | null>(loadConnectedSocialAccount)
  const [isConnectOpen, setConnectOpen] = useState(false)
  const [draftPlatform, setDraftPlatform] = useState<SocialPlatform>(connectedAccount?.platform ?? 'instagram')
  const [draftIdentifier, setDraftIdentifier] = useState(connectedAccount?.identifier ?? '')

  const accountQuery = useQuery({
    queryKey: ['dashboard', 'social-account', connectedAccount?.platform ?? 'none', connectedAccount?.identifier ?? ''],
    queryFn: ({ signal }) => {
      if (!connectedAccount) throw new Error('Аккаунт не подключён')
      return fetchSocialAccountSummary(connectedAccount, signal)
    },
    enabled: Boolean(connectedAccount),
    retry: 1,
  })

  const summary = summaryQuery.data
  const reels = viralQuery.data?.items ?? []
  const metrics = [
    { label: 'Конкурентов', value: summary?.competitorsCount, delta: summary?.activeJobsCount ? `${summary.activeJobsCount} обновляется` : 'активны' },
    { label: 'Найдено роликов', value: summary?.reelsCount, delta: 'в библиотеке' },
    { label: 'Идей в работе', value: summary ? summary.ideasCount + summary.scriptsCount : undefined, delta: 'на подготовке' },
    { label: 'Готово', value: summary?.readyCount, delta: 'к съёмке' },
  ]

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
    setDraftIdentifier(connectedAccount?.platform === platform ? connectedAccount.identifier : '')
    setConnectOpen(true)
  }

  const disconnectAccount = () => {
    saveConnectedSocialAccount(null)
    setConnectedAccount(null)
    setConnectOpen(false)
    setDraftIdentifier('')
  }

  const account = accountQuery.data
  const AccountPlatformIcon = (account?.platform ?? connectedAccount?.platform) === 'youtube' ? Youtube : Instagram

  return (
    <div className="rf-overview-page">
      <section className="rf-overview-head">
        <div>
          <h1>Обзор</h1>
          <p>Самое важное по вашим конкурентам и контенту</p>
        </div>
        <div className="rf-overview-head-actions">
          <Link to="/library" className="rf-overview-secondary"><Bookmark size={14} /> Библиотека</Link>
          <Link to="/competitors" className="rf-overview-primary"><Plus size={15} /> Добавить конкурента</Link>
        </div>
      </section>

      <section className="rf-overview-metrics" aria-label="Сводка">
        {metrics.map((metric, index) => (
          <article className="rf-overview-metric" style={{ animationDelay: `${index * 55}ms` }} key={metric.label}>
            <span>{metric.label}</span>
            <div><strong>{metric.value === undefined ? '—' : formatNumber(metric.value)}</strong><small>{metric.delta}</small></div>
          </article>
        ))}
      </section>

      <div className="rf-overview-grid">
        <section className="rf-overview-viral">
          <div className="rf-overview-section-head">
            <div><h2>Новые вирусные ролики</h2><p>Лучшие ролики по коэффициенту виральности</p></div>
            <Link to="/library">Все ролики <ArrowRight size={13} /></Link>
          </div>

          {viralQuery.isLoading ? (
            <div className="rf-overview-reels is-loading">Загружаем ролики…</div>
          ) : reels.length ? (
            <div className="rf-overview-reels">
              {reels.slice(0, 6).map((reel, index) => (
                <Link
                  to={`/reels/${reel.id}`}
                  className="rf-overview-reel"
                  style={{ animationDelay: `${90 + index * 55}ms` }}
                  key={reel.id}
                >
                  <div className="rf-overview-reel-media">
                    <img src={getReelThumbnailUrl(reel.id)} alt="" loading="lazy" />
                    <span className="rf-overview-platform">Reel</span>
                    <div className="rf-overview-reel-overlay">
                      <span><Eye size={11} /> {metricValue(reel.viewsCount)}</span>
                      {reel.duration ? <span>{Math.round(reel.duration)}с</span> : null}
                    </div>
                  </div>
                  <div className="rf-overview-reel-copy">
                    <strong>{reel.content.hook || reel.caption || 'Открыть разбор ролика'}</strong>
                    <span>@{reel.competitor.instagramUsername}</span>
                    {reel.viralScore ? <em>x{reel.viralScore.viewMultiplier.toFixed(1)} выше среднего</em> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rf-overview-empty">Добавь конкурента и импортируй ролики — здесь появятся самые сильные находки.</div>
          )}
        </section>

        <aside className="rf-overview-side">
          <div className="rf-overview-section-head">
            <div><h2>Активность конкурентов</h2><p>Последние сильные сигналы</p></div>
            <Link to="/competitors">Конкуренты <ArrowRight size={13} /></Link>
          </div>
          <div className="rf-overview-activity">
            {reels.slice(0, 5).map((reel, index) => (
              <Link to={`/reels/${reel.id}`} className="rf-overview-activity-row" key={reel.id}>
                <span className={reel.viralScore?.viewMultiplier && reel.viralScore.viewMultiplier >= 4 ? 'is-hot' : ''}>
                  {reel.viralScore?.viewMultiplier && reel.viralScore.viewMultiplier >= 4 ? <TrendingUp size={12} /> : <Eye size={12} />}
                </span>
                <div>
                  <strong>@{reel.competitor.instagramUsername}</strong>
                  <p>{reel.viralScore?.label ?? 'Новый ролик в библиотеке'}</p>
                  <small>{reel.viralScore ? `x${reel.viralScore.viewMultiplier.toFixed(1)}` : metricValue(reel.viewsCount)} · #{index + 1}</small>
                </div>
              </Link>
            ))}
            {!reels.length ? <div className="rf-overview-side-empty">Пока нет новых событий.</div> : null}
          </div>

          <div className="rf-overview-quick">
            <span>Быстрые действия</span>
            <div>
              <Link to="/competitors"><Users size={15} /> Конкурент</Link>
              <Link to="/library"><Bookmark size={15} /> Импорт ролика</Link>
              <Link to="/ideas"><Plus size={15} /> Новая идея</Link>
            </div>
          </div>
        </aside>
      </div>

      <section className="rf-own-account" aria-labelledby="rf-own-account-title">
        <div className="rf-own-account-heading">
          <div>
            <span>Мои сервисы</span>
            <h2 id="rf-own-account-title">Свой аккаунт</h2>
            <p>Подключи Instagram или YouTube и держи главные показатели рядом с контентом конкурентов.</p>
          </div>
          {connectedAccount ? (
            <div className="rf-own-account-actions">
              <button type="button" onClick={() => accountQuery.refetch()} aria-label="Обновить статистику"><RefreshCw size={16} className={accountQuery.isFetching ? 'is-spinning' : ''} /></button>
              <button type="button" onClick={() => openConnect(connectedAccount.platform)}>Изменить</button>
              <button type="button" className="is-muted" onClick={disconnectAccount}>Отключить</button>
            </div>
          ) : null}
        </div>

        {!connectedAccount || isConnectOpen ? (
          <form className="rf-own-account-connect" onSubmit={handleConnect}>
            <div className="rf-own-account-platforms">
              <button type="button" className={draftPlatform === 'instagram' ? 'is-active' : ''} onClick={() => setDraftPlatform('instagram')}><Instagram size={16} /> Instagram</button>
              <button type="button" className={draftPlatform === 'youtube' ? 'is-active' : ''} onClick={() => setDraftPlatform('youtube')}><Youtube size={17} /> YouTube</button>
            </div>
            <label>
              <span>{draftPlatform === 'instagram' ? 'Username или ссылка на профиль' : '@handle, Channel ID или ссылка на канал'}</span>
              <div><input value={draftIdentifier} onChange={(event) => setDraftIdentifier(event.target.value)} placeholder={draftPlatform === 'instagram' ? '@username' : 'youtube.com/@channel'} required /><button type="submit">Подключить</button></div>
            </label>
            {connectedAccount ? <button type="button" className="rf-own-account-cancel" onClick={() => setConnectOpen(false)}>Отмена</button> : null}
          </form>
        ) : accountQuery.isError ? (
          <div className="rf-own-account-error"><div><strong>Не удалось обновить статистику</strong><span>Проверь аккаунт или ссылку и попробуй ещё раз.</span></div><button type="button" onClick={() => accountQuery.refetch()}>Повторить</button></div>
        ) : (
          <div className="rf-own-account-summary">
            <div className="rf-own-account-profile">
              <div className="rf-own-account-avatar">{account?.avatarUrl ? <img src={account.avatarUrl} alt="" /> : <AccountPlatformIcon size={22} />}</div>
              <div><span><AccountPlatformIcon size={13} />{(account?.platform ?? connectedAccount.platform) === 'youtube' ? 'YouTube' : 'Instagram'}</span><strong>{account?.displayName ?? connectedAccount.identifier}</strong><small>{account?.identifier ?? connectedAccount.identifier}</small></div>
            </div>
            <div className="rf-own-account-metrics">
              <article><span><Eye size={16} /> Просмотры</span><strong>{metricValue(account?.views)}</strong><small>{account?.viewsLabel ?? 'Обновляем данные'}</small></article>
              <article><span><Users size={16} /> Подписчики</span><strong>{metricValue(account?.subscribers)}</strong><small>Сейчас</small></article>
              <article><span><Video size={16} /> Публикации</span><strong>{metricValue(account?.publications)}</strong><small>Всего</small></article>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
