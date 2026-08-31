import { supabase } from '../../../services/supabase/client'
import { getReferenceData } from '../../checkin/services/referenceRepository'
import { listCheckins } from '../../checkin/services/checkinRepository'
import { listDiaryEntries } from '../../diary/services/diaryRepository'
import { getFutureLetterHomeProjection } from '../../futureletter/services/futureLetterRepository'
import { getGiftHomeProjection } from '../../gift/services/giftRepository'
import type { HomeReminder, HomeSnapshot } from '../types'

type ReminderRow = {
  id: string
  source_checkin_id: string | null
  title: string
  note: string | null
  planned_date: string | null
  planned_end_date?: string | null
  due_time: string | null
  status: string
  completed_at: string | null
  origin: string
}

const HOME_PROJECTION_TIMEOUT_MS = 15_000

const timeHomeDependency = async <T>(_label: string, operation: () => Promise<T>): Promise<T> => operation()

const withHomeTimeout = <T>(operation: Promise<T>, label: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`[Home] ${label} timed out after ${HOME_PROJECTION_TIMEOUT_MS}ms.`))
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
  const run = (select: string) => supabase
    .from('reminders')
    .select(select)
    .eq('user_id', userId)
    .order('planned_date', { ascending: true, nullsFirst: true })
    .order('due_time', { ascending: true, nullsFirst: false })
  let result = await timeHomeDependency('supabase.reminders.select', async () => await run('id, title, note, planned_date, planned_end_date, due_time, status, completed_at, origin, source_checkin_id'))
  if (result.error && /planned_end_date|column .* does not exist|schema cache/i.test(result.error.message)) {
    result = await timeHomeDependency('supabase.reminders.select.compatibility', async () => await run('id, title, note, planned_date, due_time, status, completed_at, origin, source_checkin_id'))
  }
  const { data, error } = result
  if (error) throw error

  return ((data ?? []) as unknown as ReminderRow[]).map((row) => ({
    id: row.id,
    sourceCheckinId: row.source_checkin_id,
    title: row.title,
    note: row.note,
    plannedDate: row.planned_date,
    plannedEndDate: row.planned_end_date ?? null,
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

  const [reference, futureLetter, gift] = await Promise.all([
    timeHomeDependency('reference.getReferenceData', getReferenceData),
    timeHomeDependency('future-letter.homeProjection', () => getFutureLetterHomeProjection(userResult.user.id)),
    timeHomeDependency('gift.homeProjection', () => getGiftHomeProjection(userResult.user.id)),
  ])
  const [records, reminders, diaryEntries] = await Promise.all([
    timeHomeDependency('checkins.listCheckins', () => listCheckins(reference, userResult.user.id)),
    timeHomeDependency('reminders.listHomeReminders', () => listHomeReminders(userResult.user.id)),
    timeHomeDependency('diary.listDiaryEntries', listDiaryEntries),
  ])

  return {
    displayName: getDisplayName(userResult.user),
    records,
    reminders,
    diaryEntries,
    futureLetter,
    gift,
  }
}

export const getHomeSnapshot = (): Promise<HomeSnapshot> =>
  timeHomeDependency(
    'home projection',
    () => withHomeTimeout(getHomeSnapshotUnbounded(), 'Home projection'),
  )
