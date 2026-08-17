import { ArrowRight, Send, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'

export function LoginPage() {
  const { config, user, loading } = useAuth()

  if (loading) return <div className="route-loading">Готовим вход…</div>
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="auth-brand" aria-label="RealsFinder — на главную">
          <span className="auth-brand-mark">R</span>
          <strong>RealsFinder</strong>
        </Link>

        <div className="auth-icon" aria-hidden="true"><Send size={25} /></div>
        <h1>Вход через Telegram</h1>
        <p>
          Открой бота, нажми <strong>Start</strong>, затем <strong>«Зарегистрироваться»</strong>.
          Ник, имя и аватар подтянутся автоматически.
        </p>

        {config?.telegramEnabled && config.botUrl ? (
          <a className="auth-primary" href={config.botUrl} target="_blank" rel="noreferrer">
            Открыть Telegram <ArrowRight size={17} />
          </a>
        ) : config?.authRequired ? (
          <div className="auth-warning" role="alert">
            Telegram-бот ещё не настроен на сервере. Нужны токен, username и webhook secret.
          </div>
        ) : (
          <Link className="auth-primary" to="/dashboard">
            Продолжить в приложение <ArrowRight size={17} />
          </Link>
        )}

        <div className="auth-security">
          <ShieldCheck size={15} />
          <span>Пароль не нужен. Ссылка одноразовая и живёт 10 минут.</span>
        </div>
      </section>
    </main>
  )
}
