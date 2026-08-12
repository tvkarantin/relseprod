import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  NotificationContext,
  type AppNotification,
  type NewNotification,
  type NotificationApi,
} from './notificationContext'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const nextId = useRef(1)

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
