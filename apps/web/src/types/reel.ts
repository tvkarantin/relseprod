import type { CompetitorBrief } from './competitor'

export type ContentStatus = 'new' | 'idea' | 'script' | 'ready' | 'published' | 'archived'

/** Statuses that mean the user started working on a reel. */
export const WORKING_STATUSES: readonly ContentStatus[] = [
  'idea',
  'script',
  'ready',
  'published',
  'archived',
]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  new: 'Новый',
  idea: 'Идея',
  script: 'Сценарий',
  ready: 'Готов',
  published: 'Опубликован',
  archived: 'В архиве',
}

export interface ReelContent {
  hook: string
  script: string
  cta: string
  notes: string
  contentStatus: ContentStatus
  createdAt: string | null
  updatedAt: string | null
}

export interface Reel {
  id: number
  competitor: CompetitorBrief
  instagramId: string | null
  shortcode: string | null
  originalUrl: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  caption: string | null
  viewsCount: number | null
  likesCount: number | null
  commentsCount: number | null
  publishedAt: string | null
  duration: number | null
  content: ReelContent
}

export interface ReelContentSaved {
  reelId: number
  hook: string
  script: string
  cta: string
  notes: string
  contentStatus: ContentStatus
  updatedAt: string
}

export interface DashboardSummary {
  competitorsCount: number
  reelsCount: number
  ideasCount: number
  scriptsCount: number
  readyCount: number
  activeJobsCount: number
}
