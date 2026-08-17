import { API_URL, apiClient } from '@/api/client'
import { getAuthToken } from '@/auth/storage'

export interface AuthConfig {
  authRequired: boolean
  telegramEnabled: boolean
  botUsername: string | null
  botUrl: string | null
}

export interface AuthUser {
  id: number
  telegramId: number
  telegramUsername: string | null
  firstName: string
  lastName: string | null
  displayName: string
  hasAvatar: boolean
}

export interface AuthSession {
  token: string
  expiresAt: string
  user: AuthUser
}

export function fetchAuthConfig(signal?: AbortSignal): Promise<AuthConfig> {
  return apiClient.get<AuthConfig>('/auth/config', signal)
}

export function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  return apiClient.get<AuthUser>('/auth/me', signal)
}

export function exchangeTelegramCode(code: string): Promise<AuthSession> {
  return apiClient.post<AuthSession>('/auth/telegram/exchange', { code })
}

export function deleteAuthSession(): Promise<void> {
  return apiClient.delete<void>('/auth/session')
}

export async function fetchTelegramAvatarObjectUrl(signal?: AbortSignal): Promise<string | null> {
  const token = getAuthToken()
  if (!token) return null

  const response = await fetch(`${API_URL}/auth/me/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Avatar request failed (${response.status})`)
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}
