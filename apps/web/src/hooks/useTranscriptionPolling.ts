import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { fetchTranscription } from '@/api/transcriptions'
import { queryKeys } from '@/api/queryKeys'
import type { TranscriptionView } from '@/types/transcription'

const POLL_INTERVAL_MS = 2500

export interface TranscriptionPollingResult {
  transcription: TranscriptionView | null | undefined
  isActive: boolean
  isLoading: boolean
  error: unknown
}

export function useTranscriptionPolling(
  reelId: number,
  options: {
    onCompleted?: (transcription: TranscriptionView) => void
    onFailed?: (transcription: TranscriptionView) => void
  } = {},
): TranscriptionPollingResult {
  const queryClient = useQueryClient()
  const { onCompleted, onFailed } = options
  const notifiedRef = useRef<number | null>(null)

  const query = useQuery({
    queryKey: queryKeys.reels.transcription(reelId),
    queryFn: ({ signal }) => fetchTranscription(reelId, signal),
    enabled: Number.isFinite(reelId) && reelId > 0,
    refetchInterval: (q) => {
      const data = q.state.data as TranscriptionView | null | undefined
      if (!data) return false
      return data.status === 'queued' || data.status === 'processing' ? POLL_INTERVAL_MS : false
    },
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 0,
  })

  const transcription = query.data

  useEffect(() => {
    if (!transcription) return
    const status = transcription.status
    if (status === 'queued' || status === 'processing') return
    if (notifiedRef.current === transcription.id) return
    notifiedRef.current = transcription.id

    void queryClient.invalidateQueries({ queryKey: queryKeys.reels.details(reelId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.reels.transcription(reelId) })

    if (status === 'completed') {
      onCompleted?.(transcription)
    } else if (status === 'failed') {
      onFailed?.(transcription)
    }
  }, [transcription, queryClient, reelId, onCompleted, onFailed])

  return {
    transcription,
    isActive: transcription?.status === 'queued' || transcription?.status === 'processing',
    isLoading: query.isLoading,
    error: query.error,
  }
}
