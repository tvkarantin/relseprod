import { API_URL, apiClient, buildQuery } from './client'

import type { Page } from '@/types/api'
import type {
  ContentStatus,
  DashboardSummary,
  Reel,
  ReelContentSaved,
} from '@/types/reel'
import type { CreatorProfile } from '@/types/creatorProfile'

export type ReelSort = 'viral' | 'views' | 'likes' | 'date'

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

/** Load the complete content plan while keeping the public API paginated. */
export async function fetchAllMyReels(signal?: AbortSignal): Promise<Reel[]> {
  const items: Reel[] = []
  let currentPage = 1
  let totalPages = 1

  do {
    const response = await fetchMyReels(
      { page: currentPage, limit: 100 },
      signal,
    )
    items.push(...response.items)
    totalPages = response.pages
    currentPage += 1
  } while (currentPage <= totalPages)

  return items
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

export function skipReel(id: number): Promise<ReelContentSaved> {
  return apiClient.post<ReelContentSaved>(`/reels/${id}/skip`)
}

export interface AdaptationStarted {
  reelId: number
  contentStatus: ContentStatus
  transcriptionStatus: string | null
  message: string
}

export function adaptReel(id: number, profile: CreatorProfile): Promise<AdaptationStarted> {
  return apiClient.post<AdaptationStarted>(`/reels/${id}/adapt`, profile)
}

export function fetchDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  return apiClient.get<DashboardSummary>('/dashboard/summary', signal)
}
