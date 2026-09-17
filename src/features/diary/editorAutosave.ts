import type { DiaryDraft } from './types'
import { isDiaryBackfilledDate } from './utils'
import { isRichTextEmpty } from '../../components/richText'

export type DiaryEditorCache = {
  draft: DiaryDraft
  cachedAt: string
}

const LEGACY_CACHE_TIMESTAMP = '1970-01-01T00:00:00.000Z'

/**
 * Accept both the pre-autosave cache shape and the timestamped envelope.
 * The timestamp belongs to the local autosave event, not to the persisted Diary
 * row, so an unsaved edit can win over an older remote row on the next load.
 */
export const parseDiaryEditorCache = (value: unknown, localDate: string): DiaryEditorCache | null => {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const rawDraft = record.draft && typeof record.draft === 'object' ? record.draft : value
  if (!rawDraft || typeof rawDraft !== 'object') return null

  const draft = rawDraft as DiaryDraft
  if (draft.localDate !== localDate) return null

  const rawStatus = String(draft.status)
  const normalizedDraft: DiaryDraft = {
    ...draft,
    status: rawStatus === 'done' || rawStatus === 'user_done' || rawStatus === 'day_locked' ? 'done' : 'draft',
    completionSource: rawStatus === 'day_locked' ? 'system' : rawStatus === 'user_done' ? 'user' : draft.completionSource ?? null,
    isBackfilled: draft.isBackfilled ?? isDiaryBackfilledDate(localDate),
  }

  return {
    draft: normalizedDraft,
    cachedAt: typeof record.cachedAt === 'string' && record.cachedAt ? record.cachedAt : draft.updatedAt || LEGACY_CACHE_TIMESTAMP,
  }
}

/**
 * A stable, serializable representation used to avoid saving the same draft
 * repeatedly while React state is being updated with backend metadata.
 */
export const getDiaryDraftSignature = (draft: DiaryDraft): string => JSON.stringify({
  localDate: draft.localDate,
  status: draft.status,
  completionSource: draft.completionSource,
  title: draft.title,
  overallText: draft.overallText,
  dailyEmotionId: draft.dailyEmotionId,
  dailyEmotionSnapshot: draft.dailyEmotionSnapshot,
  promptResponses: draft.promptResponses,
  checkinLinks: draft.checkinLinks,
  images: draft.images,
})

/**
 * Blank, never-persisted editors do not need a remote row. Once a row exists,
 * its id keeps autosave active even when the user deletes all visible content.
 */
export const hasDiaryDraftContent = (draft: DiaryDraft): boolean => Boolean(
  draft.id
  || draft.title.trim()
  || !isRichTextEmpty(draft.overallText)
  || draft.dailyEmotionId
  || draft.promptResponses.length
  || draft.checkinLinks.length
  || draft.images.length,
)
