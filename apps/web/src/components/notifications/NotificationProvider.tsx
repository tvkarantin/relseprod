import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  NotificationContext,
  type AppNotification,
  type NewNotification,
  type NotificationApi,
} from './notificationContext'

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 1,
    kind: 'reel',
    title: 'Новый рилс у конкурента',
    description: 'У @nick_saraev вышло новое видео',
    time: 'только что',
    unread: true,
  },
  {
    id: 2,
    kind: 'import',
    title: 'Новые рилсы найдены',
    description: 'В библиотеку добавлено 8 новых рилсов',
    time: '5 мин назад',
    unread: true,
  },
  {
    id: 3,
    kind: 'saved',
    title: 'Сценарий сохранён',
    description: 'Черновик для рилса успешно сохранён',
    time: '12 мин назад',
    unread: false,
  },
]

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const nextId = useRef(INITIAL_NOTIFICATIONS.length + 1)

  const addNotification = useCallback((notification: NewNotification) => {
    setNotifications((current) => [
      {
        ...notification,
        id: nextId.current++,
        time: notification.time ?? 'только что',
        unread: true,
      },
      ...current,
    ])
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
  }, [])

  const markRead = useCallback((id: number) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    )
  }, [])

  const api = useMemo<NotificationApi>(
    () => ({ notifications, addNotification, markAllRead, markRead }),
    [notifications, addNotification, markAllRead, markRead],
  )

  return <NotificationContext.Provider value={api}>{children}</NotificationContext.Provider>
}
