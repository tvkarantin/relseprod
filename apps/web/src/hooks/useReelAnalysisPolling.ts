import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { fetchReelAnalysis } from '@/api/analysis'
import { queryKeys } from '@/api/queryKeys'
import type { ReelAnalysisView } from '@/types/analysis'

const POLL_INTERVAL_MS = 2500

export interface ReelAnalysisPollingResult {
  analysis: ReelAnalysisView | null | undefined
  isActive: boolean
  isLoading: boolean
  error: unknown
}

export function useReelAnalysisPolling(
  reelId: number,
  options: {
    onCompleted?: (analysis: ReelAnalysisView) => void
    onFailed?: (analysis: ReelAnalysisView) => void
    waitForCreation?: boolean
  } = {},
): ReelAnalysisPollingResult {
  const queryClient = useQueryClient()
  const { onCompleted, onFailed, waitForCreation = false } = options
  const notifiedRef = useRef<number | null>(null)

  const query = useQuery({
    queryKey: queryKeys.reels.analysis(reelId),
    queryFn: ({ signal }) => fetchReelAnalysis(reelId, signal),
    enabled: Number.isFinite(reelId) && reelId > 0,
    refetchInterval: (q) => {
      const data = q.state.data as ReelAnalysisView | null | undefined
      if (!data) return waitForCreation ? POLL_INTERVAL_MS : false
      return data.status === 'queued' || data.status === 'processing' ? POLL_INTERVAL_MS : false
    },
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 0,
  })

  const analysis = query.data

  useEffect(() => {
    if (!analysis) return
    const status = analysis.status
    if (status === 'queued' || status === 'processing') return
    if (notifiedRef.current === analysis.id) return
    notifiedRef.current = analysis.id

    void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reelId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.reels.analysis(reelId) })

    if (status === 'completed') {
      onCompleted?.(analysis)
    } else if (status === 'failed') {
      onFailed?.(analysis)
    }
  }, [analysis, queryClient, reelId, onCompleted, onFailed])

  return {
    analysis,
    isActive: analysis?.status === 'queued' || analysis?.status === 'processing',
    isLoading: query.isLoading,
    error: query.error,
  }
}
