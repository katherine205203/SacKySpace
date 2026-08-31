import { supabase } from '../../../services/supabase/client'
import type { ActionDraft, CheckinDraft, CheckinRecord, ReferenceData } from '../types'

type CheckinRow = {
  id: string
  user_id: string
  checkin_type: 'emotion' | 'unknown'
  primary_emotion_id: string | null
  intensity: number | null
  note: string | null
  unknown_prompt_id: string | null
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

const insertRelations = async (draft: CheckinDraft): Promise<void> => {
  if (draft.secondaryEmotionIds.length) {
    const { error } = await supabase.from('checkin_secondary_emotions').insert(
      draft.secondaryEmotionIds.map((emotionId, index) => ({
        checkin_id: draft.id,
        emotion_id: emotionId,
        position: index + 1,
      })),
    )
    if (error) throw error
  }
  if (draft.needIds.length) {
    const { error } = await supabase.from('checkin_needs').insert(
      draft.needIds.map((needId, index) => ({
        checkin_id: draft.id,
        need_id: needId,
        position: index + 1,
      })),
    )
    if (error) throw error
  }
  if (draft.contextIds.length) {
    const { error } = await supabase.from('checkin_contexts').insert(
      draft.contextIds.map((contextId, index) => ({
        checkin_id: draft.id,
        context_id: contextId,
        position: index + 1,
      })),
    )
    if (error) throw error
  }
}

const insertActions = async (draft: CheckinDraft, userId: string): Promise<void> => {
  if (!draft.actions.length) return
  if (draft.actions.length > 2 || !draft.id) {
    throw new Error('A check-in can have at most two actions.')
  }
  const { error } = await supabase.from('reminders').insert(
    draft.actions.map((action) => ({
      user_id: userId,
      origin: 'checkin',
      source_checkin_id: draft.id,
      care_action_id: action.careActionId,
      title: action.title.trim(),
      note: action.note.trim() || null,
      planned_date: action.plannedDate || null,
      due_time: action.dueTime || null,
      status: action.status ?? 'pending',
      completed_at: action.completedAt ?? null,
    })),
  )
  if (error) throw error
}

const saveRelationsAndActions = async (draft: CheckinDraft, userId: string): Promise<void> => {
  await insertRelations(draft)
  await insertActions(draft, userId)
}

export const createCheckin = async (
  draft: CheckinDraft,
): Promise<Pick<CheckinRecord, 'id' | 'createdAt' | 'updatedAt'>> => {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      user_id: userId,
      checkin_type: draft.checkinType,
      primary_emotion_id: draft.primaryEmotionId,
      intensity: draft.intensity,
      note: draft.note.trim() || null,
      unknown_prompt_id: draft.unknownPromptId,
    })
    .select('id, created_at, updated_at')
    .single()
  if (error) throw error

  const persistedDraft = { ...draft, id: data.id }
  await saveRelationsAndActions(persistedDraft, userId)
  return { id: data.id, createdAt: data.created_at, updatedAt: data.updated_at }
}

export const updateCheckin = async (
  draft: CheckinDraft & { id: string },
): Promise<Pick<CheckinRecord, 'id' | 'createdAt' | 'updatedAt'>> => {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('checkins')
    .update({
      checkin_type: draft.checkinType,
      primary_emotion_id: draft.primaryEmotionId,
      intensity: draft.intensity,
      note: draft.note.trim() || null,
      unknown_prompt_id: draft.unknownPromptId,
    })
    .eq('id', draft.id)
    .select('id, created_at, updated_at')
    .single()
  if (error) throw error

  const relationTables = ['checkin_secondary_emotions', 'checkin_needs', 'checkin_contexts'] as const
  for (const table of relationTables) {
    const { error: deleteError } = await supabase.from(table).delete().eq('checkin_id', draft.id)
    if (deleteError) throw deleteError
  }
  const { error: actionDeleteError } = await supabase
    .from('reminders')
    .delete()
    .eq('source_checkin_id', draft.id)
    .eq('origin', 'checkin')
  if (actionDeleteError) throw actionDeleteError

  await saveRelationsAndActions(draft, userId)
  return { id: data.id, createdAt: data.created_at, updatedAt: data.updated_at }
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const listCheckins = async (reference: ReferenceData, userId?: string): Promise<CheckinRecord[]> => {
  let query = supabase
    .from('checkins')
    .select('id, user_id, checkin_type, primary_emotion_id, intensity, note, unknown_prompt_id, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as CheckinRow[]
  const relations = await loadRelations(rows.map((row) => row.id))
  return rows.map((row) => mapRecord(row, relations, reference))
}

export const getCheckin = async (
  id: string,
  reference: ReferenceData,
): Promise<CheckinRecord> => {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, user_id, checkin_type, primary_emotion_id, intensity, note, unknown_prompt_id, created_at, updated_at')
    .eq('id', id)
    .single()
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
