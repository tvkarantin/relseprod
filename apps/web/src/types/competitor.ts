export type CompetitorStatus = 'idle' | 'queued' | 'parsing' | 'ready' | 'error'

export interface Competitor {
  id: number
  instagramUsername: string
  profileUrl: string
  status: CompetitorStatus
  reelsCount: number
  lastParsedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CompetitorBrief {
  id: number
  instagramUsername: string
  profileUrl: string
}
