import { useMemo, useState, type ReactNode } from 'react'
import { createCheckin, draftFromRecord, getCheckin, updateCheckin } from './services/checkinRepository'
import { getReferenceData } from './services/referenceRepository'
import { createEmptyDraft, type CheckinDraft } from './types'
import { checkinFlowContext, type CheckinFlowContextValue } from './useCheckinFlow'

export function CheckinFlowProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CheckinDraft>(createEmptyDraft())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const value = useMemo<CheckinFlowContextValue>(() => ({
    draft,
    isSaving,
    error,
    updateDraft: (patch) => {
      setDraft((current) => ({ ...current, ...patch }))
      setError(null)
    },
    resetDraft: (type = 'emotion') => {
      setDraft(createEmptyDraft(type))
      setError(null)
    },
    saveDraft: async (nextDraft = draft) => {
      setIsSaving(true)
      setError(null)
      try {
        const result = nextDraft.id
          ? await updateCheckin({ ...nextDraft, id: nextDraft.id })
          : await createCheckin(nextDraft)
        const savedDraft = { ...nextDraft, id: result.id, createdAt: result.createdAt }
        setDraft(savedDraft)
        return savedDraft
      } catch (reason: unknown) {
        const message = reason instanceof Error ? reason.message : 'Unable to save this check-in.'
        setError(message)
        throw reason
      } finally {
        setIsSaving(false)
      }
    },
    loadExistingDraft: async (id) => {
      const reference = await getReferenceData()
      const record = await getCheckin(id, reference)
      const nextDraft = draftFromRecord(record)
      setDraft(nextDraft)
      setError(null)
      return nextDraft
    },
    clearError: () => setError(null),
  }), [draft, error, isSaving])

  return <checkinFlowContext.Provider value={value}>{children}</checkinFlowContext.Provider>
}
