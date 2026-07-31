import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useNotifications } from '@/components/notifications/notificationContext'

const NAV_ITEMS = [
  { to: '/', label: 'Обзор', end: true },
  { to: '/reels', label: 'Библиотека' },
  { to: '/youtube-monitoring', label: 'YouTube мониторинг' },
  { to: '/my-reels', label: 'Мои рилсы' },
] as const

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function AppLayout() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isNotificationsOpen, setNotificationsOpen] = useState(false)
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

  return (
    <div className="app-shell">
      <header className="top-nav">
        <button
          type="button"
          className="mobile-menu"
          aria-label="Открыть меню"
          aria-expanded={isMenuOpen}
          onClick={() => setMenuOpen(!isMenuOpen)}
        >
          ☰
        </button>

        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src="/assets/overview-logo.png" alt="" />
          </div>
          <span className="brand-name">Reels Finder</span>
        </div>

        <nav className="top-nav-tabs" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) => `top-nav-tab ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="top-nav-right">
          <div className="notification-anchor" ref={notificationAnchorRef}>
            <button
              type="button"
              className={`top-nav-bell ${hasUnreadNotifications ? 'has-unread' : ''}`}
              aria-label="Уведомления"
              aria-haspopup="dialog"
              aria-expanded={isNotificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <IconBell />
            </button>
            {isNotificationsOpen ? (
              <NotificationPanel onClose={() => setNotificationsOpen(false)} />
            ) : null}
          </div>
          <div className="top-nav-avatar">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=96&h=96&q=85"
              alt="Аватар пользователя"
            />
          </div>
        </div>
      </header>

      <main className={`main-view ${location.pathname === '/' ? 'main-view-dashboard' : ''}`}>
        <Outlet />
      </main>
    </div>
  )
}
