import { useMemo, useState } from 'react'

import {
  useNotifications,
  type NotificationKind,
} from './notificationContext'

function NotificationIcon({ kind }: { kind: NotificationKind }) {
  if (kind === 'reel') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5h16M8 4v7M16 4v7M5 11h14v9H5z" />
        <path d="m10 14 5 2.5-5 2.5z" />
      </svg>
    )
  }
  if (kind === 'import') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    )
  }
  if (kind === 'error') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4 3.5 19h17z" />
        <path d="M12 9v4M12 16.5h.01" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </svg>
  )
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAllRead, markRead } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const visibleItems = useMemo(
    () => notifications.filter((item) => filter === 'all' || item.unread),
    [notifications, filter],
  )

  return (
    <section className="notification-panel" aria-label="Уведомления">
      <div className="notification-panel-head">
        <h2>Уведомления</h2>
        <button
          type="button"
          className="notification-mark-all"
          onClick={markAllRead}
          disabled={!notifications.some((item) => item.unread)}
        >
          Отметить все
          <span aria-hidden="true">✓</span>
        </button>
      </div>

      <div className="notification-tabs" role="tablist" aria-label="Фильтр уведомлений">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'unread'}
          className={filter === 'unread' ? 'active' : ''}
          onClick={() => setFilter('unread')}
        >
          Непрочитанные
        </button>
      </div>

      <div className="notification-list">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-item ${item.unread ? 'unread' : ''}`}
              onClick={() => markRead(item.id)}
            >
              <span className={`notification-item-icon kind-${item.kind}`}>
                <NotificationIcon kind={item.kind} />
              </span>
              <span className="notification-item-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
              <span className="notification-item-meta">
                <time>{item.time}</time>
                {item.unread ? <i aria-label="Непрочитано" /> : null}
              </span>
            </button>
          ))
        ) : (
          <div className="notification-empty">
            <span aria-hidden="true">✓</span>
            <p>Непрочитанных уведомлений нет</p>
          </div>
        )}
      </div>

      <button type="button" className="notification-show-all" onClick={onClose}>
        Показать все уведомления <span aria-hidden="true">›</span>
      </button>
    </section>
  )
}
