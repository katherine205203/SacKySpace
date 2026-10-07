import { supabase } from '../../../services/supabase/client'
import { getReferenceData } from '../../checkin/services/referenceRepository'
import { listCheckins } from '../../checkin/services/checkinRepository'
import { getDiaryEntry } from '../../diary/services/diaryRepository'
import { getDiaryLocalDate } from '../../diary/utils'
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
const HOME_SNAPSHOT_TTL_MS = 15_000

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
  let result = await run('id, title, note, planned_date, planned_end_date, due_time, status, completed_at, origin, source_checkin_id')
  if (result.error && /planned_end_date|column .* does not exist|schema cache/i.test(result.error.message)) result = await run('id, title, note, planned_date, due_time, status, completed_at, origin, source_checkin_id')
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

type HomeUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

const getHomeSnapshotUnbounded = async (user: HomeUser): Promise<HomeSnapshot> => {
  const [reference, futureLetter, gift] = await Promise.all([
    getReferenceData(),
    getFutureLetterHomeProjection(user.id),
    getGiftHomeProjection(user.id),
  ])
  const [records, reminders, diaryEntry] = await Promise.all([
    listCheckins(reference, user.id),
    listHomeReminders(user.id),
    getDiaryEntry(getDiaryLocalDate(), { finalize: false, userId: user.id }),
  ])

  return {
    displayName: getDisplayName(user),
    records,
    reminders,
    diaryEntries: diaryEntry ? [diaryEntry] : [],
    futureLetter,
    gift,
  }
}

let homeCache: { userId: string; snapshot: HomeSnapshot; expiresAt: number } | null = null
let homeRequest: { userId: string; promise: Promise<HomeSnapshot> } | null = null

export const clearHomeSnapshotCache = (): void => {
  homeCache = null
}

export const getHomeSnapshot = async ({ force = false }: { force?: boolean } = {}): Promise<HomeSnapshot> => {
  const { data: userResult, error: userError } = await withHomeTimeout(
    supabase.auth.getUser(),
    'Home authentication',
  )
  if (userError) throw userError
  if (!userResult.user) throw new Error('You must be signed in to view Home.')

  const user = userResult.user as HomeUser
  const now = Date.now()
  if (!force && homeCache?.userId === user.id && homeCache.expiresAt > now) return homeCache.snapshot
  if (homeRequest?.userId === user.id) return homeRequest.promise

  const promise = withHomeTimeout(getHomeSnapshotUnbounded(user), 'Home projection')
  homeRequest = { userId: user.id, promise }

  try {
    const snapshot = await promise
    homeCache = { userId: user.id, snapshot, expiresAt: Date.now() + HOME_SNAPSHOT_TTL_MS }
    return snapshot
  } finally {
    if (homeRequest?.promise === promise) homeRequest = null
  }
}
