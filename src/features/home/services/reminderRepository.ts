import { supabase } from '../../../services/supabase/client'

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
  const userId = await currentUserId()
  const { error } = await supabase
    .from('reminders')
    .update({
      status: completed ? 'completed' : 'pending',
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export const updateReminder = async (id: string, edit: ReminderEdit): Promise<void> => {
  const title = edit.title.trim()
  if (!title) throw new Error('Action cần có tên.')
  const userId = await currentUserId()
  const { error } = await supabase
    .from('reminders')
    .update({
      title,
      note: edit.note.trim() || null,
      planned_date: edit.plannedDate || null,
      due_time: edit.dueTime || null,
    })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export const deleteReminder = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
