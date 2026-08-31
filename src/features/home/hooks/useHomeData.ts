import { useCallback, useEffect, useRef, useState } from 'react'
import { getHomeSnapshot } from '../services/homeRepository'
import type { HomeSnapshot } from '../types'

export function useHomeData() {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  const refresh = useCallback(async () => {
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
    } catch (reason: unknown) {
      if (isMounted.current) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu Home.')
    } finally {
      if (isMounted.current) setIsLoading(false)
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
