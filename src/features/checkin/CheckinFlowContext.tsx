import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createCheckin, draftFromRecord, getCheckin, updateCheckin } from './services/checkinRepository'
import { getReferenceData } from './services/referenceRepository'
import { createEmptyDraft, type CheckinDraft, type CheckinType } from './types'

type CheckinFlowContextValue = {
  draft: CheckinDraft
  isSaving: boolean
  error: string | null
  updateDraft: (patch: Partial<CheckinDraft>) => void
  resetDraft: (type?: CheckinType) => void
  saveDraft: (nextDraft?: CheckinDraft) => Promise<CheckinDraft>
  loadExistingDraft: (id: string) => Promise<CheckinDraft>
  clearError: () => void
}

const CheckinFlowContext = createContext<CheckinFlowContextValue | null>(null)

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

  return <CheckinFlowContext.Provider value={value}>{children}</CheckinFlowContext.Provider>
}

export const useCheckinFlow = (): CheckinFlowContextValue => {
  const context = useContext(CheckinFlowContext)
  if (!context) throw new Error('useCheckinFlow must be used inside CheckinFlowProvider')
  return context
}
