import { useQuery } from '@tanstack/react-query'
import { Download, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { fetchCompetitors } from '@/api/competitors'
import { monitoringApi } from '@/api/monitoring'
import { queryKeys } from '@/api/queryKeys'
import { fetchReels } from '@/api/reels'
import { ImportCompetitorDialog } from '@/components/competitors/ImportCompetitorDialog'
import { ReelsEmptyState } from '@/components/feedback/ReelsEmptyState'
import { ErrorState, ReelCardSkeletons } from '@/components/feedback/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReelCard } from '@/components/reels/ReelCard'
import { ReelFilters } from '@/components/reels/ReelFilters'
import { YouTubeLibraryCard } from '@/components/reels/YouTubeLibraryCard'
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

function getContentCategory(value: string | null | undefined): CategoryKey {
  const text = (value ?? '').toLowerCase()
  if (text.includes('ai') || text.includes('искусственн')) return 'ai'
  if (text.includes('тренд') || text.includes('переход')) return 'trends'
  if (text.includes('продаж') || text.includes('заработ') || text.includes('10k')) return 'sales'
  if (text.includes('монтаж')) return 'editing'
  if (text.includes('сценарий') || text.includes('формул') || text.includes('хук')) return 'script'
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
  const libraryVideosQuery = useQuery({
    queryKey: ['monitoring', 'library'],
    queryFn: ({ signal }) => monitoringApi.libraryVideos(signal),
  })

  const page = reelsQuery.data
  const hasFilters = Boolean(urlSearch || urlCompetitorId || urlCategory !== 'all')

  let displayedItems = page?.items ?? []
  let displayedLibraryVideos =
    urlPage === 1 && !urlCompetitorId ? (libraryVideosQuery.data ?? []) : []

  if (urlCategory !== 'all') {
    displayedItems = displayedItems.filter(
      (reel) => getContentCategory(reel.caption) === urlCategory,
    )
    displayedLibraryVideos = displayedLibraryVideos.filter(
      (video) =>
        getContentCategory(`${video.title} ${video.description ?? ''}`) === urlCategory,
    )
  }

  const normalizedSearch = urlSearch.trim().toLowerCase()
  if (normalizedSearch) {
    displayedLibraryVideos = displayedLibraryVideos.filter((video) =>
      `${video.title} ${video.description ?? ''} ${video.channelTitle}`
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }

  if (urlSort === 'views') {
    displayedItems = [...displayedItems].sort((a, b) => (b.viewsCount ?? 0) - (a.viewsCount ?? 0))
    displayedLibraryVideos = [...displayedLibraryVideos].sort(
      (a, b) => b.viewCount - a.viewCount,
    )
  } else if (urlSort === 'likes') {
    displayedItems = [...displayedItems].sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
    displayedLibraryVideos = [...displayedLibraryVideos].sort(
      (a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0),
    )
  } else if (urlSort === 'date') {
    displayedItems = [...displayedItems].sort(
      (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
    )
    displayedLibraryVideos = [...displayedLibraryVideos].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
  }
  const hasVisibleContent = displayedItems.length > 0 || displayedLibraryVideos.length > 0

  return (
    <div className="page-content">
      <PageHeader
        title="Библиотека"
        description="Сохранённые видео из мониторинга и импортированные рилсы конкурентов"
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

      {reelsQuery.isLoading || libraryVideosQuery.isLoading ? (
        <ReelCardSkeletons />
      ) : reelsQuery.isError ? (
        <ErrorState error={reelsQuery.error} onRetry={() => void reelsQuery.refetch()} />
      ) : !page || !hasVisibleContent ? (
        <ReelsEmptyState
          title={hasFilters ? 'Ничего не найдено' : 'Здесь пока пусто'}
          description={
            hasFilters
              ? 'В этой вкладке пока нет подходящих видео. Измените поиск или сбросьте выбранные фильтры.'
              : 'Перенесите видео из мониторинга или импортируйте рилсы конкурента — они появятся здесь.'
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
          {displayedLibraryVideos.length ? (
            <section className="library-youtube-section" aria-labelledby="library-youtube-title">
              <div className="library-youtube-heading">
                <div>
                  <h2 id="library-youtube-title">Из YouTube-мониторинга</h2>
                  <p>Видео, которые вы перенесли в библиотеку</p>
                </div>
                <span className="library-youtube-count">
                  {displayedLibraryVideos.length} видео
                </span>
              </div>
              <div className="monitoring-video-grid">
                {displayedLibraryVideos.map((video) => (
                  <YouTubeLibraryCard key={video.id} video={video} />
                ))}
              </div>
            </section>
          ) : null}
          {displayedItems.length ? (
            <div className={urlView === 'list' ? 'reels-list' : 'reels-grid'}>
              {displayedItems.map((reel) => (
                <ReelCard key={reel.id} reel={reel} viewMode={urlView} />
              ))}
            </div>
          ) : null}
          {page.total > 0 ? (
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
          ) : null}
        </>
      )}

      {isImportOpen ? <ImportCompetitorDialog onClose={closeImportDialog} /> : null}
    </div>
  )
}
