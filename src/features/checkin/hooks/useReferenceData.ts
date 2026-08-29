import { useEffect, useState } from 'react'
import { getReferenceData } from '../services/referenceRepository'
import type { ReferenceData } from '../types'

export function useReferenceData() {
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    void getReferenceData()
      .then((data) => { if (isMounted) setReference(data) })
      .catch((reason: unknown) => { if (isMounted) setError(reason instanceof Error ? reason.message : 'Unable to load reference data.') })
    return () => { isMounted = false }
  }, [])

  return { reference, error }
}
