import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type SaveFunction<T> = (value: T) => Promise<void> | void

type AutosaveOptions = {
  delay?: number
}

/**
 * Small, last-write-wins queue for editors. It keeps the debounce/timer
 * lifecycle in one place while allowing each feature to decide how a draft is
 * persisted (remote, local, or both).
 */
export function useAutosave<T>(save: SaveFunction<T>, { delay = 650 }: AutosaveOptions = {}) {
  const saveRef = useRef(save)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<T | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const [status, setStatus] = useState<AutosaveStatus>('idle')

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (inFlightRef.current) return inFlightRef.current

    const value = pendingRef.current
    if (value === null) return

    pendingRef.current = null
    setStatus('saving')
    const currentSave = Promise.resolve()
      .then(() => saveRef.current(value))
      .then(() => {
        setStatus('saved')
        if (pendingRef.current !== null) void flushRef.current()
      })
      .catch((reason: unknown) => {
        if (pendingRef.current === null) pendingRef.current = value
        setStatus('error')
        throw reason
      })
      .finally(() => {
        inFlightRef.current = null
      })

    inFlightRef.current = currentSave
    return currentSave
  }, [])

  useEffect(() => {
    saveRef.current = save
    flushRef.current = flush
  }, [flush, save])

  const schedule = useCallback((value: T) => {
    pendingRef.current = value
    setStatus('pending')
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void flush().catch(() => undefined)
    }, delay)
  }, [delay, flush])

  const cancel = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
    if (!inFlightRef.current) setStatus('idle')
  }, [])

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
  }, [])

  return { cancel, flush, schedule, status }
}
