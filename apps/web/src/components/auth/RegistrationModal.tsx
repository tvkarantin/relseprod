import { Send, X } from 'lucide-react'
import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '@/styles/registration-modal.css'

type RegistrationModalProps = {
  open: boolean
  onClose: () => void
}

function getTelegramBotUrl() {
  const explicitUrl = import.meta.env.VITE_TELEGRAM_BOT_URL?.trim()
  if (explicitUrl) return explicitUrl

  const username = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '')
  return username ? `https://t.me/${username}?start=web` : null
}

export function RegistrationModal({ open, onClose }: RegistrationModalProps) {
  const navigate = useNavigate()
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [telegramError, setTelegramError] = useState('')
  const telegramBotUrl = getTelegramBotUrl()

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError('Введи почту, чтобы продолжить')
      emailRef.current?.focus()
      return
    }

    localStorage.setItem('realsfinder_signup_email', normalizedEmail)
    onClose()
    navigate('/dashboard')
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const handleTelegramClick = () => {
    setTelegramError('')
    if (!telegramBotUrl) {
      setTelegramError('Telegram-бот ещё не подключён к этому окружению')
      return
    }
    window.location.assign(telegramBotUrl)
  }

  return (
    <div className="rf-signup-backdrop" onMouseDown={handleBackdropClick}>
      <section
        className="rf-signup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf-signup-title"
      >
        <button className="rf-signup-close" type="button" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>

        <div className="rf-signup-brand" aria-hidden="true">R</div>
        <h2 id="rf-signup-title">Создать аккаунт</h2>
        <p className="rf-signup-subtitle">Введи почту — и сразу переходи в RealsFinder.</p>

        <form className="rf-signup-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="rf-signup-email">Email</label>
          <input
            ref={emailRef}
            id="rf-signup-email"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (error) setError('')
            }}
            aria-invalid={Boolean(error)}
          />
          {error ? <p className="rf-signup-error">{error}</p> : null}
          <button className="rf-signup-submit" type="submit">Продолжить</button>
        </form>

        <div className="rf-signup-divider"><span>или</span></div>

        <button className="rf-signup-telegram" type="button" onClick={handleTelegramClick}>
          <Send size={17} />
          Войти через Telegram
        </button>
        {telegramError ? <p className="rf-signup-telegram-error">{telegramError}</p> : null}

        <p className="rf-signup-note">Без карты. Регистрация занимает несколько секунд.</p>
      </section>
    </div>
  )
}
