import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Mail } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import {
  getSafeNext,
  isAuthConfigured,
  requestEmailOtp,
  verifyEmailOtp,
} from '@/auth/authClient'

export function AuthPage() {
  const navigate = useNavigate()
  const { session, isLoading, refresh, signInWithYandex } = useAuth()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [isWorking, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLogin = searchParams.get('mode') === 'login'
  const next = useMemo(() => getSafeNext(searchParams.get('next')), [searchParams])

  if (!isLoading && session) return <Navigate to={next} replace />

  const handleYandex = () => {
    try {
      setError(null)
      setWorking(true)
      signInWithYandex(next)
    } catch (cause) {
      setWorking(false)
      setError(cause instanceof Error ? cause.message : 'Не удалось открыть Яндекс.')
    }
  }

  const handleEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isWorking) return

    setError(null)
    setWorking(true)

    try {
      if (!emailSent) {
        await requestEmailOtp(email)
        setEmailSent(true)
        setCode('')
        return
      }

      await verifyEmailOtp(email, code)
      await refresh()
      navigate(next, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить вход.')
    } finally {
      setWorking(false)
    }
  }

  const changeEmail = () => {
    setEmailSent(false)
    setCode('')
    setError(null)
  }

  return (
    <main className="auth-page">
      <div className="auth-glow" aria-hidden="true" />

      <header className="auth-topbar">
        <Link className="auth-brand" to="/" aria-label="RealsFlow — на главную">
          RealsFlow
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
                ? 'Войди через Яндекс или получи одноразовый код на почту.'
                : 'Регистрация без пароля — через Яндекс или одноразовый код на почту.'}
            </p>
          </div>

          <button
            className="auth-provider"
            type="button"
            onClick={handleYandex}
            disabled={isWorking || isLoading}
          >
            <span className="auth-provider-icon auth-yandex-icon">Я</span>
            <span>{isWorking ? 'Открываем…' : 'Продолжить через Яндекс'}</span>
            <ArrowRight className="auth-provider-arrow" size={17} />
          </button>

          <div className="auth-divider"><span>или</span></div>

          <form className="auth-email-preview" onSubmit={handleEmail}>
            <div className="auth-email-label-row">
              <label htmlFor="auth-email">Почта</label>
              {emailSent ? (
                <button className="auth-email-change" type="button" onClick={changeEmail} disabled={isWorking}>
                  Изменить
                </button>
              ) : null}
            </div>

            <div className="auth-email-field">
              <Mail size={17} />
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={emailSent || isWorking}
                required
              />
            </div>

            {emailSent ? (
              <>
                <p className="auth-email-hint">Отправили код на <strong>{email}</strong></p>
                <div className="auth-email-field auth-otp-field">
                  <KeyRound size={17} />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-значный код"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    disabled={isWorking}
                    autoFocus
                    required
                  />
                </div>
              </>
            ) : null}

            <button type="submit" disabled={isWorking || isLoading || !email.trim() || (emailSent && code.length !== 6)}>
              {isWorking
                ? 'Подождите…'
                : emailSent
                  ? 'Подтвердить код'
                  : 'Получить код'}
            </button>
          </form>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {!isAuthConfigured ? (
            <p className="auth-note">Для рабочего входа нужно добавить публичные настройки Supabase в окружение приложения.</p>
          ) : null}

          <div className="auth-security">
            <LockKeyhole size={15} />
            <span>Пароль не нужен. Код одноразовый и используется только для подтверждения почты.</span>
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
