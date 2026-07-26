import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { fetchMyReels } from '@/api/reels'
import { EmptyState, ErrorState, ReelCardSkeletons } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReelCard } from '@/components/reels/ReelCard'
import { Pagination } from '@/components/ui/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { CONTENT_STATUS_LABELS, WORKING_STATUSES, type ContentStatus } from '@/types/reel'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400

function parseStatus(value: string | null): ContentStatus | null {
  return value && (WORKING_STATUSES as readonly string[]).includes(value)
    ? (value as ContentStatus)
    : null
}

export function MyReelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlSearch = searchParams.get('search') ?? ''
  const urlStatus = parseStatus(searchParams.get('content_status'))
  const urlPage = Math.max(1, Number(searchParams.get('page')) || 1)

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

  const query = {
    contentStatus: urlStatus,
    search: urlSearch,
    page: urlPage,
    limit: PAGE_SIZE,
  }
  const reelsQuery = useQuery({
    queryKey: queryKeys.reels.my(query),
    queryFn: ({ signal }) => fetchMyReels(query, signal),
    placeholderData: (previous) => previous,
  })

  const page = reelsQuery.data

  return (
    <div className="page-content">
      <PageHeader
        title="Мои рилсы"
        description="Ролики, для которых вы начали готовить сценарий"
      />

      <div className="tabs" role="tablist" aria-label="Фильтр по статусу">
        <button
          type="button"
          role="tab"
          aria-selected={urlStatus === null}
          className={`tab ${urlStatus === null ? 'active' : ''}`}
          onClick={() =>
            updateParams((params) => {
              params.delete('content_status')
              params.delete('page')
            })
          }
        >
          Все
        </button>
        {WORKING_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={urlStatus === status}
            className={`tab ${urlStatus === status ? 'active' : ''}`}
            onClick={() =>
              updateParams((params) => {
                params.set('content_status', status)
                params.delete('page')
              })
            }
          >
            {CONTENT_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-box">
          <label className="visually-hidden" htmlFor="my-reels-search">
            Поиск по моим рилсам
          </label>
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            id="my-reels-search"
            type="search"
            className="input"
            placeholder="Поиск по сценарию, хуку и описанию"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={200}
          />
        </div>
      </div>

      {reelsQuery.isLoading ? (
        <ReelCardSkeletons count={4} />
      ) : reelsQuery.isError ? (
        <ErrorState error={reelsQuery.error} onRetry={() => void reelsQuery.refetch()} />
      ) : !page || page.items.length === 0 ? (
        <EmptyState
          icon="✎"
          title="Здесь пока пусто"
          description="Откройте любой рилс в библиотеке, напишите сценарий и смените статус — он появится в этом разделе."
          action={
            <Link to="/reels" className="button button-primary">
              Открыть библиотеку
            </Link>
          }
        />
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
