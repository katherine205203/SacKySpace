import type { CheckinRecord } from '../checkin/types'

export type HomeRange = 'today' | 'week' | 'month' | 'custom'

export type HomeReminder = {
  id: string
  sourceCheckinId: string | null
  title: string
  note: string | null
  plannedDate: string | null
  dueTime: string | null
  status: string
  completedAt: string | null
  origin: string
}

export type HomeSnapshot = {
  displayName: string
  records: CheckinRecord[]
  reminders: HomeReminder[]
}

export type HomeDiaryPreview = {
  status: 'empty' | 'draft' | 'saved'
  title?: string
  excerpt?: string
  imageUrl?: string
}
