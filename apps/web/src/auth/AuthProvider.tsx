import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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

  const refresh = async () => {
    const nextSession = await getAuthSession()
    setSession(nextSession)
  }

  useEffect(() => {
    let alive = true

    void getAuthSession()
      .then((nextSession) => {
        if (alive) setSession(nextSession)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    const syncAcrossTabs = () => {
      void getAuthSession().then((nextSession) => {
        if (alive) setSession(nextSession)
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
      signOut: async () => {
        await signOutAuth()
        setSession(null)
      },
    }),
    [session, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
