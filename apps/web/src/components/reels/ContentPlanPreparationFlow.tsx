import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { retryReelAnalysis, startReelAnalysis } from '@/api/analysis'
import { queryKeys } from '@/api/queryKeys'
import { retryTranscription, startTranscription } from '@/api/transcriptions'
import { useReelAnalysisPolling } from '@/hooks/useReelAnalysisPolling'
import { useTranscriptionPolling } from '@/hooks/useTranscriptionPolling'
import type { TranscriptionSummary } from '@/types/transcription'
import { getErrorMessage } from '@/utils/errors'

interface ContentPlanPreparationFlowProps {
  reelId: number
  videoUrl: string | null
  initialTranscription?: TranscriptionSummary | null
  onApplyAnalysis: (hook: string, script: string, cta: string) => void
}

export function ContentPlanPreparationFlow({
  reelId,
  videoUrl,
  initialTranscription,
  onApplyAnalysis,
}: ContentPlanPreparationFlowProps) {
  const queryClient = useQueryClient()
  const autoStartAttempted = useRef(false)
  const analysisRequested = useRef(false)
  const [analysisApplied, setAnalysisApplied] = useState(false)

  const transcriptionPolling = useTranscriptionPolling(reelId, { waitForCreation: true })
  const transcription = transcriptionPolling.transcription
  const transcriptionStatus = transcription?.status ?? initialTranscription?.status

  const analysisPolling = useReelAnalysisPolling(reelId)
  const analysis = analysisPolling.analysis

  const startTranscriptionMutation = useMutation({
    mutationFn: () => startTranscription(reelId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.reels.transcription(reelId), data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reelId) })
    },
  })

  const retryTranscriptionMutation = useMutation({
    mutationFn: () => retryTranscription(reelId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.reels.transcription(reelId), data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reelId) })
    },
  })

  const startAnalysisMutation = useMutation({
    mutationFn: () => startReelAnalysis(reelId),
    onMutate: () => {
      analysisRequested.current = true
      setAnalysisApplied(false)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.analysis(reelId) })
    },
    onError: () => {
      analysisRequested.current = false
    },
  })

  const retryAnalysisMutation = useMutation({
    mutationFn: () => retryReelAnalysis(reelId),
    onMutate: () => {
      analysisRequested.current = true
      setAnalysisApplied(false)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.analysis(reelId) })
    },
    onError: () => {
      analysisRequested.current = false
    },
  })

  useEffect(() => {
    if (autoStartAttempted.current) return
    if (transcriptionPolling.isLoading) return
    if (initialTranscription || transcription) return
    if (!videoUrl) return

    autoStartAttempted.current = true
    startTranscriptionMutation.mutate()
  }, [
    initialTranscription,
    transcription,
    transcriptionPolling.isLoading,
    videoUrl,
    startTranscriptionMutation,
  ])

  useEffect(() => {
    if (!analysis || analysis.status !== 'completed') return
    if (!analysisRequested.current) return

    onApplyAnalysis(
      analysis.suggestedHook ?? '',
      analysis.suggestedScript ?? '',
      analysis.suggestedCta ?? '',
    )
    analysisRequested.current = false
    setAnalysisApplied(true)
  }, [analysis, onApplyAnalysis])

  const applyExistingAnalysis = () => {
    if (!analysis || analysis.status !== 'completed') return
    onApplyAnalysis(
      analysis.suggestedHook ?? '',
      analysis.suggestedScript ?? '',
      analysis.suggestedCta ?? '',
    )
    setAnalysisApplied(true)
  }

  const transcriptText = transcription?.transcript ?? ''
  const transcriptionPending =
    transcriptionStatus === 'queued' ||
    transcriptionStatus === 'processing' ||
    startTranscriptionMutation.isPending ||
    retryTranscriptionMutation.isPending
  const analysisPending =
    analysis?.status === 'queued' ||
    analysis?.status === 'processing' ||
    startAnalysisMutation.isPending ||
    retryAnalysisMutation.isPending

  return (
    <div className="content-plan-preparation-flow">
      <section className="workflow-card content-plan-transcript-card">
        <div className="workflow-card-copy">
          <span className="eyebrow">01 · Транскрипт</span>
          <h2>Текст из видео</h2>
          <div className={`workflow-status ${transcriptionStatus === 'completed' ? 'is-success' : ''}`}>
            <i
              className={
                transcriptionStatus === 'failed'
                  ? 'is-error'
                  : transcriptionPending
                    ? 'is-pending'
                    : ''
              }
            />
            {!transcriptionStatus && 'Запускаем расшифровку автоматически'}
            {transcriptionStatus === 'queued' && 'Расшифровка в очереди'}
            {transcriptionStatus === 'processing' && 'Распознаём речь из видео…'}
            {transcriptionStatus === 'completed' && transcriptText && 'Транскрипт готов — можно переходить к разбору'}
            {transcriptionStatus === 'completed' && !transcriptText && 'Речь в видео не обнаружена'}
            {transcriptionStatus === 'failed' &&
              (transcription?.errorMessage || 'Не удалось получить транскрипт')}
          </div>
        </div>

        {transcriptText ? (
          <div className="content-plan-transcript-text">{transcriptText}</div>
        ) : null}

        {!videoUrl && !transcriptionStatus ? (
          <p className="workflow-inline-error">У этого рилса нет доступного видео для расшифровки.</p>
        ) : null}

        {startTranscriptionMutation.isError ? (
          <p className="workflow-inline-error">{getErrorMessage(startTranscriptionMutation.error)}</p>
        ) : null}

        {transcriptionStatus === 'failed' ? (
          <div className="workflow-actions">
            <button
              type="button"
              className="workflow-button workflow-button-primary"
              onClick={() => retryTranscriptionMutation.mutate()}
              disabled={retryTranscriptionMutation.isPending}
            >
              {retryTranscriptionMutation.isPending ? 'Повторяем…' : 'Повторить расшифровку'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="workflow-card content-plan-analysis-card">
        <div className="workflow-card-copy">
          <span className="eyebrow">02 · Структура</span>
          <h2>Разбор сценария</h2>
          <div className={`workflow-status ${analysis?.status === 'completed' ? 'is-success' : ''}`}>
            <i
              className={
                analysis?.status === 'failed'
                  ? 'is-error'
                  : analysisPending
                    ? 'is-pending'
                    : ''
              }
            />
            {transcriptionStatus !== 'completed' && 'Ждём готовый транскрипт'}
            {transcriptionStatus === 'completed' && !analysis && 'AI разложит сценарий на понятные блоки'}
            {analysis?.status === 'queued' && 'Разбор поставлен в очередь'}
            {analysis?.status === 'processing' && 'AI выделяет Hook, основную часть и CTA…'}
            {analysis?.status === 'completed' && !analysisApplied && 'Структура готова — перенеси её в редактор'}
            {analysis?.status === 'completed' && analysisApplied && 'Структура уже перенесена в редактор'}
            {analysis?.status === 'failed' && (analysis.errorMessage || 'Не удалось разобрать сценарий')}
          </div>
        </div>

        <div className="workflow-structure" aria-label="Структура сценария">
          <span>Hook</span>
          <b aria-hidden="true">→</b>
          <span>Основная часть</span>
          <b aria-hidden="true">→</b>
          <span>CTA</span>
        </div>

        <div className="workflow-actions">
          {transcriptionStatus === 'completed' && transcriptText && !analysis ? (
            <button
              type="button"
              className="workflow-button workflow-button-primary"
              onClick={() => startAnalysisMutation.mutate()}
              disabled={analysisPending}
            >
              {startAnalysisMutation.isPending ? 'Разбираем…' : 'Разложить сценарий'}
            </button>
          ) : null}

          {analysis?.status === 'completed' && !analysisApplied ? (
            <button
              type="button"
              className="workflow-button workflow-button-primary"
              onClick={applyExistingAnalysis}
            >
              Перенести в редактор
            </button>
          ) : null}

          {analysis?.status === 'failed' ? (
            <button
              type="button"
              className="workflow-button workflow-button-primary"
              onClick={() => retryAnalysisMutation.mutate()}
              disabled={retryAnalysisMutation.isPending}
            >
              {retryAnalysisMutation.isPending ? 'Повторяем…' : 'Повторить разбор'}
            </button>
          ) : null}
        </div>

        {startAnalysisMutation.isError ? (
          <p className="workflow-inline-error">{getErrorMessage(startAnalysisMutation.error)}</p>
        ) : null}
        {retryAnalysisMutation.isError ? (
          <p className="workflow-inline-error">{getErrorMessage(retryAnalysisMutation.error)}</p>
        ) : null}
      </section>
    </div>
  )
}
