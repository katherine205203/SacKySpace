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

export const getLocalDateKey = (createdAt: string, timeZone = 'Asia/Ho_Chi_Minh'): string =>
  toDateKey(new Date(createdAt), timeZone)

export const filterByDateRange = (
  records: readonly CheckinRecord[],
  range: DateRange,
  timeZone = 'Asia/Ho_Chi_Minh',
): CheckinRecord[] =>
  records.filter((record) => {
    const dateKey = getLocalDateKey(record.createdAt, timeZone)
    return (!range.start || dateKey >= range.start) && (!range.end || dateKey <= range.end)
  })

export const sortByCreatedAtDesc = (records: readonly CheckinRecord[]): CheckinRecord[] =>
  [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
