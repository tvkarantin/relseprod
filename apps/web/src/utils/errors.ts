import { ApiError } from '@/api/client'
import { ERROR_CODES } from '@/types/api'

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз'

/** Turn any thrown value into a message that is safe to show a user. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return FALLBACK_MESSAGE
}

export function getErrorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.isNetworkError
}

/** Field-level message for the "add competitor" form. */
export function getCompetitorFormError(error: unknown): string {
  const code = getErrorCode(error)
  if (code === ERROR_CODES.competitorExists) {
    return 'Этот Instagram-аккаунт уже добавлен'
  }
  if (code === ERROR_CODES.invalidProfile) {
    return 'Не похоже на профиль Instagram. Укажите username или ссылку на аккаунт'
  }
  return getErrorMessage(error)
}
