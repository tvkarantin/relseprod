import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

import { retryJob } from '@/api/jobs'
import { queryKeys } from '@/api/queryKeys'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/feedback/toastContext'
import { useJobPolling } from '@/hooks/useJobPolling'
import type { ParsingJob } from '@/types/job'
import { getErrorMessage } from '@/utils/errors'

const STAGE_LABELS: Record<number, string> = {
  0: 'Задача создана',
  10: 'Запуск фоновой задачи',
  20: 'Запуск Apify Actor',
  30: 'Actor запущен',
  50: 'Ожидание завершения Actor',
  70: 'Данные получены',
  85: 'Сохранение рилсов',
  100: 'Импорт завершён',
}

function stageLabel(job: ParsingJob): string {
  if (job.status === 'failed') return 'Импорт не удался'
  return STAGE_LABELS[job.progress] ?? 'Импорт выполняется'
}

interface JobProgressProps {
  jobId: number
  username: string
  onActiveChange: (isActive: boolean) => void
  onRestarted: (jobId: number) => void
  onSettled: () => void
}

/** Live progress of one import, driven entirely by backend values. */
export function JobProgress({
  jobId,
  username,
  onActiveChange,
  onRestarted,
  onSettled,
}: JobProgressProps) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const handleCompleted = useCallback(
    (job: ParsingJob) => {
      toast.success(
        `Импорт @${username} завершён: добавлено ${job.reelsCreated}, обновлено ${job.reelsUpdated}`,
      )
      onSettled()
    },
    [toast, username, onSettled],
  )

  const handleFailed = useCallback(
    (job: ParsingJob) => {
      toast.error(job.errorMessage ?? 'Импорт завершился с ошибкой')
      onSettled()
    },
    [toast, onSettled],
  )

  const { job, isActive, error } = useJobPolling(jobId, {
    onCompleted: handleCompleted,
    onFailed: handleFailed,
  })

  useEffect(() => {
    onActiveChange(isActive)
  }, [isActive, onActiveChange])

  const retry = useMutation({
    mutationFn: () => retryJob(jobId),
    onSuccess: (started) => {
      toast.info('Задача перезапущена')
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitors.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.details(started.jobId) })
      onRestarted(started.jobId)
    },
    onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
  })

  if (error && !job) {
    return (
      <div className="job-panel" role="status">
        <div className="job-panel-head">
          <span>Не удалось получить состояние импорта</span>
        </div>
      </div>
    )
  }

  if (!job) return null
  if (job.status === 'completed') return null
  const safeProgress = Math.min(100, Math.max(0, job.progress))
  const isWaitingForApify = job.status === 'running' && safeProgress >= 30 && safeProgress < 70

  return (
    <div
      className={`job-panel ${isActive ? 'job-panel-active' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="job-progress-meta">
        <div>
          <strong>{stageLabel(job)}</strong>
          <span>@{username}</span>
        </div>
        <strong className="job-progress-percent">{safeProgress}%</strong>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={safeProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Прогресс импорта @${username}`}
      >
        <div
          className={`progress-fill ${isActive ? 'progress-fill-active' : ''}`}
          style={{ width: `${safeProgress}%` }}
        />
      </div>

      {isWaitingForApify ? (
        <p className="job-progress-note">
          Apify обрабатывает профиль. Обычно это занимает от 30 секунд до нескольких минут.
        </p>
      ) : null}

      {job.status === 'failed' ? (
        <div className="job-panel-head" style={{ marginTop: 10, marginBottom: 0 }}>
          <span style={{ color: 'var(--red)' }}>
            {job.errorMessage ?? 'Импорт завершился с ошибкой'}
          </span>
          <Button small onClick={() => retry.mutate()} disabled={retry.isPending}>
            {retry.isPending ? 'Перезапуск…' : 'Повторить'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
