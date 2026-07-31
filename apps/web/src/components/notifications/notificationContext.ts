import { createContext, useContext } from 'react'

export type NotificationKind = 'reel' | 'import' | 'saved' | 'error'

export interface AppNotification {
  id: number
  kind: NotificationKind
  title: string
  description: string
  time: string
  unread: boolean
}

export interface NewNotification {
  kind: NotificationKind
  title: string
  description: string
  time?: string
}

export interface NotificationApi {
  notifications: AppNotification[]
  addNotification: (notification: NewNotification) => void
  markAllRead: () => void
  markRead: (id: number) => void
}

export const NotificationContext = createContext<NotificationApi | null>(null)

export function useNotifications(): NotificationApi {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return context
}
