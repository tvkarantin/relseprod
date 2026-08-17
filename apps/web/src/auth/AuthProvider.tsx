import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  deleteAuthSession,
  exchangeTelegramCode,
  fetchAuthConfig,
  fetchCurrentUser,
  type AuthConfig,
  type AuthUser,
} from '@/api/auth'
import { ApiError } from '@/api/client'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/auth/storage'

interface AuthContextValue {
  config: AuthConfig | null
  user: AuthUser | null
  loading: boolean
  exchangeTelegram: (code: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const bootstrap = async () => {
      try {
        const nextConfig = await fetchAuthConfig(controller.signal)
        setConfig(nextConfig)

        if (!getAuthToken()) return
        try {
          setUser(await fetchCurrentUser(controller.signal))
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            clearAuthToken()
            setUser(null)
            return
          }
          throw error
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error('Auth bootstrap failed', error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void bootstrap()
    return () => controller.abort()
  }, [])

  const exchangeTelegram = useCallback(async (code: string) => {
    const session = await exchangeTelegramCode(code)
    setAuthToken(session.token)
    setUser(session.user)
    return session.user
  }, [])

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) await deleteAuthSession()
    } catch (error) {
      console.warn('Server logout failed; local session will still be removed', error)
    } finally {
      clearAuthToken()
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null)
      return
    }
    setUser(await fetchCurrentUser())
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ config, user, loading, exchangeTelegram, logout, refreshUser }),
    [config, user, loading, exchangeTelegram, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
