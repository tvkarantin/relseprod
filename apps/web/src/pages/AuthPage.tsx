import { ArrowLeft, ArrowRight, LockKeyhole, Mail, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { getSafeNext, isAuthConfigured } from '@/auth/authClient'

export function AuthPage() {
  const { session, isLoading, signInWithTelegram } = useAuth()
  const [searchParams] = useSearchParams()
  const [isStarting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLogin = searchParams.get('mode') === 'login'
  const next = useMemo(() => getSafeNext(searchParams.get('next')), [searchParams])

  if (!isLoading && session) return <Navigate to={next} replace />

  const handleTelegram = () => {
    try {
      setError(null)
      setStarting(true)
      signInWithTelegram(next)
    } catch (cause) {
      setStarting(false)
      setError(cause instanceof Error ? cause.message : 'Не удалось открыть Telegram.')
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow" aria-hidden="true" />

      <header className="auth-topbar">
        <Link className="auth-brand" to="/" aria-label="Reels Finder — на главную">
          Reels Finder
        </Link>
        <Link className="auth-back" to="/">
          <ArrowLeft size={16} />
          На сайт
        </Link>
      </header>

      <section className="auth-stage" aria-labelledby="auth-title">
        <div className="auth-card">
          <div className="auth-card-head">
            <span className="auth-kicker">Личный кабинет</span>
            <h1 id="auth-title">{isLogin ? 'Войти в аккаунт' : 'Создать аккаунт'}</h1>
            <p>
              {isLogin
                ? 'Продолжи тем способом, которым регистрировался.'
                : 'Сохраняй идеи, сценарии и подборки в одном рабочем пространстве.'}
            </p>
          </div>

          <button
            className="auth-provider auth-provider-primary"
            type="button"
            onClick={handleTelegram}
            disabled={isStarting || isLoading}
          >
            <span className="auth-provider-icon auth-telegram-icon"><Send size={18} /></span>
            <span>{isStarting ? 'Открываем Telegram…' : 'Продолжить через Telegram'}</span>
            <ArrowRight className="auth-provider-arrow" size={17} />
          </button>

          <button className="auth-provider" type="button" disabled aria-disabled="true">
            <span className="auth-provider-icon auth-yandex-icon">Я</span>
            <span>Продолжить через Яндекс</span>
            <small>скоро</small>
          </button>

          <div className="auth-divider"><span>или</span></div>

          <div className="auth-email-preview" aria-disabled="true">
            <label htmlFor="auth-email">Почта</label>
            <div className="auth-email-field">
              <Mail size={17} />
              <input id="auth-email" type="email" placeholder="name@example.com" disabled />
            </div>
            <button type="button" disabled>
              Продолжить по почте
              <span>скоро</span>
            </button>
          </div>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {!isAuthConfigured ? (
            <p className="auth-note">
              Telegram-кнопка готова, но для рабочего входа нужно добавить настройки Supabase в окружение.
            </p>
          ) : null}

          <div className="auth-security">
            <LockKeyhole size={15} />
            <span>Пароль от Telegram мы не получаем и не храним.</span>
          </div>

          <p className="auth-switch">
            {isLogin ? 'Ещё нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <Link to={isLogin ? `/auth?next=${encodeURIComponent(next)}` : `/auth?mode=login&next=${encodeURIComponent(next)}`}>
              {isLogin ? 'Зарегистрироваться' : 'Войти'}
            </Link>
          </p>
        </div>

        <p className="auth-terms">
          Продолжая, ты соглашаешься с условиями сервиса и обработкой данных для входа в аккаунт.
        </p>
      </section>
    </main>
  )
}
