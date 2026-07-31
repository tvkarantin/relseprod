import { API_URL, apiClient, buildQuery } from './client'

import type { Page } from '@/types/api'
import type {
  ContentStatus,
  DashboardSummary,
  Reel,
  ReelContentSaved,
} from '@/types/reel'

export type ReelSort = 'views' | 'likes' | 'date'

export interface ReelsQuery {
  competitorId?: number | null
  search?: string
  sort?: ReelSort
  page?: number
  limit?: number
}

export function fetchReels(query: ReelsQuery, signal?: AbortSignal): Promise<Page<Reel>> {
  const search = buildQuery({
    competitor_id: query.competitorId ?? null,
    search: query.search,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  })
  return apiClient.get<Page<Reel>>(`/reels${search}`, signal)
}

export interface MyReelsQuery extends Omit<ReelsQuery, 'competitorId'> {
  contentStatus?: ContentStatus | null
}

export function fetchMyReels(query: MyReelsQuery, signal?: AbortSignal): Promise<Page<Reel>> {
  const search = buildQuery({
    content_status: query.contentStatus ?? null,
    search: query.search,
    page: query.page,
    limit: query.limit,
  })
  return apiClient.get<Page<Reel>>(`/reels/my${search}`, signal)
}

export function fetchReel(id: number, signal?: AbortSignal): Promise<Reel> {
  return apiClient.get<Reel>(`/reels/${id}`, signal)
}

export function getReelThumbnailUrl(id: number): string {
  return `${API_URL}/reels/${id}/thumbnail`
}

export interface ReelContentPayload {
  hook: string
  script: string
  cta: string
  notes: string
  contentStatus: ContentStatus
}

export function saveReelContent(
  id: number,
  payload: ReelContentPayload,
): Promise<ReelContentSaved> {
  return apiClient.put<ReelContentSaved>(`/reels/${id}/content`, payload)
}

export function takeReelToWork(id: number): Promise<ReelContentSaved> {
  return apiClient.post<ReelContentSaved>(`/reels/${id}/take-to-work`)
}

export function deleteReel(id: number): Promise<void> {
  return apiClient.delete<void>(`/reels/${id}`)
}

export function fetchDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  return apiClient.get<DashboardSummary>('/dashboard/summary', signal)
}
