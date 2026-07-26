import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

/** Only sections backed by a real API are listed. */
const NAV_SECTIONS = [
  {
    title: 'Работа',
    items: [
      { to: '/', label: 'Обзор', icon: '⌂', end: true },
      { to: '/competitors', label: 'Конкуренты', icon: '◎' },
      { to: '/reels', label: 'Библиотека рилсов', icon: '▦' },
      { to: '/my-reels', label: 'Мои рилсы', icon: '✎' },
    ],
  },
] as const

export function AppLayout() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu"
        aria-label="Открыть меню"
        aria-expanded={isMenuOpen}
        onClick={() => setMenuOpen(true)}
      >
        ☰
      </button>

      {isMenuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${isMenuOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ▶
          </div>
          <div>
            <strong>Reels Finder</strong>
            <span>Платформа</span>
          </div>
        </div>

        <nav aria-label="Основная навигация">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">Локальный MVP · данные из вашей SQLite</div>
      </aside>

      <main className="main-view">
        <Outlet />
      </main>
    </div>
  )
}
