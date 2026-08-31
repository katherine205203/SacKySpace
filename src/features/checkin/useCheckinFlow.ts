import { createContext, useContext } from 'react'
import type { CheckinDraft, CheckinType } from './types'

export type CheckinFlowContextValue = {
  draft: CheckinDraft
  isSaving: boolean
  error: string | null
  updateDraft: (patch: Partial<CheckinDraft>) => void
  resetDraft: (type?: CheckinType) => void
  saveDraft: (nextDraft?: CheckinDraft) => Promise<CheckinDraft>
  completeCheckin: (nextDraft?: CheckinDraft) => Promise<CheckinDraft>
  loadExistingDraft: (id: string) => Promise<CheckinDraft>
  clearError: () => void
}

export const checkinFlowContext = createContext<CheckinFlowContextValue | null>(null)

export const useCheckinFlow = (): CheckinFlowContextValue => {
  const context = useContext(checkinFlowContext)
  if (!context) throw new Error('useCheckinFlow must be used inside CheckinFlowProvider')
  return context
}
