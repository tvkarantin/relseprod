import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { fetchDashboardSummary } from '@/api/reels'
import { ErrorState } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatNumber } from '@/utils/format'

const CARDS = [
  { key: 'competitorsCount', label: 'Конкуренты' },
  { key: 'reelsCount', label: 'Импортировано рилсов' },
  { key: 'ideasCount', label: 'Идеи' },
  { key: 'scriptsCount', label: 'Сценарии' },
  { key: 'readyCount', label: 'Готовы к съёмке' },
  { key: 'activeJobsCount', label: 'Активные импорты' },
] as const

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  })

  return (
    <div className="page-content">
      <PageHeader
        title="Обзор"
        description="Реальные счётчики по вашей локальной базе"
      />

      {summaryQuery.isError ? (
        <ErrorState error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      ) : (
        <div className="summary-grid">
          {CARDS.map((card) => (
            <div className="surface summary-card" key={card.key}>
              <span>{card.label}</span>
              <strong>
                {summaryQuery.isLoading ? '…' : formatNumber(summaryQuery.data?.[card.key] ?? 0)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Быстрые действия</h2>
      <div className="quick-actions">
        <Link to="/competitors" className="button button-primary">
          Добавить конкурента
        </Link>
        <Link to="/reels" className="button">
          Открыть библиотеку
        </Link>
        <Link to="/my-reels" className="button">
          Мои рилсы
        </Link>
      </div>
    </div>
  )
}
