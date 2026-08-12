export type AuthUser = {
  id: string
  email?: string | null
  phone?: string | null
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

type TokenPayload = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  user?: AuthUser
  error?: string
  error_description?: string
  msg?: string
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const STORAGE_KEY = 'reels-finder.auth.session'
const NEXT_KEY = 'reels-finder.auth.next'
const EXPIRY_SKEW_MS = 60_000

export const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)

function getHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as TokenPayload
    return payload.error_description ?? payload.msg ?? payload.error ?? `Ошибка авторизации (${response.status})`
  } catch {
    return `Ошибка авторизации (${response.status})`
  }
}

function saveSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function readSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as AuthSession
    if (!session.accessToken || !session.refreshToken || !session.expiresAt || !session.user?.id) {
      saveSession(null)
      return null
    }
    return session
  } catch {
    saveSession(null)
    return null
  }
}

async function fetchUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: getHeaders(accessToken),
  })

  if (!response.ok) throw new Error(await getErrorMessage(response))
  return (await response.json()) as AuthUser
}

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  })

  if (!response.ok) {
    saveSession(null)
    return null
  }

  const payload = (await response.json()) as TokenPayload
  if (!payload.access_token || !payload.refresh_token) {
    saveSession(null)
    return null
  }

  const user = payload.user ?? (await fetchUser(payload.access_token))
  const nextSession: AuthSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    user,
  }
  saveSession(nextSession)
  return nextSession
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (!isAuthConfigured) return null
  const session = readSession()
  if (!session) return null

  if (session.expiresAt - EXPIRY_SKEW_MS <= Date.now()) {
    return refreshSession(session)
  }

  return session
}

export function getSafeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

export function beginTelegramAuth(next = '/dashboard') {
  if (!isAuthConfigured) {
    throw new Error('Авторизация ещё не настроена в окружении приложения.')
  }

  const safeNext = getSafeNext(next)
  sessionStorage.setItem(NEXT_KEY, safeNext)

  const callbackUrl = `${window.location.origin}/auth/callback`
  const authorizeUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`)
  authorizeUrl.searchParams.set('provider', 'custom:telegram')
  authorizeUrl.searchParams.set('redirect_to', callbackUrl)
  window.location.assign(authorizeUrl.toString())
}

export function takeAuthNext(): string {
  const next = getSafeNext(sessionStorage.getItem(NEXT_KEY))
  sessionStorage.removeItem(NEXT_KEY)
  return next
}

export async function consumeAuthCallback(): Promise<AuthSession> {
  if (!isAuthConfigured) {
    throw new Error('Авторизация ещё не настроена в окружении приложения.')
  }

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const error = params.get('error_description') ?? params.get('error')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const expiresIn = Number(params.get('expires_in') ?? 3600)

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)

  if (error) throw new Error(error)
  if (!accessToken || !refreshToken) {
    throw new Error('Telegram не вернул сессию. Запусти вход ещё раз.')
  }

  const user = await fetchUser(accessToken)
  const session: AuthSession = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    user,
  }
  saveSession(session)
  return session
}

export async function signOutAuth() {
  const session = readSession()
  saveSession(null)
  if (!session || !isAuthConfigured) return

  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: getHeaders(session.accessToken),
    })
  } catch {
    // The local session is already removed. Network logout can safely fail here.
  }
}
