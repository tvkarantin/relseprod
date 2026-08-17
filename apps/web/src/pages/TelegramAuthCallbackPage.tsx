import { ArrowLeft, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'

type CallbackState = 'working' | 'success' | 'error'

export function TelegramAuthCallbackPage() {
  const { config, exchangeTelegram } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)
  const [state, setState] = useState<CallbackState>('working')

  useEffect(() => {
    if (started.current) return
    started.current = true

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const code = hash.get('code')
    window.history.replaceState({}, document.title, window.location.pathname)

    if (!code) {
      setState('error')
      return
    }

    void exchangeTelegram(code)
      .then(() => {
        setState('success')
        navigate('/dashboard', { replace: true })
      })
      .catch((error) => {
        console.error('Telegram login exchange failed', error)
        setState('error')
      })
  }, [exchangeTelegram, navigate])

  return (
    <main className="auth-page">
      <section className="auth-card auth-callback-card">
        {state === 'working' ? (
          <>
            <LoaderCircle className="auth-spinner" size={34} />
            <h1>Входим в RealsFinder</h1>
            <p>Проверяем одноразовую ссылку из Telegram…</p>
          </>
        ) : state === 'success' ? (
          <>
            <CheckCircle2 size={34} />
            <h1>Готово</h1>
            <p>Telegram-профиль подключён. Открываем приложение.</p>
          </>
        ) : (
          <>
            <div className="auth-icon" aria-hidden="true">!</div>
            <h1>Ссылка не сработала</h1>
            <p>Она могла истечь или уже использоваться. Нажми /start в боте ещё раз.</p>
            {config?.botUrl ? (
              <a className="auth-primary" href={config.botUrl} target="_blank" rel="noreferrer">
                Открыть бота заново
              </a>
            ) : (
              <Link className="auth-secondary" to="/login"><ArrowLeft size={16} /> Назад ко входу</Link>
            )}
          </>
        )}
      </section>
    </main>
  )
}
