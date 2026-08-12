import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { consumeAuthCallback, takeAuthNext } from '@/auth/authClient'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    void consumeAuthCallback()
      .then(async () => {
        await refresh()
        navigate(takeAuthNext(), { replace: true })
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Не удалось завершить вход через Яндекс.')
      })
  }, [navigate, refresh])

  if (!error) {
    return <div className="route-loading" role="status">Завершаем вход…</div>
  }

  return (
    <main className="auth-page auth-callback-page">
      <section className="auth-stage">
        <div className="auth-card auth-callback-card">
          <span className="auth-callback-icon"><AlertCircle size={22} /></span>
          <h1>Вход не завершён</h1>
          <p>{error}</p>
          <Link className="auth-retry" to="/auth?mode=login">Вернуться ко входу</Link>
        </div>
      </section>
    </main>
  )
}
