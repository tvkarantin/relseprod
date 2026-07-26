import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Accessible confirmation modal: Escape closes it, focus starts inside. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="dialog surface"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-description">{description}</p>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="button button-danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Удаление…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
