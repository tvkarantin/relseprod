import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  beginTelegramAuth,
  getAuthSession,
  signOutAuth,
  type AuthSession,
} from '@/auth/authClient'

type AuthContextValue = {
  session: AuthSession | null
  isLoading: boolean
  refresh: () => Promise<void>
  signInWithTelegram: (next?: string) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const nextSession = await getAuthSession()
      setSession(nextSession)
    } catch {
      setSession(null)
    }
  }, [])

  const signOut = useCallback(async () => {
    await signOutAuth()
    setSession(null)
  }, [])

  useEffect(() => {
    let alive = true

    void getAuthSession()
      .then((nextSession) => {
        if (alive) setSession(nextSession)
      })
      .catch(() => {
        if (alive) setSession(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    const syncAcrossTabs = () => {
      void getAuthSession()
        .then((nextSession) => {
          if (alive) setSession(nextSession)
        })
        .catch(() => {
          if (alive) setSession(null)
        })
    }
    window.addEventListener('storage', syncAcrossTabs)

    return () => {
      alive = false
      window.removeEventListener('storage', syncAcrossTabs)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      refresh,
      signInWithTelegram: beginTelegramAuth,
      signOut,
    }),
    [session, isLoading, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
