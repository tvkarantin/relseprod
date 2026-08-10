export interface CreatorProfile {
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

export const DEFAULT_CREATOR_PROFILE: CreatorProfile = {
  niche: '',
  targetAudience: '',
  product: '',
  toneOfVoice: 'Спокойный, уверенный, без канцелярита',
  videoLengthSeconds: 45,
  addressForm: 'ты',
  profanity: 'Без мата',
  expertise: 'Практик: объясняю через собственный опыт и примеры',
  favoriteCtas: ['Сохрани, чтобы вернуться позже'],
}

const STORAGE_KEY = 'reels-finder.creator-profile.v1'

export function loadCreatorProfile(): CreatorProfile {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? { ...DEFAULT_CREATOR_PROFILE, ...JSON.parse(stored) } : DEFAULT_CREATOR_PROFILE
  } catch {
    return DEFAULT_CREATOR_PROFILE
  }
}

export function saveCreatorProfile(profile: CreatorProfile): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function isCreatorProfileReady(profile: CreatorProfile): boolean {
  return Boolean(profile.niche.trim() && profile.targetAudience.trim())
}
