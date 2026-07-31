import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { fetchDashboardSummary } from '@/api/reels'
import { formatNumber } from '@/utils/format'

const CARDS = [
  {
    key: 'competitorsCount',
    label: 'Конкуренты',
    icon: '/assets/overview-icon-competitors.png',
    line: '2,35 20,38 38,30 56,34 74,16 92,25 110,29',
  },
  {
    key: 'reelsCount',
    label: 'Импортировано рилсов',
    icon: '/assets/overview-icon-imported.png',
    line: '2,37 20,32 38,30 55,19 73,29 92,9 110,15',
  },
  {
    key: 'ideasCount',
    label: 'Идеи',
    icon: '/assets/overview-icon-ideas.png',
    line: '2,37 20,31 38,35 55,21 73,30 91,8 110,14',
  },
  {
    key: 'scriptsCount',
    label: 'Сценарии',
    icon: '/assets/overview-icon-scripts.png',
    line: '2,37 20,29 38,30 55,15 73,23 92,9 110,7',
  },
  {
    key: 'readyCount',
    label: 'Готово к съёмке',
    icon: '/assets/overview-icon-ready.png',
    line: '2,37 20,31 38,35 55,19 73,29 91,6 110,13',
  },
  {
    key: 'activeJobsCount',
    label: 'Активные импорты',
    icon: '/assets/overview-icon-imports.png',
    line: '2,37 20,31 38,34 55,22 73,29 91,7 110,14',
  },
] as const

const QUICK_ACTIONS = [
  {
    to: '/reels?import=competitor',
    title: 'Добавить конкурента',
    description: 'Добавьте Instagram-аккаунт конкурента и импортируйте его рилсы в пару кликов.',
    image: '/assets/overview-add-competitor.png',
    className: 'is-competitor',
  },
  {
    to: '/reels',
    title: 'Открыть библиотеку',
    description: 'Просматривайте, фильтруйте и анализируйте рилсы конкурентов в единой библиотеке.',
    image: '/assets/overview-library.png',
    className: 'is-library',
  },
  {
    to: '/my-reels',
    title: 'Мои рилсы',
    description: 'Управляйте своими сценариями, отслеживайте статусы и готовьтесь к съёмке контента.',
    image: '/assets/overview-my-reels.png',
    className: 'is-my-reels',
  },
] as const

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  )
}

function ActivityIcon({ kind }: { kind: 'complete' | 'search' | 'saved' }) {
  if (kind === 'complete') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    )
  }

  if (kind === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4 4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 12h5M10 16h4" />
    </svg>
  )
}

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  })

  return (
    <div className="page-content dashboard-page">
      <section className="dashboard-summary" aria-label="Сводка">
        {CARDS.map((card) => (
          <article className="dashboard-stat-card" key={card.key}>
            <div className="dashboard-stat-icon" aria-hidden="true">
              <img src={card.icon} alt="" />
            </div>
            <span>{card.label}</span>
            <strong>
              {summaryQuery.isLoading
                ? '—'
                : formatNumber(summaryQuery.data?.[card.key] ?? 0)}
            </strong>
            <svg className="dashboard-sparkline" viewBox="0 0 112 42" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={card.line} />
            </svg>
          </article>
        ))}
      </section>

      <section className="dashboard-section" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title">Быстрые действия</h2>
        <div className="dashboard-action-grid">
          {QUICK_ACTIONS.map((action) => (
            <Link
              to={action.to}
              className={`dashboard-action-card ${action.className}`}
              key={action.title}
            >
              <div className="dashboard-action-art" aria-hidden="true">
                <img src={action.image} alt="" />
              </div>
              <div className="dashboard-action-copy">
                <strong>{action.title}</strong>
                <p>{action.description}</p>
              </div>
              <span className="dashboard-action-arrow" aria-hidden="true">
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-section dashboard-activity-section" aria-labelledby="activity-title">
        <h2 id="activity-title">Последняя активность</h2>
        <div className="dashboard-activity">
          <article className="dashboard-activity-item">
            <span className="dashboard-activity-icon"><ActivityIcon kind="complete" /></span>
            <div className="dashboard-activity-copy">
              <div><strong>Импорт завершён</strong><time>только что</time></div>
              <p>@nick_saraev: добавлено 20 рилсов</p>
            </div>
          </article>
          <article className="dashboard-activity-item">
            <span className="dashboard-activity-icon"><ActivityIcon kind="search" /></span>
            <div className="dashboard-activity-copy">
              <div><strong>Новые рилсы найдены</strong><time>5 мин назад</time></div>
              <p>У конкурента @ai.creators найдено 12 новых рилсов</p>
            </div>
          </article>
          <article className="dashboard-activity-item">
            <span className="dashboard-activity-icon"><ActivityIcon kind="saved" /></span>
            <div className="dashboard-activity-copy">
              <div><strong>Сценарий сохранён</strong><time>12 мин назад</time></div>
              <p>Черновик для reels “AI-инструменты” успешно сохранён</p>
            </div>
          </article>
        </div>
      </section>

      <footer className="dashboard-status">
        <span className="dashboard-updated" aria-hidden="true">⟳</span>
        <span>Обновлено сегодня в 12:30</span>
        <i aria-hidden="true" />
        <span className="dashboard-saved-check" aria-hidden="true">✓</span>
        <span>Все данные сохранены</span>
        {summaryQuery.isError ? (
          <button type="button" onClick={() => void summaryQuery.refetch()}>
            Не удалось обновить · Повторить
          </button>
        ) : null}
      </footer>
    </div>
  )
}
