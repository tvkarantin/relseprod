import { apiClient } from './client'

import type { Competitor } from '@/types/competitor'
import type { JobStart, ReelImportMode } from '@/types/job'

export function fetchCompetitors(signal?: AbortSignal): Promise<Competitor[]> {
  return apiClient.get<Competitor[]>('/competitors', signal)
}

export function fetchCompetitor(id: number, signal?: AbortSignal): Promise<Competitor> {
  return apiClient.get<Competitor>(`/competitors/${id}`, signal)
}

export function createCompetitor(profile: string): Promise<Competitor> {
  return apiClient.post<Competitor>('/competitors', { profile })
}

export function deleteCompetitor(id: number): Promise<void> {
  return apiClient.delete<void>(`/competitors/${id}`)
}

export function startImport(
  id: number,
  importMode: ReelImportMode = 'popular',
): Promise<JobStart> {
  return apiClient.post<JobStart>(`/competitors/${id}/parse`, { importMode })
}
