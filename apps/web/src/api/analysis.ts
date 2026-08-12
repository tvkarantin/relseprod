import type { ReelAnalysisView } from '@/types/analysis'
import type { CreatorProfile } from '@/types/creatorProfile'
import { apiClient } from './client'

export async function fetchReelAnalysis(reelId: number, signal?: AbortSignal): Promise<ReelAnalysisView | null> {
  return await apiClient.get<ReelAnalysisView | null>(`/reels/${reelId}/analysis`, signal)
}

export async function startReelAnalysis(reelId: number, profile: CreatorProfile): Promise<void> {
  await apiClient.post(`/reels/${reelId}/analysis`, profile)
}

export async function retryReelAnalysis(reelId: number, profile: CreatorProfile): Promise<void> {
  await apiClient.post(`/reels/${reelId}/analysis/retry`, profile)
}
