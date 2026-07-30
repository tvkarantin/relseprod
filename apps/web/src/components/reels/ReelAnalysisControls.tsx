import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { startReelAnalysis, retryReelAnalysis } from '@/api/analysis'
import { queryKeys } from '@/api/queryKeys'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { useReelAnalysisPolling } from '@/hooks/useReelAnalysisPolling'
import type { TranscriptionSummary } from '@/types/transcription'
import { ReelAnalysisPreview } from './ReelAnalysisPreview'

export interface ReelAnalysisControlsProps {
  reelId: number
  transcription: TranscriptionSummary | null | undefined
  onApplyScript: (hook: string, script: string, cta: string) => void
  getCurrentValues: () => { hook: string; script: string; cta: string }
}

export function ReelAnalysisControls({ reelId, transcription, onApplyScript, getCurrentValues }: ReelAnalysisControlsProps) {
  const queryClient = useQueryClient()
  const { analysis, isLoading, error } = useReelAnalysisPolling(reelId)
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)

  const [applyHook, setApplyHook] = useState(false)
  const [applyScript, setApplyScript] = useState(false)
  const [applyCta, setApplyCta] = useState(false)

  const startMutation = useMutation({
    mutationFn: () => startReelAnalysis(reelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.analysis(reelId) })
    },
  })

  const retryMutation = useMutation({
    mutationFn: () => retryReelAnalysis(reelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.analysis(reelId) })
    },
  })

  const handleStart = () => void startMutation.mutateAsync()
  const handleRetry = () => void retryMutation.mutateAsync()

  const handleOpenApplyModal = () => {
    if (!analysis) return
    setApplyHook(!!analysis.suggestedHook)
    setApplyScript(!!analysis.suggestedScript)
    setApplyCta(!!analysis.suggestedCta)
    setIsApplyModalOpen(true)
  }

  const handleConfirmApply = () => {
    if (!analysis) return
    const currentValues = getCurrentValues()
    const finalHook = applyHook ? (analysis.suggestedHook ?? '') : currentValues.hook
    const finalScript = applyScript ? (analysis.suggestedScript ?? '') : currentValues.script
    const finalCta = applyCta ? (analysis.suggestedCta ?? '') : currentValues.cta

    onApplyScript(finalHook, finalScript, finalCta)
    setIsApplyModalOpen(false)
    setIsPreviewOpen(false)
  }

  const renderApplyModal = () => {
    if (!isApplyModalOpen || !analysis) return null

    const currentValues = getCurrentValues()

    const hasCurrentHook = currentValues.hook.trim().length > 0
    const hasCurrentScript = currentValues.script.trim().length > 0
    const hasCurrentCta = currentValues.cta.trim().length > 0

    return (
      <div style={modalOverlayStyle}>
        <div className="surface" style={modalContentStyle}>
          <h3 style={{ marginTop: 0 }}>Применить к сценарию</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input type="checkbox" checked={applyHook} onChange={(e) => setApplyHook(e.target.checked)} />
              <div>
                <strong>Применить хук</strong>
                {applyHook && hasCurrentHook && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                    Поле уже содержит текст и будет заменено
                  </div>
                )}
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input type="checkbox" checked={applyScript} onChange={(e) => setApplyScript(e.target.checked)} />
              <div>
                <strong>Применить основную часть</strong>
                {applyScript && hasCurrentScript && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                    Поле уже содержит текст и будет заменено
                  </div>
                )}
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input type="checkbox" checked={applyCta} onChange={(e) => setApplyCta(e.target.checked)} />
              <div>
                <strong>Применить CTA</strong>
                {applyCta && hasCurrentCta && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                    Поле уже содержит текст и будет заменено
                  </div>
                )}
              </div>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="button button-outline" onClick={() => setIsApplyModalOpen(false)}>
              Отмена
            </button>
            <button className="button button-primary" onClick={handleConfirmApply}>
              Подтвердить
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!transcription) {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <p>Сначала получите расшифровку речи</p>
        <button className="button" disabled>Перевести и разобрать</button>
      </div>
    )
  }

  if (transcription.status === 'queued' || transcription.status === 'processing') {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <p>Дождитесь завершения расшифровки</p>
        <button className="button" disabled>Перевести и разобрать</button>
      </div>
    )
  }

  // Assuming we don't have transcript text in transcription summary here, backend will reject empty text.
  // Actually, wait, backend error for empty transcription is 422 TRANSCRIPTION_EMPTY.
  
  if (isLoading) {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <LoadingState label="Загрузка состояния анализа..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <ErrorState error={error} />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <p>Перевести речь на русский и разложить по структуре сценария</p>
        <button 
          className="button button-primary" 
          onClick={handleStart} 
          disabled={startMutation.isPending}
        >
          {startMutation.isPending ? 'Запуск...' : 'Перевести и разобрать'}
        </button>
        {startMutation.isError && <p style={{ color: 'var(--color-danger)', marginTop: '0.5rem' }}>{startMutation.error?.message || 'Ошибка запуска'}</p>}
      </div>
    )
  }

  if (analysis.status === 'queued') {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <p>Анализ поставлен в очередь</p>
        <button className="button" disabled>В очереди...</button>
      </div>
    )
  }

  if (analysis.status === 'processing') {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <p>AI переводит и анализирует сценарий…</p>
        <button className="button" disabled>Обработка...</button>
      </div>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <div className="surface" style={{ marginBottom: '1rem' }}>
        <p>Не удалось перевести и разобрать сценарий</p>
        <p style={{ color: 'var(--color-danger)' }}>{analysis.errorMessage || 'Неизвестная ошибка'}</p>
        <button 
          className="button button-primary" 
          onClick={handleRetry} 
          disabled={retryMutation.isPending}
        >
          {retryMutation.isPending ? 'Запуск...' : 'Повторить'}
        </button>
      </div>
    )
  }

  return (
    <div className="surface" style={{ marginBottom: '1rem' }}>
      <p style={{ fontWeight: 'bold' }}>Перевод и разбор готовы</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button className="button" onClick={() => setIsPreviewOpen(!isPreviewOpen)}>
          {isPreviewOpen ? 'Скрыть результат' : 'Посмотреть результат'}
        </button>
        <button className="button button-primary" onClick={handleOpenApplyModal}>
          Применить к сценарию
        </button>
      </div>
      
      {isPreviewOpen && <ReelAnalysisPreview analysis={analysis} />}
      {renderApplyModal()}
    </div>
  )
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '480px',
  padding: '2rem',
}
