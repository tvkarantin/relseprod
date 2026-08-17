import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'

export function RequireAuth() {
  const { config, user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="route-loading" role="status">Проверяем вход…</div>
  }

  if (!config) {
    return (
      <div className="route-loading" role="alert">
        Не удалось проверить авторизацию. Обнови страницу через несколько секунд.
      </div>
    )
  }

  if (config.authRequired && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
