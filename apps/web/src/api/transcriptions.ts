import { apiClient } from './client'
import type { TranscriptionView } from '@/types/transcription'

export function fetchTranscription(
  reelId: number,
  signal?: AbortSignal,
): Promise<TranscriptionView | null> {
  return apiClient.get<TranscriptionView | null>(`/reels/${reelId}/transcription`, signal)
}

export function startTranscription(reelId: number): Promise<TranscriptionView> {
  return apiClient.post<TranscriptionView>(`/reels/${reelId}/transcription`)
}

export function retryTranscription(reelId: number): Promise<TranscriptionView> {
  return apiClient.post<TranscriptionView>(`/reels/${reelId}/transcription/retry`)
}
