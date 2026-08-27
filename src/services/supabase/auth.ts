import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from './client'

export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export const signIn = async (email: string, password: string): Promise<Session> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.session) throw new Error('No session was returned after sign-in.')
  return data.session
}

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const subscribeToAuthChanges = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) => supabase.auth.onAuthStateChange(callback)
