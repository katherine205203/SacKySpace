import type { CheckinRecord } from '../checkin/types'

export type ActionStatus = 'pending' | 'completed'
export type ActionTab = 'today' | 'upcoming' | 'overdue' | 'unscheduled' | 'completed'
export type ActionScheduleType = 'none' | 'date' | 'date_range'

export type ActionRecord = {
  id: string
  userId: string
  title: string
  note: string | null
  plannedDate: string | null
  plannedEndDate: string | null
  dueTime: string | null
  status: ActionStatus
  completedAt: string | null
  createdAt: string
  updatedAt: string
  origin: string
  sourceCheckinId: string | null
  careActionId: string | null
}

export type ActionDraft = {
  title: string
  note: string
  scheduleType: ActionScheduleType
  plannedDate: string
  plannedEndDate: string
  dueTime: string
  sourceCheckinId: string | null
}

export type ActionReflectionOutcome = {
  id: string
  labelVn: string
  semanticGroup: 'positive' | 'neutral' | 'negative' | 'other'
  sortOrder: number
}

export type ActionReflection = {
  id: string
  actionId: string
  completionCycleId: string
  outcomeId: string
  outcomeSnapshot: string | null
  note: string | null
  createdAt: string
}

export type ActionSpaceSnapshot = {
  actions: ActionRecord[]
  checkins: CheckinRecord[]
  reflections: ActionReflection[]
  reflectionStorageAvailable: boolean
}
