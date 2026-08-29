import { useCallback, useEffect, useRef, useState } from 'react'
import { getHomeSnapshot } from '../services/homeRepository'
import type { HomeSnapshot } from '../types'

const isDevelopment = import.meta.env.DEV

const logHomeLifecycle = (message: string, details?: unknown): void => {
  if (!isDevelopment) return
  if (details === undefined) console.debug(`[Home] ${message}`)
  else console.debug(`[Home] ${message}`, details)
}

export function useHomeData() {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  const refresh = useCallback(async () => {
    logHomeLifecycle('refresh started')
    if (isMounted.current) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const nextSnapshot = await getHomeSnapshot()
      if (isMounted.current) {
        setSnapshot(nextSnapshot)
        setError(null)
      }
      logHomeLifecycle('refresh resolved', { checkins: nextSnapshot.records.length, reminders: nextSnapshot.reminders.length })
    } catch (reason: unknown) {
      if (isMounted.current) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu Home.')
      logHomeLifecycle('refresh rejected', reason)
    } finally {
      if (isMounted.current) setIsLoading(false)
      logHomeLifecycle('refresh finally: loading=false')
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => {
      isMounted.current = false
      window.clearTimeout(timer)
    }
  }, [refresh])

  return { snapshot, isLoading, error, refresh }
}
