import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'

import { retryReelAnalysis, startReelAnalysis } from '@/api/analysis'
import { queryKeys } from '@/api/queryKeys'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { useReelAnalysisPolling } from '@/hooks/useReelAnalysisPolling'
import type { TranscriptionSummary } from '@/types/transcription'

import { ReelAnalysisPreview } from './ReelAnalysisPreview'

interface ScriptValues {
  hook: string
  script: string
  cta: string
}

export interface ReelAnalysisControlsProps {
  reelId: number
  transcription: TranscriptionSummary | null | undefined
  onApplyScript: (hook: string, script: string, cta: string) => void
  getCurrentValues: () => ScriptValues
  initialValues: ScriptValues
}

function WorkflowCard({
  status,
  children,
}: {
  status: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="workflow-card analysis-workflow-card">
      <div className="workflow-card-copy">
        <h2>Перевод и разбор</h2>
        <div className="workflow-status">{status}</div>
      </div>
      {children ? <div className="workflow-actions">{children}</div> : null}
    </section>
  )
}

function sameText(left: string, right: string | null): boolean {
  if (!right) return true
  return left.trim().replace(/\s+/g, ' ') === right.trim().replace(/\s+/g, ' ')
}

export function ReelAnalysisControls({
  reelId,
  transcription,
  onApplyScript,
  getCurrentValues,
  initialValues,
}: ReelAnalysisControlsProps) {
  const queryClient = useQueryClient()
  const { analysis, isLoading, error } = useReelAnalysisPolling(reelId)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [wasApplied, setWasApplied] = useState(false)
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

  const alreadyApplied = useMemo(() => {
    if (!analysis || analysis.status !== 'completed') return false
    const hasSuggestion = Boolean(
      analysis.suggestedHook || analysis.suggestedScript || analysis.suggestedCta,
    )
    return (
      hasSuggestion &&
      sameText(initialValues.hook, analysis.suggestedHook) &&
      sameText(initialValues.script, analysis.suggestedScript) &&
      sameText(initialValues.cta, analysis.suggestedCta)
    )
  }, [analysis, initialValues])

  const handleOpenApplyModal = () => {
    if (!analysis) return
    setApplyHook(Boolean(analysis.suggestedHook))
    setApplyScript(Boolean(analysis.suggestedScript))
    setApplyCta(Boolean(analysis.suggestedCta))
    setIsApplyModalOpen(true)
  }

  const handleConfirmApply = () => {
    if (!analysis) return
    const currentValues = getCurrentValues()
    onApplyScript(
      applyHook ? (analysis.suggestedHook ?? '') : currentValues.hook,
      applyScript ? (analysis.suggestedScript ?? '') : currentValues.script,
      applyCta ? (analysis.suggestedCta ?? '') : currentValues.cta,
    )
    setIsApplyModalOpen(false)
    setIsPreviewOpen(false)
    setWasApplied(true)
  }

  if (!transcription) {
    return (
      <WorkflowCard status={<><i />Сначала получите расшифровку речи</>}>
        <button type="button" className="workflow-button" disabled>
          Перевести и разобрать
        </button>
      </WorkflowCard>
    )
  }

  if (transcription.status === 'queued' || transcription.status === 'processing') {
    return (
      <WorkflowCard status={<><i className="is-pending" />Дождитесь завершения расшифровки</>}>
        <button type="button" className="workflow-button" disabled>
          Перевести и разобрать
        </button>
      </WorkflowCard>
    )
  }

  if (isLoading) {
    return (
      <WorkflowCard status={<><i className="is-pending" />Загружаем состояние анализа</>}>
        <LoadingState label="Загрузка…" />
      </WorkflowCard>
    )
  }

  if (error) {
    return (
      <WorkflowCard status={<><i className="is-error" />Не удалось загрузить состояние</>}>
        <ErrorState error={error} />
      </WorkflowCard>
    )
  }

  if (!analysis) {
    return (
      <WorkflowCard
        status={<><i />Перевести речь и разложить её по структуре сценария</>}
      >
        <button
          type="button"
          className="workflow-button workflow-button-primary"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          <span aria-hidden="true">✦</span>{' '}
          {startMutation.isPending ? 'Запускаем…' : 'Перевести и разобрать'}
        </button>
        {startMutation.isError ? (
          <span className="workflow-inline-error">
            {startMutation.error?.message || 'Ошибка запуска'}
          </span>
        ) : null}
      </WorkflowCard>
    )
  }

  if (analysis.status === 'queued' || analysis.status === 'processing') {
    return (
      <WorkflowCard
        status={
          <>
            <i className="is-pending" />
            {analysis.status === 'queued'
              ? 'Анализ поставлен в очередь'
              : 'AI переводит и анализирует сценарий…'}
          </>
        }
      >
        <button type="button" className="workflow-button" disabled>
          {analysis.status === 'queued' ? 'В очереди…' : 'Обработка…'}
        </button>
      </WorkflowCard>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <WorkflowCard
        status={<><i className="is-error" />{analysis.errorMessage || 'Не удалось выполнить разбор'}</>}
      >
        <button
          type="button"
          className="workflow-button workflow-button-primary"
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
        >
          {retryMutation.isPending ? 'Запускаем…' : 'Повторить'}
        </button>
      </WorkflowCard>
    )
  }

  if (alreadyApplied || wasApplied) return null

  return (
    <>
      <section className={`workflow-card analysis-workflow-card ${isPreviewOpen ? 'is-open' : ''}`}>
        <div className="workflow-card-copy">
          <h2>Перевод и разбор</h2>
          <div className="workflow-status is-success">
            <i />
            Перевод готов
          </div>
        </div>
        <div className="workflow-actions">
          <button
            type="button"
            className="workflow-button"
            onClick={() => setIsPreviewOpen((open) => !open)}
          >
            <span aria-hidden="true">◌</span>{' '}
            {isPreviewOpen ? 'Скрыть результат' : 'Посмотреть результат'}
          </button>
          <button
            type="button"
            className="workflow-button workflow-button-primary"
            onClick={handleOpenApplyModal}
          >
            <span aria-hidden="true">✦</span> Адаптировать под мой стиль
          </button>
        </div>
        {isPreviewOpen ? (
          <div className="analysis-preview-wrap">
            <ReelAnalysisPreview analysis={analysis} />
          </div>
        ) : null}
      </section>

      {isApplyModalOpen ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsApplyModalOpen(false)}>
          <section
            className="surface analysis-apply-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="analysis-apply-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="analysis-apply-title">Применить к сценарию</h2>
            <p>Выберите части разбора, которые нужно перенести в редактор.</p>
            <div className="analysis-apply-options">
              {[
                ['Хук', applyHook, setApplyHook, Boolean(getCurrentValues().hook.trim())],
                ['Основная часть', applyScript, setApplyScript, Boolean(getCurrentValues().script.trim())],
                ['Призыв к действию', applyCta, setApplyCta, Boolean(getCurrentValues().cta.trim())],
              ].map(([label, checked, setter, hasCurrent]) => (
                <label key={String(label)}>
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={(event) =>
                      (setter as (value: boolean) => void)(event.target.checked)
                    }
                  />
                  <span>
                    <strong>{String(label)}</strong>
                    {checked && hasCurrent ? <small>Текущий текст будет заменён</small> : null}
                  </span>
                </label>
              ))}
            </div>
            <div className="analysis-apply-actions">
              <button type="button" className="workflow-button" onClick={() => setIsApplyModalOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="workflow-button workflow-button-primary"
                onClick={handleConfirmApply}
              >
                Перенести в сценарий
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
