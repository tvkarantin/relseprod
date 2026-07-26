import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { fetchJob } from '@/api/jobs'
import { queryKeys } from '@/api/queryKeys'
import { isJobActive, type ParsingJob } from '@/types/job'

const POLL_INTERVAL_MS = 2500

export interface JobPollingResult {
  job: ParsingJob | undefined
  isActive: boolean
  isLoading: boolean
  error: unknown
}

/**
 * Poll a parsing job while it is queued or running.
 *
 * React Query owns the timer, so there is never more than one interval per
 * job and polling stops automatically on unmount, on completion and on
 * failure. Progress comes from the backend — it is never simulated here.
 */
export function useJobPolling(
  jobId: number | null,
  options: { onCompleted?: (job: ParsingJob) => void; onFailed?: (job: ParsingJob) => void } = {},
): JobPollingResult {
  const queryClient = useQueryClient()
  const { onCompleted, onFailed } = options
  const notifiedRef = useRef<number | null>(null)

  const query = useQuery({
    queryKey: jobId ? queryKeys.jobs.details(jobId) : ['jobs', 'details', 'idle'],
    queryFn: ({ signal }) => fetchJob(jobId as number, signal),
    enabled: jobId !== null,
    refetchInterval: (q) => {
      const data = q.state.data as ParsingJob | undefined
      return isJobActive(data?.status) ? POLL_INTERVAL_MS : false
    },
    // Keep polling while the tab is in the background so a finished import is
    // visible as soon as the user returns.
    refetchIntervalInBackground: true,
    // A transient network blip should not kill an in-flight import view.
    retry: 2,
    staleTime: 0,
  })

  const job = query.data

  useEffect(() => {
    if (!job || isJobActive(job.status)) return
    if (notifiedRef.current === job.id) return
    notifiedRef.current = job.id

    if (job.status === 'completed') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitors.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      onCompleted?.(job)
    } else if (job.status === 'failed') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitors.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      onFailed?.(job)
    }
  }, [job, queryClient, onCompleted, onFailed])

  return {
    job,
    isActive: isJobActive(job?.status),
    isLoading: query.isLoading,
    error: query.error,
  }
}
