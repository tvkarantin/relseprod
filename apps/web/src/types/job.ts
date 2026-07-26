export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface ParsingJob {
  id: number
  competitorId: number
  apifyRunId: string | null
  status: JobStatus
  progress: number
  reelsCreated: number
  reelsUpdated: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface JobStart {
  jobId: number
  status: JobStatus
}

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['queued', 'running']

export function isJobActive(status: JobStatus | undefined): boolean {
  return status !== undefined && ACTIVE_JOB_STATUSES.includes(status)
}
