import type { Competitor } from '@/types/competitor'

interface ReelFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  competitorId: number | null
  onCompetitorChange: (id: number | null) => void
  competitors: Competitor[]
  searchLabel?: string
}

export function ReelFilters({
  searchValue,
  onSearchChange,
  competitorId,
  onCompetitorChange,
  competitors,
  searchLabel = 'Поиск по рилсам',
}: ReelFiltersProps) {
  return (
    <div className="filters-row">
      <div className="search-box">
        <label className="visually-hidden" htmlFor="reels-search">
          {searchLabel}
        </label>
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          id="reels-search"
          type="search"
          className="input"
          placeholder="Поиск по описанию, автору и сценарию"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          maxLength={200}
        />
      </div>

      {competitors.length > 0 ? (
        <div>
          <label className="visually-hidden" htmlFor="competitor-filter">
            Фильтр по конкуренту
          </label>
          <select
            id="competitor-filter"
            className="select"
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
    </div>
  )
}
