/** Shapes shared by every endpoint. */

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}

export interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
  pages: number
}

/** Error codes the UI reacts to explicitly. */
export const ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  competitorExists: 'COMPETITOR_ALREADY_EXISTS',
  competitorNotFound: 'COMPETITOR_NOT_FOUND',
  competitorHasActiveJob: 'COMPETITOR_HAS_ACTIVE_JOB',
  reelNotFound: 'REEL_NOT_FOUND',
  jobNotFound: 'JOB_NOT_FOUND',
  activeJobExists: 'ACTIVE_JOB_ALREADY_EXISTS',
  invalidProfile: 'INVALID_INSTAGRAM_PROFILE',
  invalidJobState: 'INVALID_JOB_STATE',
  apifyNotConfigured: 'APIFY_NOT_CONFIGURED',
  network: 'NETWORK_ERROR',
} as const
