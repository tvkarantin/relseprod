import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'

type TelegramUser = {
  telegramId: number
  telegramUsername: string | null
  firstName: string
  lastName: string | null
  displayName: string
  hasAvatar: boolean
}

type TelegramExchangeResponse = {
  token: string
  expiresAt: string
  user: TelegramUser
}

export function TelegramAuthCallbackPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('Подтверждаем вход через Telegram…')

  useEffect(() => {
    let cancelled = false

    const complete = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const code = hash.get('code')?.trim()
      if (!code) {
        setMessage('Ссылка Telegram недействительна. Открой бота и попробуй ещё раз.')
        return
      }

      try {
        const result = await apiClient.post<TelegramExchangeResponse>('/auth/telegram/exchange', {
          code,
        })
        if (cancelled) return
        localStorage.setItem('realsfinder_auth_token', result.token)
        localStorage.setItem('realsfinder_auth_user', JSON.stringify(result.user))
        window.history.replaceState(null, '', '/auth/telegram')
        navigate('/dashboard', { replace: true })
      } catch {
        if (!cancelled) {
          setMessage('Не удалось подтвердить вход через Telegram. Вернись в бота и нажми /start.')
        }
      }
    }

    void complete()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <main className="route-loading" role="status" aria-live="polite">
      {message}
    </main>
  )
}
