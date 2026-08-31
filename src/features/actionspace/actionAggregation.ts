import { getHistoryDateRange, getLocalDateKey } from '../checkin/utils/history'
import type { CheckinRecord } from '../checkin/types'
import type { ActionRecord, ActionTab } from './types'

export const ACTION_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export const getActionDateKey = (action: ActionRecord): string | null => action.plannedDate

export const isActionCompleted = (action: ActionRecord): boolean => action.status === 'completed' || Boolean(action.completedAt)

export const isActionActiveOn = (action: ActionRecord, dateKey: string): boolean => {
  if (isActionCompleted(action) || !action.plannedDate) return false
  const end = action.plannedEndDate || action.plannedDate
  return action.plannedDate <= dateKey && dateKey <= end
}

export const getActionTabItems = (actions: readonly ActionRecord[], tab: ActionTab, now = new Date()): ActionRecord[] => {
  const today = getLocalDateKey(now.toISOString(), ACTION_TIME_ZONE)
  return actions.filter((action) => {
    if (tab === 'completed') return isActionCompleted(action)
    if (isActionCompleted(action)) return false
    if (tab === 'unscheduled') return !action.plannedDate
    if (tab === 'today') return isActionActiveOn(action, today)
    if (tab === 'overdue') return Boolean(action.plannedDate && (action.plannedEndDate || action.plannedDate) < today)
    return Boolean(action.plannedDate && action.plannedDate > today)
  }).sort((left, right) => {
    if (tab === 'completed') return (right.completedAt ?? '').localeCompare(left.completedAt ?? '')
    if (tab === 'unscheduled') return right.createdAt.localeCompare(left.createdAt)
    return `${left.plannedDate ?? '9999'}${left.dueTime ?? '99:99'}`.localeCompare(`${right.plannedDate ?? '9999'}${right.dueTime ?? '99:99'}`)
  })
}

export const getUpcomingGroups = (actions: readonly ActionRecord[], now = new Date()): { label: string; items: ActionRecord[] }[] => {
  const today = getLocalDateKey(now.toISOString(), ACTION_TIME_ZONE)
  const tomorrow = getLocalDateKey(new Date(new Date(now).getTime() + 86_400_000).toISOString(), ACTION_TIME_ZONE)
  const weekEnd = getHistoryDateRange('week', now, { start: null, end: null }, ACTION_TIME_ZONE).end ?? today
  const groups = [
    { label: 'Ngày mai', items: [] as ActionRecord[] },
    { label: 'Tuần này', items: [] as ActionRecord[] },
    { label: 'Sau đó', items: [] as ActionRecord[] },
  ]
  getActionTabItems(actions, 'upcoming', now).forEach((action) => {
    const start = action.plannedDate ?? ''
    if (start === tomorrow) groups[0].items.push(action)
    else if (start <= weekEnd) groups[1].items.push(action)
    else groups[2].items.push(action)
  })
  return groups.filter((group) => group.items.length > 0)
}

export const getActionScheduleLabel = (action: ActionRecord): string => {
  if (!action.plannedDate) return 'Chưa lên lịch'
  const date = action.plannedEndDate && action.plannedEndDate !== action.plannedDate ? `${action.plannedDate} – ${action.plannedEndDate}` : action.plannedDate
  return action.dueTime ? `${date} · ${action.dueTime}` : date
}

export const getActionRhythm = (actions: readonly ActionRecord[], now = new Date()): boolean[] => {
  const today = getLocalDateKey(now.toISOString(), ACTION_TIME_ZONE)
  return Array.from({ length: 7 }, (_, index) => {
    const date = getHistoryDateRange('today', new Date(new Date(`${today}T12:00:00Z`).getTime() - (6 - index) * 86_400_000), { start: null, end: null }, ACTION_TIME_ZONE).start
    return actions.some((action) => isActionCompleted(action) && action.completedAt && getLocalDateKey(action.completedAt, ACTION_TIME_ZONE) === date)
  })
}

export const getLinkedCheckin = (action: ActionRecord, checkins: readonly CheckinRecord[]) => action.sourceCheckinId ? checkins.find((checkin) => checkin.id === action.sourceCheckinId) ?? null : null
