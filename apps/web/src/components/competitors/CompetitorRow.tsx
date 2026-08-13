import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { JobProgress } from './JobProgress'

import { Button } from '@/components/ui/Button'
import { CompetitorStatusBadge } from '@/components/ui/StatusBadge'
import type { Competitor } from '@/types/competitor'
import { formatDateTime, formatNumber } from '@/utils/format'

interface CompetitorRowProps {
  competitor: Competitor
  /** Job started in this session, or the latest persisted job when backend exposes it. */
  jobId: number | null
  isStarting: boolean
  onStartImport: (competitor: Competitor) => void
  onDelete: (competitor: Competitor) => void
  onJobRestarted: (jobId: number) => void
  onJobSettled: () => void
}

export function CompetitorRow({
  competitor,
  jobId,
  isStarting,
  onStartImport,
  onDelete,
  onJobRestarted,
  onJobSettled,
}: CompetitorRowProps) {
  const isBusyByStatus = competitor.status === 'queued' || competitor.status === 'parsing'
  const [isJobActive, setJobActive] = useState(false)
  const isBusy = isStarting || isJobActive || isBusyByStatus
  const hasFallbackFailure = competitor.status === 'error' && jobId === null

  useEffect(() => {
    if (jobId === null) setJobActive(false)
  }, [jobId])

  return (
    <>
      <div className="competitor-row">
        <div className="competitor-name">
          <strong>@{competitor.instagramUsername}</strong>
          <a href={competitor.profileUrl} target="_blank" rel="noopener noreferrer">
            {competitor.profileUrl}
          </a>
        </div>

        <div className="stat-cell">
          <span>Статус</span>
          <strong>
            <CompetitorStatusBadge status={competitor.status} />
          </strong>
        </div>

        <div className="stat-cell">
          <span>Рилсов</span>
          <strong>{formatNumber(competitor.reelsCount)}</strong>
        </div>

        <div className="stat-cell">
          <span>Последний импорт</span>
          <strong>{formatDateTime(competitor.lastParsedAt)}</strong>
        </div>

        <div className="row-actions">
          {competitor.reelsCount > 0 ? (
            <Link to={`/library?competitor_id=${competitor.id}`} className="button button-small">
              Рилсы
            </Link>
          ) : null}
          <Button
            small
            variant="primary"
            disabled={isBusy}
            onClick={() => onStartImport(competitor)}
          >
            {isBusy
              ? 'Импорт идёт…'
              : competitor.status === 'error'
                ? 'Повторить импорт'
                : 'Импортировать Reels'}
          </Button>
          <Button
            small
            variant="danger"
            disabled={isBusy}
            onClick={() => onDelete(competitor)}
            aria-label={`Удалить конкурента @${competitor.instagramUsername}`}
          >
            Удалить
          </Button>
        </div>
      </div>

      {jobId !== null ? (
        <JobProgress
          jobId={jobId}
          username={competitor.instagramUsername}
          onActiveChange={setJobActive}
          onRestarted={onJobRestarted}
          onSettled={onJobSettled}
        />
      ) : null}

      {hasFallbackFailure ? (
        <div className="job-panel" role="status" aria-live="polite">
          <div className="job-progress-meta">
            <div>
              <strong>Последний импорт завершился ошибкой</strong>
              <span>@{competitor.instagramUsername}</span>
            </div>
            <strong className="job-progress-percent">0 Reels</strong>
          </div>
          <p className="job-progress-note">
            Ничего не импортировано. Нажмите «Повторить импорт» — прогресс нового запуска будет показан здесь по этапам.
          </p>
        </div>
      ) : null}
    </>
  )
}
