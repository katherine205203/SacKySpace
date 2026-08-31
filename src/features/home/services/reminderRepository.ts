import { supabase } from '../../../services/supabase/client'
import { listActions, setActionStatus, deleteAction, updateAction } from '../../actionspace/actionService'

export type ReminderEdit = {
  title: string
  note: string
  plannedDate: string
  dueTime: string
}

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to manage actions.')
  return data.user.id
}

export const setReminderCompleted = async (id: string, completed: boolean): Promise<void> => {
  await setActionStatus(id, completed ? 'completed' : 'pending')
}

export const updateReminder = async (id: string, edit: ReminderEdit): Promise<void> => {
  const title = edit.title.trim()
  if (!title) throw new Error('Action cần có tên.')
  const userId = await currentUserId()
  const existing = (await listActions(userId)).find((action) => action.id === id)
  if (!existing) throw new Error('Không tìm thấy Action.')
  await updateAction(id, {
    title,
    note: edit.note,
    scheduleType: edit.plannedDate ? 'date' : 'none',
    plannedDate: edit.plannedDate,
    plannedEndDate: existing.plannedEndDate ?? '',
    dueTime: edit.dueTime,
    sourceCheckinId: existing.sourceCheckinId,
  })
}

export const deleteReminder = async (id: string): Promise<void> => {
  await deleteAction(id)
}
