import type { CheckinRecord } from '../types'

export type HistoryPreset = 'all' | 'today' | 'week' | 'month' | 'custom'

export type DateRange = {
  start: string | null
  end: string | null
}

const toDateKey = (date: Date, timeZone = 'Asia/Ho_Chi_Minh'): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
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

const addDays = (dateKey: string, days: number): string => {
  const date = fromDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const getHistoryDateRange = (
  preset: HistoryPreset,
  now = new Date(),
  customRange: DateRange = { start: null, end: null },
  timeZone = 'Asia/Ho_Chi_Minh',
): DateRange => {
  const today = toDateKey(now, timeZone)
  if (preset === 'all') return { start: null, end: null }
  if (preset === 'today') return { start: today, end: today }
  if (preset === 'custom') return customRange

  const currentDate = fromDateKey(today)
  if (preset === 'week') {
    const day = currentDate.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    return { start: addDays(today, mondayOffset), end: addDays(today, mondayOffset + 6) }
  }

  const monthStart = `${today.slice(0, 7)}-01`
  const monthEndDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0))
  return { start: monthStart, end: monthEndDate.toISOString().slice(0, 10) }
}

export const getLocalDateKey = (occurredAt: string, timeZone = 'Asia/Ho_Chi_Minh'): string =>
  toDateKey(new Date(occurredAt), timeZone)

export const filterByDateRange = (
  records: readonly CheckinRecord[],
  range: DateRange,
  timeZone = 'Asia/Ho_Chi_Minh',
): CheckinRecord[] =>
  records.filter((record) => {
    const dateKey = getLocalDateKey(record.occurredAt, timeZone)
    return (!range.start || dateKey >= range.start) && (!range.end || dateKey <= range.end)
  })

export const sortByOccurredAtDesc = (records: readonly CheckinRecord[]): CheckinRecord[] =>
  [...records].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))

export const getCurrentStreakFromOccurredAt = (
  occurredAts: readonly string[],
  now = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): number => {
  const days = new Set(occurredAts.map((occurredAt) => getLocalDateKey(occurredAt, timeZone)))
  let streak = 0
  let cursor = getLocalDateKey(now.toISOString(), timeZone)

  while (days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

export type HistoryMetrics = {
  total: number
  emotionCount: number
  unknownCount: number
  currentStreak: number
  longestStreak: number
  averageIntensity: number | null
}

export const getHistoryMetrics = (
  records: readonly CheckinRecord[],
  now = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): HistoryMetrics => {
  const days = new Set(records.map((record) => getLocalDateKey(record.occurredAt, timeZone)))
  const today = getLocalDateKey(now.toISOString(), timeZone)
  let currentStreak = 0
  let cursor = today
  while (days.has(cursor)) {
    currentStreak += 1
    cursor = addDays(cursor, -1)
  }

  const orderedDays = [...days].sort()
  let longestStreak = 0
  let streak = 0
  let previous: string | null = null
  for (const day of orderedDays) {
    if (previous && day === addDays(previous, 1)) streak += 1
    else streak = 1
    longestStreak = Math.max(longestStreak, streak)
    previous = day
  }

  const intensities = records.map((record) => record.intensity).filter((value): value is number => typeof value === 'number')
  return {
    total: records.length,
    emotionCount: records.filter((record) => record.checkinType === 'emotion').length,
    unknownCount: records.filter((record) => record.checkinType === 'unknown').length,
    currentStreak,
    longestStreak,
    averageIntensity: intensities.length ? intensities.reduce((sum, value) => sum + value, 0) / intensities.length : null,
  }
}
