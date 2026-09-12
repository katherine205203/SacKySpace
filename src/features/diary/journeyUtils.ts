import type { ActionRecord } from '../actionspace/types'
import type { CheckinRecord } from '../checkin/types'
import type { DiaryEntry, JourneyCoverage } from './types'
import { addDiaryDays, DIARY_TIME_ZONE } from './utils'

export const journeyDateInRange = (date: string, rangeStart: string, rangeEnd: string): boolean => date >= rangeStart && date <= rangeEnd

export const journeyDateFor = (value: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: DIARY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

export const getJourneyDays = (rangeStart: string, rangeEnd: string): string[] => {
  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return []
  const days: string[] = []
  let cursor = rangeStart
  while (cursor <= rangeEnd) {
    days.push(cursor)
    cursor = addDiaryDays(cursor, 1)
  }
  return days
}

export const getJourneyCoverage = (rangeStart: string, rangeEnd: string, dailyEntries: readonly DiaryEntry[], checkins: readonly CheckinRecord[], actions: readonly ActionRecord[]): JourneyCoverage => ({
  dayCount: getJourneyDays(rangeStart, rangeEnd).length,
  dailyDiaryCount: dailyEntries.filter((entry) => journeyDateInRange(entry.localDate, rangeStart, rangeEnd)).length,
  checkinCount: checkins.filter((record) => journeyDateInRange(journeyDateFor(record.occurredAt), rangeStart, rangeEnd)).length,
  completedActionCount: actions.filter((action) => action.status === 'completed' && action.completedAt && journeyDateInRange(journeyDateFor(action.completedAt), rangeStart, rangeEnd)).length,
})
