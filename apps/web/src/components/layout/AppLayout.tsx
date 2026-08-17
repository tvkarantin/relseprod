import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Folder,
  LayoutGrid,
  Library,
  Lightbulb,
  Menu,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { fetchTelegramAvatarObjectUrl } from '@/api/auth'
import { useAuth } from '@/auth/AuthProvider'
import { UsageLimitsCard } from '@/components/layout/UsageLimitsCard'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useNotifications } from '@/components/notifications/notificationContext'
import { CreatorProfileDialog } from '@/components/profile/CreatorProfileDialog'
import './realsflow-shell.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Обзор', icon: LayoutGrid, end: true },
  { to: '/ideas', label: 'Идеи', icon: Lightbulb },
  { to: '/competitors', label: 'Конкуренты', icon: Users },
  { to: '/library', label: 'Библиотека', icon: Library },
  { to: '/my-reels', label: 'Контент-план', icon: CalendarDays },
  { to: '/resources', label: 'Мои сервисы', icon: Folder },
  { to: '/subscription', label: 'Подписка', icon: Star },
] as const

function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || 'R'
}

function initialsAvatar(name: string): string {
  const initials = initialsFor(name)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="#171717"/><text x="48" y="56" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="white">${initials}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function AppLayout() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isNotificationsOpen, setNotificationsOpen] = useState(false)
  const [isProfileOpen, setProfileOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const notificationAnchorRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { notifications } = useNotifications()
  const { user } = useAuth()
  const hasUnreadNotifications = notifications.some((item) => item.unread)

  const displayName = user?.displayName || 'Автор'
  const primaryProfileLabel = user?.telegramUsername
    ? `@${user.telegramUsername}`
    : displayName
  const fallbackAvatarUrl = useMemo(() => initialsAvatar(displayName), [displayName])

  useEffect(() => {
    setMenuOpen(false)
    setNotificationsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isNotificationsOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!notificationAnchorRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isNotificationsOpen])

  useEffect(() => {
    setAvatarUrl(null)
    if (!user?.hasAvatar) return

    const controller = new AbortController()
    let objectUrl: string | null = null
    void fetchTelegramAvatarObjectUrl(controller.signal)
      .then((nextUrl) => {
        if (controller.signal.aborted) return
        objectUrl = nextUrl
        setAvatarUrl(nextUrl)
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.warn('Could not load Telegram avatar', error)
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user?.id, user?.hasAvatar])

  const handleShellPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--rf-cursor-x', `${event.clientX}px`)
    event.currentTarget.style.setProperty('--rf-cursor-y', `${event.clientY}px`)
  }

  return (
    <div
      className={`rf-shell ${isMenuOpen ? 'is-menu-open' : ''}`}
      onPointerMove={handleShellPointerMove}
    >
      <aside className="rf-sidebar" aria-label="Основная навигация">
        <div className="rf-sidebar-head">
          <NavLink to="/dashboard" className="rf-brand" aria-label="RealsFinder — обзор">
            <span className="rf-brand-mark" aria-hidden="true">R</span>
            <span>RealsFinder</span>
          </NavLink>
          <button type="button" className="rf-sidebar-close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="rf-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) => `rf-nav-item ${isActive ? 'is-active' : ''}`}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="rf-sidebar-spacer" />
        <UsageLimitsCard />
      </aside>

      <button type="button" className="rf-sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />

      <header className="rf-topbar">
        <button type="button" className="rf-mobile-menu" aria-label="Открыть меню" aria-expanded={isMenuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <Menu size={20} />
        </button>

        <label className="rf-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Поиск по роликам, тексту или аккаунтам" aria-label="Поиск" />
          <kbd>⌘K</kbd>
        </label>

        <div className="rf-topbar-actions">
          <div className="notification-anchor" ref={notificationAnchorRef}>
            <button
              type="button"
              className={`rf-icon-button ${hasUnreadNotifications ? 'has-unread' : ''}`}
              aria-label="Уведомления"
              aria-haspopup="dialog"
              aria-expanded={isNotificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={18} strokeWidth={1.8} />
            </button>
            {isNotificationsOpen ? <NotificationPanel onClose={() => setNotificationsOpen(false)} /> : null}
          </div>

          <button type="button" className="rf-icon-button" aria-label="Помощь">
            <CircleHelp size={18} strokeWidth={1.8} />
          </button>

          <button type="button" className="rf-profile-button" onClick={() => setProfileOpen(true)} aria-label="Открыть профиль">
            <img src={avatarUrl ?? fallbackAvatarUrl} alt="" />
            <span><strong>{primaryProfileLabel}</strong><small>{displayName}</small></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="rf-main"><Outlet /></main>

      {isProfileOpen ? <CreatorProfileDialog onClose={() => setProfileOpen(false)} /> : null}
    </div>
  )
}
