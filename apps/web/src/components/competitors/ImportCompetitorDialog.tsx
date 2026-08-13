import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { createCompetitor, startImport } from '@/api/competitors'
import { queryKeys } from '@/api/queryKeys'
import { useToast } from '@/components/feedback/toastContext'
import { useNotifications } from '@/components/notifications/notificationContext'
import { competitorFormSchema } from '@/schemas/competitor'
import type { ReelImportMode } from '@/types/job'
import { getCompetitorFormError, getErrorMessage } from '@/utils/errors'

function IconCompetitor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10" cy="8" r="4" />
      <path d="M3 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 10h4M19 8v4" />
    </svg>
  )
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 13 13 20 4 11V4h7z" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.9 7.5-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function IconPopular() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 16 5-5 4 3 7-8" />
      <path d="M15 6h5v5" />
    </svg>
  )
}

function IconLatest() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

interface ImportCompetitorDialogProps {
  onClose: () => void
}

export function ImportCompetitorDialog({ onClose }: ImportCompetitorDialogProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const { addNotification } = useNotifications()
  const inputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState('')
  const [category, setCategory] = useState('')
  const [importMode, setImportMode] = useState<ReelImportMode>('popular')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const importMutation = useMutation({
    mutationFn: async (value: string) => {
      const competitor = await createCompetitor(value)
      const job = await startImport(competitor.id, importMode)
      return { competitor, job }
    },
    onSuccess: ({ competitor }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitors.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      toast.info(`Импорт @${competitor.instagramUsername} запущен — показываю прогресс`)
      addNotification({
        kind: 'import',
        title: 'Импорт запущен',
        description: `Статус @${competitor.instagramUsername} открыт в разделе «Конкуренты». После завершения Reels появятся в библиотеке и ленте идей.`,
      })
      onClose()
      navigate('/competitors')
    },
    onError: (error) => {
      const message = getCompetitorFormError(error) || getErrorMessage(error)
      setFieldError(message)
      toast.error(message)
    },
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !importMutation.isPending) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [importMutation.isPending, onClose])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldError(null)
    const parsed = competitorFormSchema.safeParse({ profile })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Проверьте Instagram-аккаунт')
      return
    }
    importMutation.mutate(parsed.data.profile)
  }

  return createPortal(
    <div
      className="import-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !importMutation.isPending) onClose()
      }}
    >
      <section
        className="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-description"
      >
        <button
          type="button"
          className="import-dialog-close"
          aria-label="Закрыть"
          onClick={onClose}
          disabled={importMutation.isPending}
        >
          ×
        </button>

        <div className="import-dialog-heading">
          <span className="import-dialog-heading-icon">
            <IconCompetitor />
          </span>
          <div>
            <h2 id="import-dialog-title">Добавить конкурента</h2>
            <p id="import-dialog-description">
              Добавьте Instagram-аккаунт. После запуска вы сразу увидите живой статус импорта.
            </p>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <label className="import-field">
            <span>Instagram-аккаунт или ссылка</span>
            <span className={`import-control ${fieldError ? 'has-error' : ''}`}>
              <IconInstagram />
              <input
                ref={inputRef}
                value={profile}
                onChange={(event) => {
                  setProfile(event.target.value)
                  if (fieldError) setFieldError(null)
                }}
                placeholder="@username или https://instagram.com/username"
                autoComplete="off"
                disabled={importMutation.isPending}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? 'import-profile-error' : undefined}
              />
            </span>
            {fieldError ? (
              <small id="import-profile-error" role="alert">
                {fieldError}
              </small>
            ) : null}
          </label>

          <label className="import-field">
            <span>Категория</span>
            <span className="import-control">
              <IconTag />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={importMutation.isPending}
              >
                <option value="">Например: AI, маркетинг, монтаж</option>
                <option value="ai">AI и технологии</option>
                <option value="marketing">Маркетинг</option>
                <option value="editing">Монтаж</option>
                <option value="sales">Продажи</option>
                <option value="other">Другое</option>
              </select>
            </span>
          </label>

          <fieldset className="import-mode-field" disabled={importMutation.isPending}>
            <legend>Какие рилсы импортировать</legend>
            <div className="import-mode-options">
              <label className={`import-mode-option ${importMode === 'popular' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="import-mode"
                  value="popular"
                  checked={importMode === 'popular'}
                  onChange={() => setImportMode('popular')}
                />
                <span className="import-mode-icon"><IconPopular /></span>
                <span>
                  <strong>Популярные</strong>
                  <small>5 рилсов с максимальными просмотрами</small>
                </span>
              </label>
              <label className={`import-mode-option ${importMode === 'latest' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="import-mode"
                  value="latest"
                  checked={importMode === 'latest'}
                  onChange={() => setImportMode('latest')}
                />
                <span className="import-mode-icon"><IconLatest /></span>
                <span>
                  <strong>Последние 5</strong>
                  <small>Самые свежие по дате публикации</small>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="import-privacy">
            <IconShield />
            <span>Данные используются только для импорта рилсов.</span>
          </div>

          <div className="import-dialog-actions">
            <button
              type="button"
              className="button import-cancel"
              onClick={onClose}
              disabled={importMutation.isPending}
            >
              Отмена
            </button>
            <button type="submit" className="button button-lime import-submit" disabled={importMutation.isPending}>
              {importMutation.isPending ? 'Добавляем…' : 'Добавить и импортировать'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}
