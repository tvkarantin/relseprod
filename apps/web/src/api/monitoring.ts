import { apiClient, buildQuery } from './client'

export type TopicContentFilter = 'all' | 'shorts' | 'videos' | 'animation'
export type TopicSort = 'score' | 'views' | 'recent' | 'velocity'

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
  contentFilter: TopicContentFilter
  minViewCount: number
  publishedWithinDays: number | null
  sortBy: TopicSort
  lastCheckedAt: string | null
  runStatus: 'idle' | 'queued' | 'running' | 'completed' | 'failed'
  runStage: 'idle' | 'queued' | 'searching' | 'channels' | 'processing' | 'completed' | 'failed'
  runProgress: number
  runMessage: string | null
  runError: string | null
  runStartedAt: string | null
  runFinishedAt: string | null
  includedChannelsCount: number
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
  platform: string
  url: string
  title: string
  description: string | null
  channelId: string
  channelTitle: string
  thumbnailUrl: string | null
  publishedAt: string
  durationSeconds: number | null
  contentType: string
  viewCount: number
  likeCount: number | null
  commentCount: number | null
  viewsPerHour: number | null
  engagementRate: number | null
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
  contentFilter: TopicContentFilter
  minViewCount: number
  publishedWithinDays: number | null
  sortBy: TopicSort
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
      content_filter: payload.contentFilter,
      min_view_count: payload.minViewCount,
      published_within_days: payload.publishedWithinDays,
      sort_by: payload.sortBy,
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
      `/monitoring/videos${buildQuery({ topic_id: topicId, scope: 'discovered' })}`,
      signal,
    ),

  libraryVideos: (signal?: AbortSignal) =>
    apiClient.get<MonitoredVideo[]>(
      `/monitoring/videos${buildQuery({ scope: 'library' })}`,
      signal,
    ),

  addToLibrary: (id: number) =>
    apiClient.post<MonitoredVideo>(`/monitoring/videos/${id}/library`),

  ignoreVideo: (id: number) =>
    apiClient.post<MonitoredVideo>(`/monitoring/videos/${id}/ignore`),

  deleteVideo: (id: number) =>
    apiClient.delete<void>(`/monitoring/videos/${id}`),
}
