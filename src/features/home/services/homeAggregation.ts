import { filterByDateRange, getCurrentStreakFromCreatedAt, getHistoryDateRange, getLocalDateKey, type DateRange, type HistoryPreset } from '../../checkin/utils/history'
import type { CheckinRecord } from '../../checkin/types'
import { intensityToPresenceWeight, type ColorOrbEntry } from '../../checkin/utils/colorOrb'
import type { HomeRange, HomeReminder } from '../types'

export const HOME_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const UNKNOWN_PRESENTATION_COLOR = '#b8a5df'

export type ColorEntry = ColorOrbEntry

const addDays = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

const rangeToHistoryPreset = (range: HomeRange): HistoryPreset => range

export const getHomeDateRange = (
  range: HomeRange,
  now = new Date(),
  customRange: DateRange = { start: null, end: null },
): DateRange => getHistoryDateRange(rangeToHistoryPreset(range), now, customRange, HOME_TIME_ZONE)

export const getHomeRecordsForRange = (
  records: readonly CheckinRecord[],
  range: HomeRange,
  now = new Date(),
  customRange: DateRange = { start: null, end: null },
): CheckinRecord[] => filterByDateRange(records, getHomeDateRange(range, now, customRange), HOME_TIME_ZONE)

/**
 * A Color Orb is a map of emotional presence, not a count of check-ins.
 * Unknown Check-ins still participate in streaks and metrics, but never enter
 * this list. One check-in owns one total weight; secondary emotions only share
 * that weight with the primary emotion.
 */
export const getHomeOrbEntries = (records: readonly CheckinRecord[]): ColorEntry[] =>
  records.flatMap((record) => {
    if (record.checkinType !== 'emotion' || !record.primaryEmotion) return []
    const totalWeight = intensityToPresenceWeight(record.intensity ?? 1)
    const secondary = record.secondaryEmotions.filter((emotion, index, list) => emotion.emotion_id !== record.primaryEmotion?.emotion_id && list.findIndex((item) => item.emotion_id === emotion.emotion_id) === index)
    const shares = secondary.length === 0 ? [1] : secondary.length === 1 ? [.7, .3] : [.7, .15, .15]
    return [record.primaryEmotion, ...secondary].map((emotion, index) => ({
      color: emotion.color_hex,
      intensity: record.intensity ?? 1,
      presenceWeight: totalWeight * (shares[index] ?? 0),
      ...(emotion.emotion_id ? { emotionId: emotion.emotion_id } : {}),
      ...(emotion.emotion_name_vn ? { label: emotion.emotion_name_vn } : {}),
      ...(emotion.emotion_name_en ? { labelEn: emotion.emotion_name_en } : {}),
      ...(emotion.emoji ? { emoji: emotion.emoji } : {}),
    }))
  })

export const getCurrentStreak = (records: readonly CheckinRecord[], now = new Date()): number => {
  return getCurrentStreakFromCreatedAt(records.map((record) => record.createdAt), now, HOME_TIME_ZONE)
}

export const getRecentJourneyCheckins = (
  records: readonly CheckinRecord[],
  now = new Date(),
): CheckinRecord[] => {
  const today = getLocalDateKey(now.toISOString(), HOME_TIME_ZONE)
  const recentDays = new Set([today, addDays(today, -1), addDays(today, -2)])
  return records
    .filter((record) => recentDays.has(getLocalDateKey(record.createdAt, HOME_TIME_ZONE)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export const getCheckinPresentation = (record: CheckinRecord): { title: string; emoji: string; color: string } => {
  if (record.checkinType === 'unknown') {
    return {
      title: 'Mình còn đang mơ hồ',
      emoji: record.unknownPrompt?.emoji ?? '?',
      color: UNKNOWN_PRESENTATION_COLOR,
    }
  }

  return {
    title: record.primaryEmotion?.emotion_name_vn ?? 'Check-in cảm xúc',
    emoji: record.primaryEmotion?.emoji ?? '◉',
    color: record.primaryEmotion?.color_hex ?? UNKNOWN_PRESENTATION_COLOR,
  }
}

const isCompleted = (reminder: HomeReminder): boolean =>
  reminder.status.toLowerCase() === 'completed' || Boolean(reminder.completedAt)

export type HomeActionTab = 'today' | 'upcoming' | 'overdue' | 'unscheduled'

const getMatchingHomeActionItems = (
  reminders: readonly HomeReminder[],
  tab: HomeActionTab,
  now = new Date(),
): HomeReminder[] => {
  const today = getLocalDateKey(now.toISOString(), HOME_TIME_ZONE)
  const matchesTab = (reminder: HomeReminder): boolean => {
    const endDate = reminder.plannedEndDate || reminder.plannedDate
    if (tab === 'overdue') return Boolean(endDate && endDate < today && !isCompleted(reminder))
    if (tab === 'unscheduled') return !reminder.plannedDate && !isCompleted(reminder)
    if (tab === 'upcoming') return Boolean(reminder.plannedDate && reminder.plannedDate > today && !isCompleted(reminder))
    return Boolean(reminder.plannedDate && reminder.plannedDate <= today && (endDate ?? today) >= today && !isCompleted(reminder))
  }

  return reminders
    .filter(matchesTab)
    .sort((left, right) => {
      const leftDate = `${left.plannedDate ?? today}T${left.dueTime ?? '23:59'}`
      const rightDate = `${right.plannedDate ?? today}T${right.dueTime ?? '23:59'}`
      return leftDate.localeCompare(rightDate)
    })
}

export const getHomeActionItems = (
  reminders: readonly HomeReminder[],
  tab: HomeActionTab,
  now = new Date(),
): HomeReminder[] => getMatchingHomeActionItems(reminders, tab, now)

export const getHomeActionSummary = (
  reminders: readonly HomeReminder[],
  now = new Date(),
  range: HomeRange = 'today',
  customRange: DateRange = { start: null, end: null },
): { total: number; completed: number; remaining: number } => {
  const dateRange = getHomeDateRange(range, now, customRange)
  const items = reminders.filter((reminder) => {
    if (!reminder.plannedDate) return false
    const endDate = reminder.plannedEndDate || reminder.plannedDate
    return (!dateRange.end || reminder.plannedDate <= dateRange.end) && (!dateRange.start || endDate >= dateRange.start)
  })
  const completed = items.filter(isCompleted).length
  return {
    total: items.length,
    completed,
    remaining: Math.max(0, items.length - completed),
  }
}

export const isReminderCompleted = isCompleted

export const formatCheckinTime = (createdAt: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: HOME_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(createdAt))

export const formatCheckinDate = (createdAt: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: HOME_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(createdAt))

export const formatCheckinDateShort = (createdAt: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: HOME_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(createdAt))

export const formatReminderSchedule = (reminder: HomeReminder, now = new Date()): string => {
  if (!reminder.plannedDate) return 'Chưa lên lịch'
  const today = getLocalDateKey(now.toISOString(), HOME_TIME_ZONE)
  const tomorrow = addDays(today, 1)
  const dateLabel = reminder.plannedDate === today
    ? 'Hôm nay'
    : reminder.plannedDate === tomorrow
      ? 'Ngày mai'
      : new Date(`${reminder.plannedDate}T12:00:00+07:00`).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', timeZone: HOME_TIME_ZONE })
  const endDateLabel = reminder.plannedEndDate && reminder.plannedEndDate !== reminder.plannedDate
    ? new Date(`${reminder.plannedEndDate}T12:00:00+07:00`).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', timeZone: HOME_TIME_ZONE })
    : null
  const scheduleLabel = endDateLabel ? `${dateLabel} – ${endDateLabel}` : dateLabel
  return reminder.dueTime ? `${scheduleLabel} · ${reminder.dueTime.slice(0, 5)}` : scheduleLabel
}

export const formatHomeRangeLabel = (range: HomeRange, customRange: DateRange): string => {
  if (range === 'today') return 'Hôm nay'
  if (range === 'week') return 'Tuần này'
  if (range === 'month') return 'Tháng này'
  if (customRange.start && customRange.end) return `${customRange.start} – ${customRange.end}`
  return 'Tùy chọn'
}
