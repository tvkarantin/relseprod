import { Button } from './Button'

interface PaginationProps {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
}

/** Build a compact page list: 1 … 4 5 6 … 42 */
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

export function Pagination({ page, pages, total, onChange }: PaginationProps) {
  if (pages <= 1) return null

  return (
    <nav className="pagination" aria-label="Постраничная навигация">
      <Button small disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Назад
      </Button>

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

      <Button small disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Вперёд →
      </Button>
      <span className="pagination-info">Всего: {total}</span>
    </nav>
  )
}
