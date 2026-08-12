import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'

export function ProtectedRoute() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="route-loading" role="status">Проверяем вход…</div>
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(next)}`} replace />
  }

  return <Outlet />
}
