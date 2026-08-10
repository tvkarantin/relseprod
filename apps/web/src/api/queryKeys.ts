/** Central registry of TanStack Query keys for precise invalidation. */

import type { MyReelsQuery, ReelsQuery } from './reels'

export const queryKeys = {
  dashboard: {
    summary: () => ['dashboard', 'summary'] as const,
  },
  competitors: {
    all: () => ['competitors'] as const,
    list: () => ['competitors', 'list'] as const,
    details: (id: number) => ['competitors', 'details', id] as const,
  },
  jobs: {
    all: () => ['jobs'] as const,
    details: (id: number) => ['jobs', 'details', id] as const,
  },
  reels: {
    all: () => ['reels'] as const,
    list: (query: ReelsQuery) => ['reels', 'list', query] as const,
    details: (id: number) => ['reels', 'details', id] as const,
    my: (query: MyReelsQuery) => ['reels', 'my', query] as const,
    contentPlan: () => ['reels', 'my', 'content-plan'] as const,
    transcription: (id: number) => ['reels', 'transcription', id] as const,
    analysis: (id: number) => ['reels', 'analysis', id] as const,
  },
} as const
