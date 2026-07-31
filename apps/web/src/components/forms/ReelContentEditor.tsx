import { zodResolver } from '@hookform/resolvers/zod'
import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { useAutosave, type SaveState } from '@/hooks/useAutosave'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import {
  CONTENT_LIMITS,
  reelContentSchema,
  type ReelContentFormValues,
} from '@/schemas/reelContent'
import { CONTENT_STATUS_LABELS, type ContentStatus, type ReelContent } from '@/types/reel'

const STATE_LABELS: Record<SaveState, string> = {
  saved: 'Сохранено',
  dirty: 'Есть изменения',
  saving: 'Сохранение…',
  error: 'Ошибка сохранения',
}

const ALL_STATUSES: ContentStatus[] = [
  'new',
  'idea',
  'script',
  'ready',
  'published',
  'archived',
]

export interface ReelContentEditorHandle {
  getHook: () => string
  setHook: (hook: string) => void
  getScript: () => string
  setScript: (script: string) => void
  getCta: () => string
  setCta: (cta: string) => void
}

interface ReelContentEditorProps {
  reelId: number
  content: ReelContent
  onSave: (values: ReelContentFormValues) => Promise<void>
}

function toFormValues(content: ReelContent): ReelContentFormValues {
  return {
    hook: content.hook ?? '',
    script: content.script ?? '',
    cta: content.cta ?? '',
    notes: content.notes ?? '',
    contentStatus: content.contentStatus,
  }
}

export const ReelContentEditor = forwardRef<ReelContentEditorHandle, ReelContentEditorProps>(
  function ReelContentEditor({ reelId, content, onSave }, ref) {
    // Re-mounting on reelId (see the `key` in the page) guarantees a clean state
    // when the user opens another reel.
    const baseline = useMemo(() => toFormValues(content), [content])

    const {
      register,
      control,
      setValue,
      formState: { errors, isValid },
    } = useForm<ReelContentFormValues>({
      resolver: zodResolver(reelContentSchema),
      defaultValues: baseline,
      mode: 'onChange',
    })

    const values = useWatch({ control }) as ReelContentFormValues

    useImperativeHandle(
      ref,
      () => ({
        getHook: () => values.hook ?? '',
        setHook: (newHook: string) => {
          setValue('hook', newHook, { shouldDirty: true, shouldValidate: true })
        },
        getScript: () => values.script ?? '',
        setScript: (newScript: string) => {
          setValue('script', newScript, { shouldDirty: true, shouldValidate: true })
        },
        getCta: () => values.cta ?? '',
        setCta: (newCta: string) => {
          setValue('cta', newCta, { shouldDirty: true, shouldValidate: true })
        },
      }),
      [values.hook, values.script, values.cta, setValue],
    )

    const autosave = useAutosave<ReelContentFormValues>({
      values,
      baseline,
      isValid,
      save: onSave,
    })

    useUnsavedChanges(autosave.hasUnsavedChanges)

    const counter = (field: keyof typeof CONTENT_LIMITS) => {
      const length = (values?.[field] ?? '').length
      const limit = CONTENT_LIMITS[field]
      return (
        <span className={`field-counter ${length > limit ? 'is-over' : ''}`}>
          {length}/{limit}
        </span>
      )
    }

    return (
      <section className="surface editor-card" aria-labelledby="editor-title">
        <div className="editor-head">
          <h2 id="editor-title">Сценарий</h2>
          <div className="editor-actions">
            <span
              className={`save-state state-${autosave.state}`}
              role="status"
              aria-live="polite"
              data-testid="save-state"
            >
              {STATE_LABELS[autosave.state]}
            </span>
            <Button
              small
              onClick={autosave.saveNow}
              disabled={autosave.state === 'saving' || !autosave.hasUnsavedChanges}
            >
              Сохранить
            </Button>
          </div>
        </div>

        {autosave.state === 'error' ? (
          <div className="alert" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>
              {autosave.errorMessage ?? 'Не удалось сохранить'}. Текст не потерян — нажмите
              «Сохранить», чтобы повторить.
            </span>
          </div>
        ) : null}

        {/* No onSubmit: saving is driven by autosave and the explicit button. */}
        <form onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="field">
            <label className="field-label" htmlFor={`hook-${reelId}`}>
              <span>Хук</span>
              {counter('hook')}
            </label>
            <textarea
              id={`hook-${reelId}`}
              className="textarea"
              rows={2}
              placeholder="Первая фраза, которая удержит зрителя"
              aria-invalid={errors.hook ? true : undefined}
              aria-describedby={errors.hook ? `hook-${reelId}-error` : undefined}
              {...register('hook')}
            />
            {errors.hook ? (
              <p className="field-error" id={`hook-${reelId}-error`} role="alert">
                {errors.hook.message}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`script-${reelId}`}>
              <span>Основная часть</span>
              {counter('script')}
            </label>
            <textarea
              id={`script-${reelId}`}
              className="textarea textarea-large"
              placeholder="Текст сценария"
              aria-invalid={errors.script ? true : undefined}
              aria-describedby={errors.script ? `script-${reelId}-error` : undefined}
              {...register('script')}
            />
            {errors.script ? (
              <p className="field-error" id={`script-${reelId}-error`} role="alert">
                {errors.script.message}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`cta-${reelId}`}>
              <span>Призыв к действию</span>
              {counter('cta')}
            </label>
            <textarea
              id={`cta-${reelId}`}
              className="textarea"
              rows={2}
              placeholder="Что зритель должен сделать после просмотра"
              aria-invalid={errors.cta ? true : undefined}
              aria-describedby={errors.cta ? `cta-${reelId}-error` : undefined}
              {...register('cta')}
            />
            {errors.cta ? (
              <p className="field-error" id={`cta-${reelId}-error`} role="alert">
                {errors.cta.message}
              </p>
            ) : null}
          </div>

          <details className="editor-more">
            <summary>Заметки и статус</summary>
            <div className="editor-more-content">
              <div className="field">
                <label className="field-label" htmlFor={`notes-${reelId}`}>
                  <span>Заметки</span>
                  {counter('notes')}
                </label>
                <textarea
                  id={`notes-${reelId}`}
                  className="textarea"
                  rows={3}
                  placeholder="Идеи по монтажу, съёмке, референсы"
                  aria-invalid={errors.notes ? true : undefined}
                  aria-describedby={errors.notes ? `notes-${reelId}-error` : undefined}
                  {...register('notes')}
                />
                {errors.notes ? (
                  <p className="field-error" id={`notes-${reelId}-error`} role="alert">
                    {errors.notes.message}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="field-label" htmlFor={`status-${reelId}`}>
                  <span>Статус</span>
                </label>
                <select id={`status-${reelId}`} className="select" {...register('contentStatus')}>
                  {ALL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {CONTENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>
        </form>
      </section>
    )
  },
)
