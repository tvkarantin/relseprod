import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { fetchCompetitors } from '@/api/competitors'
import { queryKeys } from '@/api/queryKeys'
import { fetchReels } from '@/api/reels'
import { EmptyState, ErrorState, ReelCardSkeletons } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReelCard } from '@/components/reels/ReelCard'
import { ReelFilters } from '@/components/reels/ReelFilters'
import { Pagination } from '@/components/ui/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400

export function ReelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlSearch = searchParams.get('search') ?? ''
  const urlCompetitorId = Number(searchParams.get('competitor_id')) || null
  const urlPage = Math.max(1, Number(searchParams.get('page')) || 1)

  // Local input state keeps typing responsive; the URL follows after debounce.
  const [searchInput, setSearchInput] = useState(urlSearch)
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)

  // Adopt external URL changes (back/forward, links with filters).
  useEffect(() => setSearchInput(urlSearch), [urlSearch])

  // Push the debounced term into the URL and reset paging.
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

  const competitorsQuery = useQuery({
    queryKey: queryKeys.competitors.list(),
    queryFn: ({ signal }) => fetchCompetitors(signal),
  })

  const query = { competitorId: urlCompetitorId, search: urlSearch, page: urlPage, limit: PAGE_SIZE }
  const reelsQuery = useQuery({
    queryKey: queryKeys.reels.list(query),
    queryFn: ({ signal }) => fetchReels(query, signal),
    placeholderData: (previous) => previous,
  })

  const page = reelsQuery.data
  const hasFilters = Boolean(urlSearch || urlCompetitorId)

  return (
    <div className="page-content">
      <PageHeader
        title="Библиотека рилсов"
        description="Импортированные рилсы конкурентов из вашей базы"
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
      />

      {reelsQuery.isLoading ? (
        <ReelCardSkeletons />
      ) : reelsQuery.isError ? (
        <ErrorState error={reelsQuery.error} onRetry={() => void reelsQuery.refetch()} />
      ) : !page || page.items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon="⌕"
            title="Ничего не найдено"
            description="По вашему запросу ролики не найдены. Измените поиск или снимите фильтр по конкуренту."
          />
        ) : (
          <EmptyState
            icon="▦"
            title="Библиотека пуста"
            description="Импортируйте Reels хотя бы одного конкурента, чтобы они появились здесь."
            action={
              <Link to="/competitors" className="button button-primary">
                Перейти к конкурентам
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="reels-grid">
            {page.items.map((reel) => (
              <ReelCard key={reel.id} reel={reel} />
            ))}
          </div>
          <Pagination
            page={page.page}
            pages={page.pages}
            total={page.total}
            onChange={(next) =>
              updateParams((params) => {
                if (next <= 1) params.delete('page')
                else params.set('page', String(next))
              })
            }
          />
        </>
      )}
    </div>
  )
}
