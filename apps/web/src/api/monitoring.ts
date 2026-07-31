import { apiClient, buildQuery } from './client'

export interface MonitoringTopic {
  id: number
  name: string
  keywords: string[]
  negativeKeywords: string[]
  language: string | null
  regionCode: string | null
  minimumScore: number
  isActive: boolean
  checkIntervalHours: number
  lastCheckedAt: string | null
  runStatus: 'idle' | 'queued' | 'running' | 'completed' | 'failed'
  runStage: 'idle' | 'queued' | 'searching' | 'channels' | 'processing' | 'completed' | 'failed'
  runProgress: number
  runMessage: string | null
  runError: string | null
  runStartedAt: string | null
  runFinishedAt: string | null
}

export interface MonitoredChannel {
  id: number
  channelId: string
  channelUrl?: string
  channelTitle: string
  thumbnailUrl?: string | null
  subscriberCount?: number | null
  lastCheckedAt?: string | null
  isActive: boolean
}

export interface MonitoredVideo {
  id: number
  externalId: string
  url: string
  title: string
  channelTitle: string
  thumbnailUrl: string | null
  publishedAt: string
  contentType: string
  viewCount: number
  finalScore: number | null
  category: string
  status: string
  recommendation: string | null
}

export interface CreateTopicPayload {
  name: string
  keywords: string[]
  negativeKeywords: string[]
  language: string | null
  regionCode: string | null
  minimumScore: number
  isActive: boolean
  checkIntervalHours: number
}

export const monitoringApi = {
  topics: (signal?: AbortSignal) =>
    apiClient.get<MonitoringTopic[]>('/monitoring/topics', signal),

  createTopic: (payload: CreateTopicPayload) =>
    apiClient.post<MonitoringTopic>('/monitoring/topics', {
      name: payload.name,
      keywords: payload.keywords,
      negative_keywords: payload.negativeKeywords,
      language: payload.language,
      region_code: payload.regionCode,
      minimum_score: payload.minimumScore,
      is_active: payload.isActive,
      check_interval_hours: payload.checkIntervalHours,
    }),

  runTopic: (topicId: number) =>
    apiClient.post<{ status: string; message: string }>(
      `/monitoring/topics/${topicId}/run`,
    ),

  channels: (signal?: AbortSignal) =>
    apiClient.get<MonitoredChannel[]>('/monitoring/channels', signal),

  addChannel: (url: string) =>
    apiClient.post<MonitoredChannel>('/monitoring/channels', { url }),

  deleteChannel: (id: number) =>
    apiClient.delete<void>(`/monitoring/channels/${id}`),

  videos: (topicId?: number, signal?: AbortSignal) =>
    apiClient.get<MonitoredVideo[]>(
      `/monitoring/videos${buildQuery({ topic_id: topicId })}`,
      signal,
    ),

  saveVideo: (id: number) =>
    apiClient.post<MonitoredVideo>(`/monitoring/videos/${id}/save`),

  ignoreVideo: (id: number) =>
    apiClient.post<MonitoredVideo>(`/monitoring/videos/${id}/ignore`),
}
