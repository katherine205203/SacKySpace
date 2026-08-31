import { supabase } from '../../services/supabase/client'
import { getReferenceData } from '../checkin/services/referenceRepository'
import { listCheckins } from '../checkin/services/checkinRepository'
import type { ActionDraft, ActionRecord, ActionReflection, ActionReflectionOutcome, ActionSpaceSnapshot, ActionStatus } from './types'
export { ACTION_INDEPENDENT_COLOR } from './actionPresentation'
export { ACTION_TIME_ZONE, getActionDateKey, getActionRhythm, getActionScheduleLabel, getActionTabItems, getLinkedCheckin, getUpcomingGroups, isActionActiveOn, isActionCompleted } from './actionAggregation'

const BASE_SELECT = 'id, user_id, title, note, planned_date, due_time, status, completed_at, origin, source_checkin_id, care_action_id, created_at, updated_at'
const EXTENDED_SELECT = `${BASE_SELECT}, planned_end_date`

export const DEFAULT_REFLECTION_OUTCOMES: ActionReflectionOutcome[] = [
  { id: 'better', labelVn: 'Ổn hơn', semanticGroup: 'positive', sortOrder: 1 },
  { id: 'lighter', labelVn: 'Nhẹ hơn một chút', semanticGroup: 'positive', sortOrder: 2 },
  { id: 'same', labelVn: 'Không khác mấy', semanticGroup: 'neutral', sortOrder: 3 },
  { id: 'not_better', labelVn: 'Chưa ổn hơn', semanticGroup: 'negative', sortOrder: 4 },
  { id: 'other', labelVn: 'Khác', semanticGroup: 'other', sortOrder: 5 },
]

type ActionRow = {
  id: string
  user_id: string
  title: string
  note: string | null
  planned_date: string | null
  planned_end_date?: string | null
  due_time: string | null
  status: string
  completed_at: string | null
  origin: string
  source_checkin_id: string | null
  care_action_id: string | null
  created_at: string
  updated_at: string
}

type ReflectionRow = {
  id: string
  action_id: string
  completion_cycle_id: string
  outcome_id: string
  outcome_snapshot: string | null
  note: string | null
  created_at: string
}

const errorMessage = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') return reason.message
  return String(reason ?? '')
}
const isMissingCompatibilityColumn = (reason: unknown): boolean => /planned_end_date|column .* does not exist|schema cache/i.test(errorMessage(reason))
const isMissingReflectionSchema = (reason: unknown): boolean => /action_reflection_outcomes|action_completion_cycles|action_reflections|relation .* does not exist|schema cache/i.test(errorMessage(reason))

export const getCurrentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Bạn cần đăng nhập để sử dụng Action Space.')
  return data.user.id
}

const mapAction = (row: ActionRow): ActionRecord => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  note: row.note,
  plannedDate: row.planned_date,
  plannedEndDate: row.planned_end_date ?? null,
  dueTime: row.due_time,
  status: row.status === 'completed' || Boolean(row.completed_at) ? 'completed' : 'pending',
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  origin: row.origin,
  sourceCheckinId: row.source_checkin_id,
  careActionId: row.care_action_id,
})

export const listActions = async (providedUserId?: string): Promise<ActionRecord[]> => {
  const userId = providedUserId ?? await getCurrentUserId()
  const run = (select: string) => supabase
    .from('reminders')
    .select(select)
    .eq('user_id', userId)
    .order('planned_date', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })

  let result = await run(EXTENDED_SELECT)
  if (result.error && isMissingCompatibilityColumn(result.error)) result = await run(BASE_SELECT)
  if (result.error) throw result.error
  return ((result.data ?? []) as unknown as ActionRow[]).map(mapAction)
}

export const listReflectionOutcomes = async (): Promise<ActionReflectionOutcome[]> => {
  const { data, error } = await supabase
    .from('action_reflection_outcomes')
    .select('id, label_vn, semantic_group, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    if (/action_reflection_outcomes|relation .* does not exist|schema cache/i.test(error.message)) return DEFAULT_REFLECTION_OUTCOMES
    throw error
  }
  return ((data ?? []) as Array<{ id: string; label_vn: string; semantic_group: ActionReflectionOutcome['semanticGroup']; sort_order: number }>).map((row) => ({ id: row.id, labelVn: row.label_vn, semanticGroup: row.semantic_group, sortOrder: row.sort_order }))
}

export const listActionReflections = async (actionIds: string[]): Promise<{ reflections: ActionReflection[]; available: boolean }> => {
  if (!actionIds.length) return { reflections: [], available: true }
  const { data, error } = await supabase
    .from('action_reflections')
    .select('id, action_id, completion_cycle_id, outcome_id, outcome_snapshot, note, created_at')
    .in('action_id', actionIds)
    .order('created_at', { ascending: false })
  if (error) {
    if (/action_reflections|relation .* does not exist|schema cache/i.test(error.message)) return { reflections: [], available: false }
    throw error
  }
  return { reflections: ((data ?? []) as ReflectionRow[]).map((row) => ({ id: row.id, actionId: row.action_id, completionCycleId: row.completion_cycle_id, outcomeId: row.outcome_id, outcomeSnapshot: row.outcome_snapshot, note: row.note, createdAt: row.created_at })), available: true }
}

export const loadActionSpaceSnapshot = async (): Promise<ActionSpaceSnapshot> => {
  const userId = await getCurrentUserId()
  const reference = await getReferenceData()
  const [actions, checkins] = await Promise.all([
    listActions(userId),
    listCheckins(reference, userId),
  ])
  const reflectionResult = await listActionReflections(actions.map((action) => action.id))
  return { actions, checkins, reflections: reflectionResult.reflections, reflectionStorageAvailable: reflectionResult.available }
}

const actionPayload = (draft: ActionDraft, userId: string, origin: string, status: ActionStatus = 'pending') => {
  const payload: Record<string, unknown> = {
    user_id: userId,
    origin,
    source_checkin_id: draft.sourceCheckinId,
    title: draft.title.trim(),
    note: draft.note.trim() || null,
    planned_date: draft.plannedDate || null,
    due_time: draft.dueTime || null,
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  }
  payload.planned_end_date = draft.scheduleType === 'date_range' ? draft.plannedEndDate || draft.plannedDate || null : null
  return payload
}

export const createAction = async (draft: ActionDraft, origin = 'user_created'): Promise<ActionRecord> => {
  const title = draft.title.trim()
  if (!title) throw new Error('Action cần có tên.')
  const userId = await getCurrentUserId()
  const payload = actionPayload(draft, userId, origin)
  let result = await supabase.from('reminders').insert(payload).select(EXTENDED_SELECT).single()
  if (result.error && isMissingCompatibilityColumn(result.error)) {
    delete payload.planned_end_date
    result = await supabase.from('reminders').insert(payload).select(BASE_SELECT).single()
  }
  if (result.error) throw result.error
  return mapAction(result.data as ActionRow)
}

export const updateAction = async (id: string, draft: ActionDraft): Promise<ActionRecord> => {
  const title = draft.title.trim()
  if (!title) throw new Error('Action cần có tên.')
  const userId = await getCurrentUserId()
  const payload: Record<string, unknown> = {
    source_checkin_id: draft.sourceCheckinId,
    title,
    note: draft.note.trim() || null,
    planned_date: draft.plannedDate || null,
    due_time: draft.dueTime || null,
  }
  payload.planned_end_date = draft.scheduleType === 'date_range' ? draft.plannedEndDate || draft.plannedDate || null : null
  let result = await supabase.from('reminders').update(payload).eq('id', id).eq('user_id', userId).select(EXTENDED_SELECT).single()
  if (result.error && isMissingCompatibilityColumn(result.error)) {
    delete payload.planned_end_date
    result = await supabase.from('reminders').update(payload).eq('id', id).eq('user_id', userId).select(BASE_SELECT).single()
  }
  if (result.error) throw result.error
  return mapAction(result.data as ActionRow)
}

const getLatestCycle = async (id: string) => {
  const { data, error } = await supabase
    .from('action_completion_cycles')
    .select('id, cycle_number')
    .eq('action_id', id)
    .order('cycle_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (/action_completion_cycles|relation .* does not exist|schema cache/i.test(error.message)) return { cycle: null, available: false }
    throw error
  }
  return { cycle: data as { id: string; cycle_number: number } | null, available: true }
}

export const setActionStatus = async (id: string, status: ActionStatus): Promise<{ cycleId: string | null; historyAvailable: boolean }> => {
  const userId = await getCurrentUserId()
  const completed = status === 'completed'
  const { error } = await supabase
    .from('reminders')
    .update({ status: completed ? 'completed' : 'pending', completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error

  if (!completed) {
    const latest = await getLatestCycle(id)
    if (!latest.available) return { cycleId: null, historyAvailable: false }
    if (!latest.cycle) return { cycleId: null, historyAvailable: true }
    const { error: reopenError } = await supabase.from('action_completion_cycles').update({ reopened_at: new Date().toISOString() }).eq('id', latest.cycle.id)
    if (reopenError) return { cycleId: latest.cycle.id, historyAvailable: false }
    return { cycleId: latest.cycle.id, historyAvailable: !reopenError }
  }

  const previous = await getLatestCycle(id)
  if (!previous.available) return { cycleId: null, historyAvailable: false }
  const nextNumber = (previous.cycle?.cycle_number ?? 0) + 1
  const { data, error: cycleError } = await supabase
    .from('action_completion_cycles')
    .insert({ action_id: id, cycle_number: nextNumber })
    .select('id')
    .single()
  if (cycleError) {
    // The reminder update above is already durable. Keep Done successful and let
    // the reflection modal offer a retry instead of leaving the user with a
    // completed Action and no reflection step.
    if (isMissingReflectionSchema(cycleError)) return { cycleId: null, historyAvailable: false }
    return { cycleId: null, historyAvailable: false }
  }
  return { cycleId: (data as { id: string }).id, historyAvailable: true }
}

export const saveActionReflection = async (actionId: string, outcome: ActionReflectionOutcome, note: string): Promise<void> => {
  let latest = await getLatestCycle(actionId)
  if (!latest.available) throw new Error('Không thể lưu reflection lúc này.')
  if (!latest.cycle) {
    const { data, error } = await supabase
      .from('action_completion_cycles')
      .insert({ action_id: actionId, cycle_number: 1 })
      .select('id')
      .single()
    if (error) {
      if (isMissingReflectionSchema(error)) throw new Error('Không thể lưu reflection lúc này.')
      latest = await getLatestCycle(actionId)
      if (!latest.cycle) throw error
    } else {
      latest = { cycle: data as { id: string; cycle_number: number }, available: true }
    }
  }
  if (!latest.cycle) throw new Error('Không thể lưu reflection lúc này.')
  const { error } = await supabase.from('action_reflections').insert({
    action_id: actionId,
    completion_cycle_id: latest.cycle.id,
    outcome_id: outcome.id,
    outcome_snapshot: outcome.labelVn,
    note: note.trim() || null,
  })
  if (error) throw new Error('Không thể lưu reflection lúc này.')
}

export const deleteAction = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('reminders').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export const linkActionToCheckin = async (actionId: string, checkinId: string | null): Promise<void> => {
  const userId = await getCurrentUserId()
  if (checkinId) {
    const { count, error: countError } = await supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_checkin_id', checkinId)
      .neq('status', 'completed')
    if (countError) throw countError
    if ((count ?? 0) >= 2) throw new Error('Check-in này đã có 2 Action đang hoạt động.')
  }
  const { error } = await supabase.from('reminders').update({ source_checkin_id: checkinId }).eq('id', actionId).eq('user_id', userId)
  if (error) throw error
}
