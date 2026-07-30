export type TranscriptionStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface TranscriptionWord {
  word: string
  punctuatedWord: string | null
  start: number
  end: number
  confidence: number
  language: string | null
  speaker: number | null
}

export interface TranscriptionUtterance {
  start: number
  end: number
  confidence: number
  channel: number | null
  transcript: string
  speaker: number | null
  words: TranscriptionWord[]
}

export interface TranscriptionParagraph {
  start: number
  end: number
  sentences: unknown[]
  transcript: string
}

export interface TranscriptionSummary {
  id: number
  status: TranscriptionStatus
  dominantLanguage: string | null
  errorCode: string | null
  errorMessage: string | null
  updatedAt: string | null
}

export interface TranscriptionView {
  id: number
  status: TranscriptionStatus
  provider: string
  model: string | null
  transcript: string | null
  dominantLanguage: string | null
  languages: string[] | null
  confidence: number | null
  words: TranscriptionWord[] | null
  utterances: TranscriptionUtterance[] | null
  paragraphs: TranscriptionParagraph[] | null
  providerRequestId: string | null
  providerDuration: number | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
