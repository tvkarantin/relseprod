import type { ReelAnalysisView } from '@/types/analysis'
import { apiClient } from './client'

export async function fetchReelAnalysis(reelId: number, signal?: AbortSignal): Promise<ReelAnalysisView | null> {
  return await apiClient.get<ReelAnalysisView | null>(`/reels/${reelId}/analysis`, signal)
}

export async function startReelAnalysis(reelId: number): Promise<void> {
  await apiClient.post(`/reels/${reelId}/analysis`)
}

export async function retryReelAnalysis(reelId: number): Promise<void> {
  await apiClient.post(`/reels/${reelId}/analysis/retry`)
}
