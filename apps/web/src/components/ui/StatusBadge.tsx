import type { CompetitorStatus } from '@/types/competitor'
import { CONTENT_STATUS_LABELS, type ContentStatus } from '@/types/reel'

const COMPETITOR_LABELS: Record<CompetitorStatus, string> = {
  idle: 'Не импортирован',
  queued: 'В очереди',
  parsing: 'Импорт…',
  ready: 'Готов',
  error: 'Ошибка',
}

export function CompetitorStatusBadge({ status }: { status: CompetitorStatus }) {
  return <span className={`status-badge status-${status}`}>{COMPETITOR_LABELS[status]}</span>
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  if (status === 'new') return null
  return (
    <span className={`content-badge content-${status}`}>{CONTENT_STATUS_LABELS[status]}</span>
  )
}
