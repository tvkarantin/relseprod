import { useQuery } from '@tanstack/react-query'
import { Download, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { fetchCompetitors } from '@/api/competitors'
import { queryKeys } from '@/api/queryKeys'
import { fetchReels } from '@/api/reels'
import { ImportCompetitorDialog } from '@/components/competitors/ImportCompetitorDialog'
import { ReelsEmptyState } from '@/components/feedback/ReelsEmptyState'
import { ErrorState, ReelCardSkeletons } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReelCard } from '@/components/reels/ReelCard'
import { ReelFilters } from '@/components/reels/ReelFilters'
import { Pagination } from '@/components/ui/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const DEFAULT_PAGE_SIZE = 8
const PAGE_SIZES = [8, 20, 40] as const
const SEARCH_DEBOUNCE_MS = 400

const CATEGORIES = [
  { key: 'all', label: 'Все' },
  { key: 'trends', label: 'Тренды' },
  { key: 'ai', label: 'AI' },
  { key: 'sales', label: 'Продажи' },
  { key: 'editing', label: 'Монтаж' },
  { key: 'script', label: 'Сценарии' },
] as const

type CategoryKey = (typeof CATEGORIES)[number]['key']

function getReelCategory(reel: { caption: string | null }): CategoryKey {
  const caption = (reel.caption ?? '').toLowerCase()
  if (caption.includes('ai') || caption.includes('искусственн')) return 'ai'
  if (caption.includes('тренд') || caption.includes('переход')) return 'trends'
  if (caption.includes('продаж') || caption.includes('заработ') || caption.includes('10k')) return 'sales'
  if (caption.includes('монтаж')) return 'editing'
  if (caption.includes('сценарий') || caption.includes('формул') || caption.includes('хук')) return 'script'
  return 'all'
}

export function ReelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isImportOpen, setImportOpen] = useState(
    () => searchParams.get('import') === 'competitor',
  )

  const urlSearch = searchParams.get('search') ?? ''
  const urlCompetitorId = Number(searchParams.get('competitor_id')) || null
  const urlPage = Math.max(1, Number(searchParams.get('page')) || 1)
  const urlSort = searchParams.get('sort') ?? 'views'
  const urlCategory = (searchParams.get('category') ?? 'all') as CategoryKey
  const urlView = (searchParams.get('view') ?? 'grid') as 'grid' | 'list'
  const requestedPageSize = Number(searchParams.get('limit'))
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE

  const [searchInput, setSearchInput] = useState(urlSearch)
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)

  useEffect(() => setSearchInput(urlSearch), [urlSearch])

  useEffect(() => {
    if (debouncedSearch === urlSearch) return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (debouncedSearch.trim()) next.set('search', debouncedSearch.trim())
        else next.delete('search')
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [debouncedSearch, urlSearch, setSearchParams])

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      mutate(next)
      return next
    })
  }

  const closeImportDialog = () => {
    setImportOpen(false)
    if (searchParams.get('import') !== 'competitor') return

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('import')
        return next
      },
      { replace: true },
    )
  }

  const competitorsQuery = useQuery({
    queryKey: queryKeys.competitors.list(),
    queryFn: ({ signal }) => fetchCompetitors(signal),
  })

  const query = { competitorId: urlCompetitorId, search: urlSearch, page: urlPage, limit: pageSize }
  const reelsQuery = useQuery({
    queryKey: queryKeys.reels.list(query),
    queryFn: ({ signal }) => fetchReels(query, signal),
    placeholderData: (previous) => previous,
  })

  const page = reelsQuery.data
  const hasFilters = Boolean(urlSearch || urlCompetitorId || urlCategory !== 'all')

  let displayedItems = page?.items ?? []

  if (urlCategory !== 'all') {
    displayedItems = displayedItems.filter((reel) => getReelCategory(reel) === urlCategory)
  }

  if (urlSort === 'views') {
    displayedItems = [...displayedItems].sort((a, b) => (b.viewsCount ?? 0) - (a.viewsCount ?? 0))
  } else if (urlSort === 'likes') {
    displayedItems = [...displayedItems].sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
  } else if (urlSort === 'date') {
    displayedItems = [...displayedItems].sort(
      (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
    )
  }

  return (
    <div className="page-content">
      <PageHeader
        title="Библиотека рилсов"
        description="Импортированные рилсы конкурентов из вашей базы"
        actions={
          <button type="button" className="button button-lime" onClick={() => setImportOpen(true)}>
            + Импорт
          </button>
        }
      />

      <ReelFilters
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        competitorId={urlCompetitorId}
        competitors={competitorsQuery.data ?? []}
        onCompetitorChange={(id) =>
          updateParams((params) => {
            if (id) params.set('competitor_id', String(id))
            else params.delete('competitor_id')
            params.delete('page')
          })
        }
        sort={urlSort}
        onSortChange={(sort) =>
          updateParams((params) => {
            if (sort && sort !== 'views') params.set('sort', sort)
            else params.delete('sort')
            params.delete('page')
          })
        }
        viewMode={urlView}
        onViewModeChange={(mode) =>
          updateParams((params) => {
            if (mode !== 'grid') params.set('view', mode)
            else params.delete('view')
          })
        }
      />

      <div className="category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`category-tab ${urlCategory === cat.key ? 'active' : ''}`}
            onClick={() =>
              updateParams((params) => {
                if (cat.key !== 'all') params.set('category', cat.key)
                else params.delete('category')
                params.delete('page')
              })
            }
          >
            {cat.label}
          </button>
        ))}
      </div>

      {reelsQuery.isLoading ? (
        <ReelCardSkeletons />
      ) : reelsQuery.isError ? (
        <ErrorState error={reelsQuery.error} onRetry={() => void reelsQuery.refetch()} />
      ) : !page || displayedItems.length === 0 ? (
        <ReelsEmptyState
          title={hasFilters ? 'Ничего не найдено' : 'Здесь пока пусто'}
          description={
            hasFilters
              ? 'В этой вкладке пока нет подходящих рилсов. Измените поиск или сбросьте выбранные фильтры.'
              : 'Добавьте конкурента и импортируйте его рилсы — они появятся в этом разделе.'
          }
          action={
            hasFilters ? (
              <button
                type="button"
                className="button button-lime reels-empty-cta"
                onClick={() => {
                  setSearchInput('')
                  updateParams((params) => {
                    params.delete('search')
                    params.delete('competitor_id')
                    params.delete('category')
                    params.delete('page')
                  })
                }}
              >
                Сбросить фильтры <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button
                type="button"
                className="button button-lime reels-empty-cta"
                onClick={() => setImportOpen(true)}
              >
                Добавить конкурента <span aria-hidden="true">→</span>
              </button>
            )
          }
          steps={[
            {
              icon: <UserPlus size={20} />,
              title: 'Добавьте',
              description: 'Укажите Instagram-аккаунт конкурента.',
            },
            {
              icon: <Download size={20} />,
              title: 'Импортируйте',
              description: 'Загрузите его актуальные рилсы.',
            },
            {
              icon: <Search size={20} />,
              title: 'Изучайте',
              description: 'Находите сильные идеи и механики.',
            },
          ]}
        />
      ) : (
        <>
          <div className={urlView === 'list' ? 'reels-list' : 'reels-grid'}>
            {displayedItems.map((reel) => (
              <ReelCard key={reel.id} reel={reel} viewMode={urlView} />
            ))}
          </div>
          <Pagination
            page={page.page}
            pages={page.pages}
            total={page.total}
            perPage={pageSize}
            updatedAt={new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            onPerPageChange={(nextPageSize) =>
              updateParams((params) => {
                if (nextPageSize === DEFAULT_PAGE_SIZE) params.delete('limit')
                else params.set('limit', String(nextPageSize))
                params.delete('page')
              })
            }
            onChange={(next) =>
              updateParams((params) => {
                if (next <= 1) params.delete('page')
                else params.set('page', String(next))
              })
            }
          />
        </>
      )}

      {isImportOpen ? <ImportCompetitorDialog onClose={closeImportDialog} /> : null}
    </div>
  )
}
