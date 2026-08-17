import {
  useEffect,
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

export function AppLayout() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isNotificationsOpen, setNotificationsOpen] = useState(false)
  const [isProfileOpen, setProfileOpen] = useState(false)
  const notificationAnchorRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { notifications } = useNotifications()
  const hasUnreadNotifications = notifications.some((item) => item.unread)

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
            <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=96&h=96&q=85" alt="" />
            <span><strong>Андрей</strong><small>Автор</small></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="rf-main"><Outlet /></main>

      {isProfileOpen ? <CreatorProfileDialog onClose={() => setProfileOpen(false)} /> : null}
    </div>
  )
}
