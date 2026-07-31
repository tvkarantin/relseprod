import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { retryTranscription, startTranscription } from '@/api/transcriptions'
import { queryKeys } from '@/api/queryKeys'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTranscriptionPolling } from '@/hooks/useTranscriptionPolling'
import type { TranscriptionSummary, TranscriptionView } from '@/types/transcription'
import { formatDuration } from '@/utils/format'

interface ReelTranscriptionControlsProps {
  reelId: number
  videoUrl: string | null
  initialTranscription?: TranscriptionSummary | TranscriptionView | null
  onApplyScript: (transcript: string) => void
  getCurrentScript: () => string
}

export function ReelTranscriptionControls({
  reelId,
  videoUrl,
  initialTranscription,
  onApplyScript,
  getCurrentScript,
}: ReelTranscriptionControlsProps) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [showConfirmReplace, setShowConfirmReplace] = useState(false)

  const polling = useTranscriptionPolling(reelId)
  const transcription = polling.transcription ?? initialTranscription

  const startMutation = useMutation({
    mutationFn: () => startTranscription(reelId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.reels.transcription(reelId), data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reelId) })
    },
  })

  const retryMutation = useMutation({
    mutationFn: () => retryTranscription(reelId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.reels.transcription(reelId), data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reelId) })
    },
  })

  const handleCopy = useCallback(async (text: string | null) => {
    if (!text) return
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopyError('Не удалось скопировать в буфер обмена')
    }
  }, [])

  const viewTrans =
    transcription && 'transcript' in transcription
      ? (transcription as TranscriptionView)
      : null
  const transcriptText = viewTrans?.transcript ?? null
  const dominantLang = transcription?.dominantLanguage ?? null
  const confidence = viewTrans?.confidence ?? null
  const duration = viewTrans?.providerDuration ?? null
  const utterances = viewTrans?.utterances ?? null

  const handleTransferClick = useCallback(() => {
    if (!transcriptText) return

    const currentScript = getCurrentScript().trim()
    if (currentScript.length > 0) {
      setShowConfirmReplace(true)
    } else {
      onApplyScript(transcriptText)
    }
  }, [transcriptText, getCurrentScript, onApplyScript])

  const confirmReplace = useCallback(() => {
    if (transcriptText) {
      onApplyScript(transcriptText)
    }
    setShowConfirmReplace(false)
  }, [transcriptText, onApplyScript])

  const status = transcription?.status
  const isPending =
    status === 'queued' ||
    status === 'processing' ||
    startMutation.isPending ||
    retryMutation.isPending

  return (
    <section className="workflow-card transcription-workflow-card">
      <div className="workflow-card-copy">
        <h2>Расшифровка речи</h2>
        <div className={`workflow-status ${status === 'completed' ? 'is-success' : ''}`}>
          <i className={status === 'failed' ? 'is-error' : isPending ? 'is-pending' : ''} />
            {!transcription && 'Получите точную расшифровку речи из видео'}
            {status === 'queued' && 'Задача поставлена в очередь'}
            {status === 'processing' && 'Deepgram распознаёт речь…'}
            {status === 'completed' && transcriptText !== '' && 'Расшифровка готова'}
            {status === 'completed' && transcriptText === '' && 'Речь в видео не обнаружена'}
            {status === 'failed' && (transcription?.errorMessage || 'Не удалось получить расшифровку')}
        </div>
      </div>

      <div className="workflow-actions">
          {!transcription && (
            <button
              type="button"
              className="workflow-button workflow-button-primary"
              onClick={() => startMutation.mutate()}
              disabled={!videoUrl || isPending}
            >
              Расшифровать видео
            </button>
          )}

          {status === 'queued' && (
            <button type="button" className="workflow-button" disabled>В очереди…</button>
          )}

          {status === 'processing' && (
            <button type="button" className="workflow-button" disabled>Распознавание…</button>
          )}

          {status === 'completed' && transcriptText !== '' && (
            <>
              <button type="button" className="workflow-button" onClick={() => setShowModal(true)}>
                <span aria-hidden="true">◉</span> Посмотреть
              </button>
              <button type="button" className="workflow-button" onClick={() => handleCopy(transcriptText)}>
                <span aria-hidden="true">▣</span> {copied ? 'Скопировано ✓' : 'Скопировать'}
              </button>
              <button type="button" className="workflow-button" onClick={handleTransferClick}>
                <span aria-hidden="true">⇄</span> Перенести в основную часть
              </button>
            </>
          )}

          {status === 'failed' && (
            <button
              type="button"
              className="workflow-button workflow-button-primary"
              onClick={() => retryMutation.mutate()}
              disabled={isPending}
            >
              Повторить
            </button>
          )}
      </div>

      {!videoUrl && !transcription && (
        <p className="workflow-inline-error">
          Для этого рилса нет доступной ссылки на видео. Повторите импорт конкурента.
        </p>
      )}

      {copyError && (
        <p className="workflow-inline-error">
          {copyError}
        </p>
      )}

      {/* Modal for viewing full transcription details */}
      {showModal && transcription && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setShowModal(false)}
        >
          <div
            className="dialog surface transcription-dialog"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Полная расшифровка речи</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {dominantLang && (
                <span>Основной язык: <strong>{dominantLang}</strong></span>
              )}
              {confidence != null && (
                <span>Уверенность: <strong>{(confidence * 100).toFixed(1)}%</strong></span>
              )}
              {duration != null && (
                <span>Длительность: <strong>{formatDuration(duration)}</strong></span>
              )}
            </div>

            <div style={{ background: 'var(--bg-subtle, #12131a)', padding: 12, borderRadius: 8, marginBottom: 16, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>
              {transcriptText}
            </div>

            {utterances && utterances.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Реплики и таймкоды</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {utterances.map((u, idx) => (
                    <div key={idx} style={{ fontSize: 12, padding: 8, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                      <span style={{ color: 'var(--primary, #3b82f6)', fontWeight: 600 }}>
                        [{formatDuration(u.start)} – {formatDuration(u.end)}]
                      </span>{' '}
                      {u.transcript}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setShowModal(false)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog if script already has text */}
      {showConfirmReplace && (
        <ConfirmDialog
          title="Заменить текст?"
          description="Основная часть уже содержит текст. Заменить её расшифровкой?"
          confirmLabel="Заменить"
          cancelLabel="Отмена"
          onConfirm={confirmReplace}
          onCancel={() => setShowConfirmReplace(false)}
        />
      )}
    </section>
  )
}
