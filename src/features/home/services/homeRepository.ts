import { supabase } from '../../../services/supabase/client'
import { getReferenceData } from '../../checkin/services/referenceRepository'
import { listCheckins } from '../../checkin/services/checkinRepository'
import type { HomeReminder, HomeSnapshot } from '../types'

type ReminderRow = {
  id: string
  source_checkin_id: string | null
  title: string
  note: string | null
  planned_date: string | null
  due_time: string | null
  status: string
  completed_at: string | null
  origin: string
}

const isDevelopment = import.meta.env.DEV
const HOME_PROJECTION_TIMEOUT_MS = 15_000

const timeHomeDependency = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
  const startedAt = performance.now()
  if (isDevelopment) console.debug(`[Home timing] ${label}: started`)
  try {
    const result = await operation()
    if (isDevelopment) console.debug(`[Home timing] ${label}: resolved in ${Math.round(performance.now() - startedAt)}ms`)
    return result
  } catch (reason: unknown) {
    if (isDevelopment) console.error(`[Home timing] ${label}: rejected after ${Math.round(performance.now() - startedAt)}ms`, reason)
    throw reason
  }
}

const withDevelopmentTimeout = <T>(operation: Promise<T>, label: string): Promise<T> => {
  if (!isDevelopment) return operation

  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      const timeoutError = new Error(`[Home] ${label} timed out after ${HOME_PROJECTION_TIMEOUT_MS}ms.`)
      console.error(timeoutError)
      reject(timeoutError)
    }, HOME_PROJECTION_TIMEOUT_MS)

    void operation.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (reason: unknown) => {
        window.clearTimeout(timeoutId)
        reject(reason)
      },
    )
  })
}

const getDisplayName = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string => {
  const metadata = user?.user_metadata ?? {}
  const value = metadata.full_name ?? metadata.name ?? metadata.display_name
  if (typeof value === 'string' && value.trim()) return value.trim().split(' ')[0]
  const username = user?.email?.split('@')[0]?.split(/[._-]/)[0]
  if (username && username.length <= 16) return username.charAt(0).toUpperCase() + username.slice(1)
  return ''
}

const listHomeReminders = async (userId: string): Promise<HomeReminder[]> => {
  const { data, error } = await timeHomeDependency('supabase.reminders.select', async () => await supabase
    .from('reminders')
    .select('id, title, note, planned_date, due_time, status, completed_at, origin, source_checkin_id')
    .eq('user_id', userId)
    .order('planned_date', { ascending: true, nullsFirst: true })
    .order('due_time', { ascending: true, nullsFirst: false }))
  if (error) throw error

  return ((data ?? []) as ReminderRow[]).map((row) => ({
    id: row.id,
    sourceCheckinId: row.source_checkin_id,
    title: row.title,
    note: row.note,
    plannedDate: row.planned_date,
    dueTime: row.due_time,
    status: row.status,
    completedAt: row.completed_at,
    origin: row.origin,
  }))
}

const getHomeSnapshotUnbounded = async (): Promise<HomeSnapshot> => {
  const { data: userResult, error: userError } = await timeHomeDependency('supabase.auth.getUser', () => supabase.auth.getUser())
  if (userError) throw userError
  if (!userResult.user) throw new Error('You must be signed in to view Home.')

  const reference = await timeHomeDependency('reference.getReferenceData', getReferenceData)
  const [records, reminders] = await Promise.all([
    timeHomeDependency('checkins.listCheckins', () => listCheckins(reference, userResult.user.id)),
    timeHomeDependency('reminders.listHomeReminders', () => listHomeReminders(userResult.user.id)),
  ])

  return {
    displayName: getDisplayName(userResult.user),
    records,
    reminders,
  }
}

export const getHomeSnapshot = (): Promise<HomeSnapshot> =>
  timeHomeDependency(
    'home projection',
    () => withDevelopmentTimeout(getHomeSnapshotUnbounded(), 'Home projection'),
  )
