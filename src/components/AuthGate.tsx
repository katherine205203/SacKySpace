import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, subscribeToAuthChanges } from '../services/supabase/auth'
import { SignInScreen } from './SignInScreen'

type AuthGateProps = {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    void getSession()
      .then((nextSession) => {
        if (isMounted) setSession(nextSession)
      })
      .catch((reason: unknown) => {
        if (isMounted) setError(reason instanceof Error ? reason.message : 'Unable to load session.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    const { data } = subscribeToAuthChanges((_event, nextSession) => {
      if (isMounted) setSession(nextSession)
    })
    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (isLoading) return <div className="auth-state">Loading SacKy…</div>
  if (error) return <div className="auth-state auth-state--error">{error}</div>
  if (!session) return <SignInScreen />
  return <>{children}</>
}
