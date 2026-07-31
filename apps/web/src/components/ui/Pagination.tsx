interface PaginationProps {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
  updatedAt?: string
  perPage?: number
  onPerPageChange?: (perPage: number) => void
}

function pageWindow(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)

  const result: (number | 'gap')[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pages - 1, page + 1)

  if (from > 2) result.push('gap')
  for (let current = from; current <= to; current += 1) result.push(current)
  if (to < pages - 1) result.push('gap')
  result.push(pages)
  return result
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
  updatedAt,
  perPage = 8,
  onPerPageChange,
}: PaginationProps) {
  if (pages <= 1) return null

  return (
    <nav className="pagination" aria-label="Постраничная навигация">
      <div className="pagination-info">
        Всего рилсов: <strong>{total}</strong>
        {updatedAt ? (
          <> &bull; Обновлено сегодня в {updatedAt}</>
        ) : null}
      </div>

      <div className="pagination-pages">
        <button
          type="button"
          className="page-button-arrow"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Предыдущая страница"
        >
          ‹
        </button>

        {pageWindow(page, pages).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="page-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`page-button ${item === page ? 'active' : ''}`}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Страница ${item}`}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className="page-button-arrow"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Следующая страница"
        >
          ›
        </button>
      </div>

      <div className="pagination-per-page">
        На странице:
        <select
          className="select"
          value={perPage}
          onChange={(event) => onPerPageChange?.(Number(event.target.value))}
          aria-label="Количество на странице"
        >
          <option value={8}>8</option>
          <option value={20}>20</option>
          <option value={40}>40</option>
        </select>
      </div>
    </nav>
  )
}
