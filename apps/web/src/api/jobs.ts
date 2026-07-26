import { apiClient } from './client'

import type { JobStart, ParsingJob } from '@/types/job'

export function fetchJob(id: number, signal?: AbortSignal): Promise<ParsingJob> {
  return apiClient.get<ParsingJob>(`/jobs/${id}`, signal)
}

export function retryJob(id: number): Promise<JobStart> {
  return apiClient.post<JobStart>(`/jobs/${id}/retry`)
}
