import { supabase } from '../../../services/supabase/client'
import type { ActionDraft, CheckinDraft, CheckinRecord, ReferenceData } from '../types'
import { getCurrentStreakFromOccurredAt, getHistoryDateRange, getLocalDateKey } from '../utils/history'
import { MAX_ACTIONS, MAX_CONTEXTS, MAX_NEEDS, MAX_SECONDARY_EMOTIONS } from '../utils/selectionRules'
import { isRichTextEmpty } from '../../../components/richText'

type CheckinRow = {
  id: string
  user_id: string
  checkin_type: 'emotion' | 'unknown'
  primary_emotion_id: string | null
  intensity: number | null
  note: string | null
  unknown_prompt_id: string | null
  occurred_at?: string | null
  created_at: string
  updated_at: string
}

type CheckinTimeRow = {
  id: string
  occurred_at?: string | null
  created_at: string
  updated_at: string
}

type ActionRow = {
  id: string
  source_checkin_id: string
  care_action_id: string | null
  title: string
  note: string | null
  planned_date: string | null
  due_time: string | null
  status: 'pending' | 'completed'
  completed_at: string | null
}

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to use Check-in.')
  return data.user.id
}

const CHECKIN_SELECT = 'id, user_id, checkin_type, primary_emotion_id, intensity, note, unknown_prompt_id, occurred_at, created_at, updated_at'
const CHECKIN_LEGACY_SELECT = 'id, user_id, checkin_type, primary_emotion_id, intensity, note, unknown_prompt_id, created_at, updated_at'
const isMissingOccurredAtError = (error: { message?: string } | null | undefined): boolean => Boolean(error && /occurred_at|column .* does not exist|schema cache/i.test(error.message ?? ''))

const getOccurredAt = (row: Pick<CheckinRow, 'occurred_at' | 'created_at'>): string => row.occurred_at ?? row.created_at

export const createCheckinId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('Trình duyệt không hỗ trợ tạo mã Check-in an toàn.')
}

export const normalizeOccurredAt = (occurredAt?: string): string => {
  const value = occurredAt ? new Date(occurredAt) : new Date()
  if (Number.isNaN(value.getTime())) throw new Error('Thời điểm trải nghiệm không hợp lệ.')
  if (value.getTime() > Date.now()) throw new Error('Không thể chọn thời gian trong tương lai.')
  return value.toISOString()
}

const unique = (values: string[]): string[] => [...new Set(values)]

const assertSelectionLimit = (label: string, values: { length: number }, limit: number): void => {
  if (values.length > limit) throw new Error(`Check-in chỉ có thể có tối đa ${limit} ${label}.`)
}

const syncRelation = async (
  checkinId: string,
  table: 'checkin_secondary_emotions' | 'checkin_needs' | 'checkin_contexts',
  key: 'emotion_id' | 'need_id' | 'context_id',
  values: string[],
): Promise<void> => {
  const { data, error: loadError } = await supabase.from(table).select(key).eq('checkin_id', checkinId)
  if (loadError) throw loadError

  const existingIds = (data ?? [])
    .map((row) => String((row as Record<string, unknown>)[key] ?? ''))
    .filter(Boolean)
  const removedIds = existingIds.filter((id) => !values.includes(id))
  if (removedIds.length) {
    const { error } = await supabase.from(table).delete().eq('checkin_id', checkinId).in(key, removedIds)
    if (error) throw error
  }

  if (!values.length) return
  const rows = values.map((value, index) => ({ checkin_id: checkinId, [key]: value, position: index + 1 }))
  const { error } = await supabase.from(table).upsert(rows, { onConflict: `checkin_id,${key}` })
  if (error) throw error
}

const syncRelations = async (draft: CheckinDraft): Promise<void> => {
  if (!draft.id) throw new Error('Check-in chưa có mã để lưu các lựa chọn liên quan.')
  const secondaryEmotionIds = unique(draft.secondaryEmotionIds)
  const needIds = unique(draft.needIds)
  const contextIds = unique(draft.contextIds)
  assertSelectionLimit('cảm xúc phụ', secondaryEmotionIds, MAX_SECONDARY_EMOTIONS)
  assertSelectionLimit('nhu cầu', needIds, MAX_NEEDS)
  assertSelectionLimit('bối cảnh', contextIds, MAX_CONTEXTS)
  await syncRelation(draft.id, 'checkin_secondary_emotions', 'emotion_id', secondaryEmotionIds)
  await syncRelation(draft.id, 'checkin_needs', 'need_id', needIds)
  await syncRelation(draft.id, 'checkin_contexts', 'context_id', contextIds)
}

const actionPayload = (action: ActionDraft, userId: string, checkinId: string) => ({
  user_id: userId,
  origin: 'checkin',
  source_checkin_id: checkinId,
  care_action_id: action.careActionId,
  title: action.title.trim(),
  note: action.note.trim() || null,
  planned_date: action.plannedDate || null,
  due_time: action.dueTime || null,
  status: action.status ?? 'pending',
  completed_at: action.completedAt ?? null,
})

const syncActions = async (draft: CheckinDraft, userId: string): Promise<void> => {
  if (!draft.id) throw new Error('Check-in chưa có mã để lưu action.')
  assertSelectionLimit('action', draft.actions, MAX_ACTIONS)

  const { data: existingRows, error: loadError } = await supabase
    .from('reminders')
    .select('id')
    .eq('source_checkin_id', draft.id)
    .eq('origin', 'checkin')
    .eq('user_id', userId)
  if (loadError) throw loadError

  const existingIds = (existingRows ?? []).map((row) => String((row as { id?: unknown }).id ?? '')).filter(Boolean)
  const existingIdSet = new Set(existingIds)
  const desiredExistingIds = draft.actions.map((action) => action.id).filter((id): id is string => Boolean(id && existingIdSet.has(id)))
  const removedIds = existingIds.filter((id) => !desiredExistingIds.includes(id))
  if (removedIds.length) {
    const { error } = await supabase.from('reminders').delete().in('id', removedIds).eq('user_id', userId)
    if (error) throw error
  }

  const newActions = draft.actions.filter((action) => !action.id || !existingIdSet.has(action.id))
  if (newActions.length) {
    const { error } = await supabase.from('reminders').insert(newActions.map((action) => actionPayload(action, userId, draft.id!)))
    if (error) throw error
  }

  for (const action of draft.actions) {
    if (!action.id || !existingIdSet.has(action.id)) continue
    const { error } = await supabase
      .from('reminders')
      .update(actionPayload(action, userId, draft.id!))
      .eq('id', action.id)
      .eq('source_checkin_id', draft.id)
      .eq('origin', 'checkin')
      .eq('user_id', userId)
    if (error) throw error
  }
}

const saveRelationsAndActions = async (draft: CheckinDraft, userId: string): Promise<void> => {
  if (!draft.id) throw new Error('Check-in chưa có mã để lưu các lựa chọn liên quan.')
  // Synchronize in place: remove only stale rows, then upsert the desired rows.
  // This makes retries idempotent and avoids the old delete-all/insert-all path
  // leaving a check-in partially empty when one request fails.
  await syncRelations(draft)
  await syncActions(draft, userId)
}

export const createCheckin = async (
  draft: CheckinDraft,
): Promise<Pick<CheckinRecord, 'id' | 'occurredAt' | 'createdAt' | 'updatedAt'>> => {
  const userId = await currentUserId()
  const occurredAt = normalizeOccurredAt(draft.occurredAt)
  const basePayload = {
    user_id: userId,
    checkin_type: draft.checkinType,
    primary_emotion_id: draft.primaryEmotionId,
    intensity: draft.intensity,
    note: isRichTextEmpty(draft.note) ? null : draft.note,
    unknown_prompt_id: draft.unknownPromptId,
  }
  const { data: rawData, error } = await supabase
    .from('checkins')
    // Keep the id stable across retries. If saving a relation/action fails after
    // the main row was created, retrying this draft updates the same row instead
    // of creating a second check-in.
    .upsert({ ...basePayload, id: draft.id ?? createCheckinId(), occurred_at: occurredAt }, { onConflict: 'id' })
    .select('id, occurred_at, created_at, updated_at')
    .single()
  if (isMissingOccurredAtError(error)) throw new Error('Database Check-in chưa được cập nhật migration thời điểm trải nghiệm.')
  if (error) throw error
  const data = rawData as CheckinTimeRow

  const persistedDraft = { ...draft, id: data.id }
  await saveRelationsAndActions(persistedDraft, userId)
  return { id: data.id, occurredAt: getOccurredAt(data), createdAt: data.created_at, updatedAt: data.updated_at }
}

export const updateCheckin = async (
  draft: CheckinDraft & { id: string },
): Promise<Pick<CheckinRecord, 'id' | 'occurredAt' | 'createdAt' | 'updatedAt'>> => {
  const userId = await currentUserId()
  const occurredAt = normalizeOccurredAt(draft.occurredAt)
  const basePayload = {
    checkin_type: draft.checkinType,
    primary_emotion_id: draft.primaryEmotionId,
    intensity: draft.intensity,
    note: isRichTextEmpty(draft.note) ? null : draft.note,
    unknown_prompt_id: draft.unknownPromptId,
  }
  const { data: rawData, error } = await supabase
    .from('checkins')
    .update({ ...basePayload, occurred_at: occurredAt })
    .eq('id', draft.id)
    .select('id, occurred_at, created_at, updated_at')
    .single()
  if (isMissingOccurredAtError(error)) throw new Error('Database Check-in chưa được cập nhật migration thời điểm trải nghiệm.')
  if (error) throw error
  const data = rawData as CheckinTimeRow

  await saveRelationsAndActions(draft, userId)
  return { id: data.id, occurredAt: getOccurredAt(data), createdAt: data.created_at, updatedAt: data.updated_at }
}

const loadRelations = async (ids: string[]) => {
  if (!ids.length) return { secondary: [], needs: [], contexts: [], actions: [] as ActionRow[] }
  const [secondaryResult, needsResult, contextsResult, actionsResult] = await Promise.all([
    supabase.from('checkin_secondary_emotions').select('checkin_id, emotion_id, position').in('checkin_id', ids).order('position'),
    supabase.from('checkin_needs').select('checkin_id, need_id, position').in('checkin_id', ids).order('position'),
    supabase.from('checkin_contexts').select('checkin_id, context_id, position').in('checkin_id', ids).order('position'),
    supabase.from('reminders').select('id, source_checkin_id, care_action_id, title, note, planned_date, due_time, status, completed_at').eq('origin', 'checkin').in('source_checkin_id', ids),
  ])
  for (const result of [secondaryResult, needsResult, contextsResult, actionsResult]) {
    if (result.error) throw result.error
  }
  return {
    secondary: secondaryResult.data ?? [],
    needs: needsResult.data ?? [],
    contexts: contextsResult.data ?? [],
    actions: actionsResult.data ?? [],
  }
}

const mapRecord = (
  row: CheckinRow,
  relations: Awaited<ReturnType<typeof loadRelations>>,
  reference: ReferenceData,
): CheckinRecord => {
  const emotionById = new Map(reference.emotions.map((emotion) => [emotion.emotion_id, emotion]))
  const needById = new Map(reference.needs.map((need) => [need.need_id, need]))
  const contextById = new Map(reference.contexts.map((context) => [context.context_id, context]))
  const promptById = new Map(reference.unknownPrompts.map((prompt) => [prompt.prompt_id, prompt]))
  return {
    id: row.id,
    userId: row.user_id,
    checkinType: row.checkin_type,
    primaryEmotionId: row.primary_emotion_id,
    primaryEmotion: row.primary_emotion_id ? emotionById.get(row.primary_emotion_id) ?? null : null,
    intensity: row.intensity,
    note: row.note,
    unknownPromptId: row.unknown_prompt_id,
    unknownPrompt: row.unknown_prompt_id ? promptById.get(row.unknown_prompt_id) ?? null : null,
    secondaryEmotions: relations.secondary
      .filter((item) => item.checkin_id === row.id)
      .sort((left, right) => left.position - right.position)
      .map((item) => emotionById.get(item.emotion_id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    needs: relations.needs
      .filter((item) => item.checkin_id === row.id)
      .sort((left, right) => left.position - right.position)
      .map((item) => needById.get(item.need_id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    contexts: relations.contexts
      .filter((item) => item.checkin_id === row.id)
      .sort((left, right) => left.position - right.position)
      .map((item) => contextById.get(item.context_id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    actions: relations.actions
      .filter((item) => item.source_checkin_id === row.id)
      .map((action) => ({
        id: action.id,
        careActionId: action.care_action_id,
        title: action.title,
        note: action.note ?? '',
        plannedDate: action.planned_date ?? '',
        dueTime: action.due_time ?? '',
        status: action.status,
        completedAt: action.completed_at,
      })),
    occurredAt: getOccurredAt(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type CheckinLandingSummary = {
  recent: CheckinRecord[]
  todayCount: number
  periodCount: number
  totalCount: number
  currentStreak: number
}

const LANDING_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const LANDING_SELECT = CHECKIN_SELECT
const LANDING_LEGACY_SELECT = CHECKIN_LEGACY_SELECT

const getLocalDayStart = (dateKey: string): Date => new Date(`${dateKey}T00:00:00+07:00`)

/**
 * Landing only needs the latest records plus lightweight counts and date stamps.
 * Keeping the streak query bounded prevents the landing from loading full history.
 */
export const getCheckinLandingSummary = async (reference: ReferenceData): Promise<CheckinLandingSummary> => {
  const userId = await currentUserId()
  const now = new Date()
  const today = getLocalDateKey(now.toISOString(), LANDING_TIME_ZONE)
  const tomorrow = getLocalDayStart(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const monthStart = getHistoryDateRange('month', now, { start: null, end: null }, LANDING_TIME_ZONE).start
  const monthStartIso = monthStart ? getLocalDayStart(monthStart).toISOString() : undefined
  const todayStartIso = getLocalDayStart(today).toISOString()
  const tomorrowStartIso = tomorrow.toISOString()
  const load = async (dateColumn: 'occurred_at' | 'created_at') => {
    const select = dateColumn === 'occurred_at' ? LANDING_SELECT : LANDING_LEGACY_SELECT
    const scoped = () => supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    const [recentResult, totalResult, periodResult, todayResult, streakResult] = await Promise.all([
      supabase.from('checkins').select(select).eq('user_id', userId).order(dateColumn, { ascending: false }).limit(3),
      scoped(),
      monthStartIso ? scoped().gte(dateColumn, monthStartIso) : scoped(),
      scoped().gte(dateColumn, todayStartIso).lt(dateColumn, tomorrowStartIso),
      supabase.from('checkins').select(dateColumn).eq('user_id', userId).order(dateColumn, { ascending: false }).limit(370),
    ])
    return { dateColumn, recentResult, totalResult, periodResult, todayResult, streakResult }
  }

  let loaded = await load('occurred_at')
  const results = [loaded.recentResult, loaded.totalResult, loaded.periodResult, loaded.todayResult, loaded.streakResult]
  if (results.some((result) => isMissingOccurredAtError(result.error))) loaded = await load('created_at')
  for (const result of [loaded.recentResult, loaded.totalResult, loaded.periodResult, loaded.todayResult, loaded.streakResult]) if (result.error) throw result.error

  const emptyRelations = { secondary: [], needs: [], contexts: [], actions: [] as ActionRow[] }
  const recent = ((loaded.recentResult.data ?? []) as unknown as CheckinRow[]).map((row) => mapRecord(row, emptyRelations, reference))
  const occurredAts = (loaded.streakResult.data ?? [])
    .map((row) => String((row as Record<string, unknown>)[loaded.dateColumn] ?? ''))
    .filter(Boolean)
  return { recent, todayCount: loaded.todayResult.count ?? 0, periodCount: loaded.periodResult.count ?? 0, totalCount: loaded.totalResult.count ?? 0, currentStreak: getCurrentStreakFromOccurredAt(occurredAts, now, LANDING_TIME_ZONE) }
}

export const listCheckins = async (reference: ReferenceData, userId?: string): Promise<CheckinRecord[]> => {
  const run = (select: string, orderColumn: 'occurred_at' | 'created_at') => {
    let query = supabase.from('checkins').select(select).order(orderColumn, { ascending: false })
    if (userId) query = query.eq('user_id', userId)
    return query
  }
  let result = await run(CHECKIN_SELECT, 'occurred_at')
  if (isMissingOccurredAtError(result.error)) result = await run(CHECKIN_LEGACY_SELECT, 'created_at')
  const { data, error } = result
  if (error) throw error
  const rows = (data ?? []) as unknown as CheckinRow[]
  const relations = await loadRelations(rows.map((row) => row.id))
  return rows.map((row) => mapRecord(row, relations, reference))
}

export const getCheckin = async (
  id: string,
  reference: ReferenceData,
): Promise<CheckinRecord> => {
  let result = await supabase.from('checkins').select(CHECKIN_SELECT).eq('id', id).single()
  if (isMissingOccurredAtError(result.error)) result = await supabase.from('checkins').select(CHECKIN_LEGACY_SELECT).eq('id', id).single()
  const { data, error } = result
  if (error) throw error
  const relations = await loadRelations([id])
  return mapRecord(data as CheckinRow, relations, reference)
}

export const deleteCheckin = async (id: string): Promise<void> => {
  const { error } = await supabase.from('checkins').delete().eq('id', id)
  if (error) throw error
}

export const deleteLinkedActions = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('source_checkin_id', id)
    .eq('origin', 'checkin')
    .eq('user_id', userId)
  if (error) throw error
}

export const detachLinkedActions = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('reminders')
    .update({ source_checkin_id: null })
    .eq('source_checkin_id', id)
    .eq('origin', 'checkin')
    .eq('user_id', userId)
  if (error) throw error
}

export const draftFromRecord = (record: CheckinRecord): CheckinDraft => ({
  id: record.id,
  createdAt: record.createdAt,
  occurredAt: record.occurredAt,
  checkinType: record.checkinType,
  primaryEmotionId: record.primaryEmotionId,
  intensity: record.intensity,
  note: record.note ?? '',
  unknownPromptId: record.unknownPromptId,
  secondaryEmotionIds: record.secondaryEmotions.map((emotion) => emotion.emotion_id),
  needIds: record.needs.map((need) => need.need_id),
  contextIds: record.contexts.map((context) => context.context_id),
  actions: record.actions.map((action: ActionDraft) => ({ ...action })),
})
