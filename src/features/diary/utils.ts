import type { DiaryEntry } from './types'

export const DIARY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export const getDiaryLocalDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DIARY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const fromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export const addDiaryDays = (dateKey: string, amount: number): string => {
  const date = fromDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export const formatDiaryDate = (dateKey: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string =>
  new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: DIARY_TIME_ZONE }).format(new Date(`${dateKey}T12:00:00+07:00`))

export const formatDiaryShortDate = (dateKey: string): string =>
  new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: DIARY_TIME_ZONE }).format(new Date(`${dateKey}T12:00:00+07:00`))

export const formatDiaryMonth = (date: Date): string =>
  new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: DIARY_TIME_ZONE }).format(date)

export const monthDateKey = (date: Date): string => {
  const dateKey = getDiaryLocalDate(date)
  return `${dateKey.slice(0, 7)}-01`
}

export const isDiaryDateToday = (dateKey: string, now = new Date()): boolean => dateKey === getDiaryLocalDate(now)

export const clampDiaryWeight = (value: number): number => Math.max(1, Math.min(100, Math.round(value)))

export const createDiaryId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `diary-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const getDiaryMetrics = (entries: readonly DiaryEntry[], now = new Date()) => {
  const isFinished = (entry: DiaryEntry): boolean => entry.status === 'done' || entry.status === 'user_done' || entry.status === 'day_locked'
  const doneDates = new Set(entries.filter(isFinished).map((entry) => entry.localDate))
  let currentStreak = 0
  let cursor = getDiaryLocalDate(now)
  while (doneDates.has(cursor)) {
    currentStreak += 1
    cursor = addDiaryDays(cursor, -1)
  }
  const ordered = [...doneDates].sort()
  let longestStreak = 0
  let run = 0
  let previous: string | null = null
  for (const date of ordered) {
    run = previous && date === addDiaryDays(previous, 1) ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = date
  }
  const month = getDiaryLocalDate(now).slice(0, 7)
  return {
    currentStreak,
    longestStreak,
    doneCount: entries.filter((entry) => isFinished(entry) && entry.localDate.startsWith(month)).length,
    draftCount: entries.filter((entry) => entry.status === 'draft').length,
  }
}
