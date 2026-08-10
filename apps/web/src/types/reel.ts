import type { CompetitorBrief } from './competitor'
import type { TranscriptionSummary } from './transcription'
import type { ReelAnalysisSummary } from './analysis'

export type ContentStatus =
  | 'new'
  | 'idea'
  | 'script'
  | 'ready'
  | 'filmed'
  | 'editing'
  | 'published'
  | 'archived'
  | 'skipped'

/** Statuses that mean the user started working on a reel. */
export const WORKING_STATUSES: readonly ContentStatus[] = [
  'idea',
  'script',
  'ready',
  'filmed',
  'editing',
  'published',
  'archived',
]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  new: 'Новый',
  idea: 'В работе',
  script: 'Сценарий',
  ready: 'Готово',
  filmed: 'Снято',
  editing: 'В монтаже',
  published: 'Опубликовано',
  archived: 'Архив',
  skipped: 'Не интересно',
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
  transcription?: TranscriptionSummary | null
  analysis?: ReelAnalysisSummary | null
  viralScore?: {
    score: number
    label: string
    primaryReason: string
    reasons: string[]
    viewMultiplier: number
    engagementRate: number
    viewsPerHour: number
  } | null
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
