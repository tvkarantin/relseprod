/** Test-only fixtures. Never imported by application code. */

import type { Competitor } from '@/types/competitor'
import type { ParsingJob } from '@/types/job'
import type { Reel, ReelContent } from '@/types/reel'

export function makeCompetitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    id: 1,
    activeJobId: null,
    instagramUsername: 'example',
    profileUrl: 'https://www.instagram.com/example/',
    status: 'ready',
    reelsCount: 12,
    lastParsedAt: '2026-07-20T10:00:00Z',
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-20T10:00:00Z',
    ...overrides,
  }
}

export function makeContent(overrides: Partial<ReelContent> = {}): ReelContent {
  return {
    hook: '',
    script: '',
    cta: '',
    notes: '',
    contentStatus: 'new',
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-20T10:00:00Z',
    ...overrides,
  }
}

export function makeReel(overrides: Partial<Reel> = {}): Reel {
  return {
    id: 1,
    competitor: {
      id: 1,
      instagramUsername: 'example',
      profileUrl: 'https://www.instagram.com/example/',
    },
    instagramId: '123456',
    shortcode: 'ABC123',
    originalUrl: 'https://www.instagram.com/reel/ABC123/',
    videoUrl: 'https://cdn.example.com/video.mp4',
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    caption: 'Как снимать рилсы',
    viewsCount: 100000,
    likesCount: 5000,
    commentsCount: 120,
    publishedAt: '2026-07-20T10:00:00Z',
    duration: 28.5,
    content: makeContent(),
    ...overrides,
  }
}

export function makeJob(overrides: Partial<ParsingJob> = {}): ParsingJob {
  return {
    id: 1,
    competitorId: 1,
    apifyRunId: 'run-1',
    importMode: 'popular',
    status: 'queued',
    progress: 0,
    reelsCreated: 0,
    reelsUpdated: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-07-26T18:00:00Z',
    ...overrides,
  }
}

export function page<T>(items: T[], overrides: Partial<{ page: number; limit: number; total: number; pages: number }> = {}) {
  return {
    items,
    page: 1,
    limit: 20,
    total: items.length,
    pages: items.length ? 1 : 0,
    ...overrides,
  }
}
