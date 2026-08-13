import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { getErrorMessage, isNetworkError } from '@/utils/errors'

export function EmptyState({
  title,
  description,
  icon = '◇',
  action,
}: {
  title: string
  description: string
  icon?: string
  action?: ReactNode
}) {
  return (
    <div className="surface card-message">
      <div className="card-message-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const network = isNetworkError(error)
  return (
    <div className="surface card-message" role="alert">
      <div className="card-message-icon" aria-hidden="true">
        ⚠
      </div>
      <h3>{network ? 'Нет связи с сервером' : 'Не удалось загрузить данные'}</h3>
      <p>
        {network
          ? 'Backend API временно недоступен. Проверьте деплой сервера и попробуйте снова.'
          : getErrorMessage(error)}
      </p>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
    </div>
  )
}

export function InlineError({
  message,
  onRetry,
  retryLabel = 'Повторить',
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="alert" role="alert">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
      {onRetry ? (
        <span className="alert-actions">
          <Button small onClick={onRetry}>
            {retryLabel}
          </Button>
        </span>
      ) : null}
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="surface card-message" role="status" aria-live="polite">
      <p>{label}</p>
    </div>
  )
}

export function ReelCardSkeletons({ count = 8 }: { count?: number }) {
  return (
    <div className="reels-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

export function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-row" />
      ))}
    </div>
  )
}
