import type { Competitor } from '@/types/competitor'

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

interface ReelFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  competitorId: number | null
  onCompetitorChange: (id: number | null) => void
  competitors: Competitor[]
  searchLabel?: string
  sort?: string
  onSortChange?: (sort: string) => void
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
}

export function ReelFilters({
  searchValue,
  onSearchChange,
  competitorId,
  onCompetitorChange,
  competitors,
  searchLabel = 'Поиск по заголовку, автору или темам...',
  sort = 'views',
  onSortChange,
  viewMode = 'grid',
  onViewModeChange,
}: ReelFiltersProps) {
  return (
    <div className="filters-row">
      <div className="search-box">
        <label className="visually-hidden" htmlFor="reels-search">
          {searchLabel}
        </label>
        <span className="search-icon" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          id="reels-search"
          type="search"
          className="input"
          placeholder={searchLabel}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          maxLength={200}
        />
      </div>

      {competitors.length > 0 ? (
        <div className="filter-select-wrap">
          <span className="filter-select-icon" aria-hidden="true">
            <IconPeople />
          </span>
          <label className="visually-hidden" htmlFor="competitor-filter">
            Фильтр по конкуренту
          </label>
          <select
            id="competitor-filter"
            className="select has-icon"
            value={competitorId ?? ''}
            onChange={(event) =>
              onCompetitorChange(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">Все конкуренты</option>
            {competitors.map((competitor) => (
              <option key={competitor.id} value={competitor.id}>
                @{competitor.instagramUsername}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {onSortChange ? (
        <div className="filter-select-wrap">
          <label className="visually-hidden" htmlFor="sort-filter">
            Сортировка
          </label>
          <select
            id="sort-filter"
            className="select"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="views">По просмотрам</option>
            <option value="likes">По лайкам</option>
            <option value="date">По дате</option>
          </select>
        </div>
      ) : null}

      {onViewModeChange ? (
        <div className="view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            aria-label="Вид сеткой"
          >
            <IconGrid />
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            aria-label="Вид списком"
          >
            <IconList />
          </button>
        </div>
      ) : null}
    </div>
  )
}
