export type AppLanguage = 'ru' | 'en'

export interface CreatorProfile {
  language: AppLanguage
  niche: string
  targetAudience: string
  product: string
  toneOfVoice: string
  videoLengthSeconds: number
  addressForm: 'ты' | 'вы'
  profanity: string
  expertise: string
  favoriteCtas: string[]
}

export const RU_PROFILE_DEFAULTS = {
  toneOfVoice: 'Спокойный, уверенный, без канцелярита',
  profanity: 'Без мата',
  expertise: 'Практик: объясняю через собственный опыт и примеры',
  favoriteCta: 'Сохрани, чтобы вернуться позже',
} as const

export const EN_PROFILE_DEFAULTS = {
  toneOfVoice: 'Calm, confident, clear and conversational',
  profanity: 'No profanity',
  expertise: 'Practitioner: explain through first-hand experience and examples',
  favoriteCta: 'Save this for later',
} as const

export const DEFAULT_CREATOR_PROFILE: CreatorProfile = {
  language: 'ru',
  niche: '',
  targetAudience: '',
  product: '',
  toneOfVoice: RU_PROFILE_DEFAULTS.toneOfVoice,
  videoLengthSeconds: 45,
  addressForm: 'ты',
  profanity: RU_PROFILE_DEFAULTS.profanity,
  expertise: RU_PROFILE_DEFAULTS.expertise,
  favoriteCtas: [RU_PROFILE_DEFAULTS.favoriteCta],
}

export const CREATOR_PROFILE_STORAGE_KEY = 'reels-finder.creator-profile.v1'
export const CREATOR_PROFILE_UPDATED_EVENT = 'reels-finder:creator-profile-updated'

export function loadCreatorProfile(): CreatorProfile {
  try {
    const stored = window.localStorage.getItem(CREATOR_PROFILE_STORAGE_KEY)
    return stored ? { ...DEFAULT_CREATOR_PROFILE, ...JSON.parse(stored) } : DEFAULT_CREATOR_PROFILE
  } catch {
    return DEFAULT_CREATOR_PROFILE
  }
}

export function saveCreatorProfile(profile: CreatorProfile): void {
  window.localStorage.setItem(CREATOR_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  window.dispatchEvent(new CustomEvent(CREATOR_PROFILE_UPDATED_EVENT, { detail: profile }))
}

export function isCreatorProfileReady(profile: CreatorProfile): boolean {
  return Boolean(profile.niche.trim() && profile.targetAudience.trim())
}
