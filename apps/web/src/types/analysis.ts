export type ReelAnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ReelAnalysisSegment {
  text: string
  sourceUtteranceIndexes: number[]
  start: number
  end: number
}

export interface ReelAnalysisUsage {
  promptTokens: number | null
  completionTokens: number | null
  reasoningTokens: number | null
  totalTokens: number | null
}

export interface ReelAnalysisSummary {
  id: number
  status: ReelAnalysisStatus
  topic: string | null
  errorCode: string | null
  updatedAt: string | null
}

export interface ReelAnalysisView {
  id: number
  reelId: number
  transcriptionId: number
  status: ReelAnalysisStatus
  provider: string
  requestedModel: string
  resolvedModel: string | null
  promptVersion: string

  sourceLanguage: string | null
  russianTranscript: string | null
  title: string | null
  topic: string | null
  summary: string | null

  hook: ReelAnalysisSegment | null
  mainPart: ReelAnalysisSegment[] | null
  conclusion: ReelAnalysisSegment | null
  cta: ReelAnalysisSegment | null

  suggestedHook: string | null
  suggestedScript: string | null
  suggestedCta: string | null

  usage: ReelAnalysisUsage | null

  errorCode: string | null
  errorMessage: string | null

  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
