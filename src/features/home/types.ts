import type { CheckinRecord } from '../checkin/types'
import type { DiaryEntry } from '../diary/types'
import type { GiftHomeProjection } from '../gift/types'

export type HomeRange = 'today' | 'week' | 'month' | 'custom'

export type HomeReminder = {
  id: string
  sourceCheckinId: string | null
  title: string
  note: string | null
  plannedDate: string | null
  plannedEndDate?: string | null
  dueTime: string | null
  status: string
  completedAt: string | null
  origin: string
}

export type HomeSnapshot = {
  displayName: string
  records: CheckinRecord[]
  reminders: HomeReminder[]
  diaryEntries: DiaryEntry[]
  futureLetter: {
    availableCount: number
    availableTitle: string | null
  }
  gift: GiftHomeProjection
}

export type HomeDiaryPreview = {
  status: 'empty' | 'draft' | 'done'
  title?: string
  excerpt?: string
  imageUrl?: string
}
