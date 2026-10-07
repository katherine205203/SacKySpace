import { supabase } from '../../../services/supabase/client'
import { listActions, deleteAction, updateAction } from '../../actionspace/actionService'

export type ReminderEdit = {
  title: string
  note: string
  plannedDate: string
  dueTime: string
  plannedEndDate?: string
  sourceCheckinId?: string | null
}

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to manage actions.')
  return data.user.id
}

export const updateReminder = async (id: string, edit: ReminderEdit): Promise<void> => {
  const title = edit.title.trim()
  if (!title) throw new Error('Action cần có tên.')
  const userId = await currentUserId()
  const existing = edit.plannedEndDate !== undefined && edit.sourceCheckinId !== undefined
    ? null
    : (await listActions(userId)).find((action) => action.id === id)
  if (!existing && (edit.plannedEndDate === undefined || edit.sourceCheckinId === undefined)) throw new Error('Không tìm thấy Action.')
  const plannedEndDate = edit.plannedEndDate ?? existing?.plannedEndDate ?? ''
  const sourceCheckinId = edit.sourceCheckinId !== undefined ? edit.sourceCheckinId : existing?.sourceCheckinId ?? null
  await updateAction(id, {
    title,
    note: edit.note,
    scheduleType: edit.plannedDate ? (plannedEndDate && plannedEndDate !== edit.plannedDate ? 'date_range' : 'date') : 'none',
    plannedDate: edit.plannedDate,
    plannedEndDate,
    dueTime: edit.dueTime,
    sourceCheckinId,
  })
}

export const deleteReminder = async (id: string): Promise<void> => {
  await deleteAction(id)
}
