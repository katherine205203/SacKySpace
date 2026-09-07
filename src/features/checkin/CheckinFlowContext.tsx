import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createCheckin, draftFromRecord, getCheckin, updateCheckin } from './services/checkinRepository'
import { getReferenceData } from './services/referenceRepository'
import { createEmptyDraft, type CheckinDraft } from './types'
import { checkinFlowContext, type CheckinFlowContextValue } from './useCheckinFlow'
import { isRichTextEmpty } from '../../components/richText'

const DRAFT_STORAGE_KEY = 'sacky:checkin-draft:v1'

const readStoredDraft = (): CheckinDraft | null => {
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as CheckinDraft
    if (!parsed || (parsed.checkinType !== 'emotion' && parsed.checkinType !== 'unknown')) return null
    return parsed
  } catch {
    return null
  }
}

export function CheckinFlowProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CheckinDraft>(() => readStoredDraft() ?? createEmptyDraft())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipDraftPersistence = useRef(false)

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
      setDraft(nextDraft)
      setError(null)
      return nextDraft
    },
    completeCheckin: async (nextDraft = draft) => {
      setIsSaving(true)
      setError(null)
      try {
        const result = nextDraft.id
          ? await updateCheckin({ ...nextDraft, id: nextDraft.id })
          : await createCheckin(nextDraft)
        const savedDraft = { ...nextDraft, id: result.id, createdAt: result.createdAt }
        skipDraftPersistence.current = true
        setDraft(createEmptyDraft(nextDraft.checkinType))
        window.localStorage.removeItem(DRAFT_STORAGE_KEY)
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

  useEffect(() => {
    if (skipDraftPersistence.current) {
      skipDraftPersistence.current = false
      return
    }
    try {
      const hasContent = Boolean(
        draft.id
        || draft.primaryEmotionId
        || draft.unknownPromptId
        || !isRichTextEmpty(draft.note)
        || draft.secondaryEmotionIds.length
        || draft.needIds.length
        || draft.contextIds.length
        || draft.actions.length,
      )
      if (hasContent) window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      else window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      // Draft persistence is a convenience; the in-memory draft remains authoritative.
    }
  }, [draft])

  return <checkinFlowContext.Provider value={value}>{children}</checkinFlowContext.Provider>
}
