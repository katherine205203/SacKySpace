import type { CheckinRecord, Emotion } from '../checkin/types'

/** `done` remains readable for records created before the Day Record rollout. */
export type DiaryStatus = 'draft' | 'user_done' | 'day_locked' | 'done' | 'deleted'

export type JourneyStatus = 'draft' | 'done'

export type DiaryPrompt = {
  id: string
  code: string
  textVn: string
  textEn?: string
  emoji: string
  hexColor: string
  description?: string
}

export type DiaryEmotionSnapshot = Pick<Emotion, 'emotion_id' | 'emotion_name_vn' | 'emotion_name_en' | 'emoji' | 'color_hex'>

export type DiaryPromptResponse = {
  promptId: string
  promptSnapshot: DiaryPrompt
  position: number
  responseText: string
  isDone: boolean
}

export type DiaryCheckinLink = {
  checkinId: string
  weightPercent: number
  position: number
}

export type DiaryImage = {
  id: string
  externalFileId?: string
  externalUrl: string
  position: number
  caption: string
  metadata?: Record<string, unknown>
}

export type DiaryEntry = {
  id: string
  userId: string
  localDate: string
  status: DiaryStatus
  title: string
  overallText: string
  dailyEmotionId: string | null
  dailyEmotionSnapshot: DiaryEmotionSnapshot | null
  promptResponses: DiaryPromptResponse[]
  checkinLinks: DiaryCheckinLink[]
  images: DiaryImage[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
  dayLockedAt: string | null
}

export type DiaryDraft = Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'completedAt'> & {
  id?: string
  userId?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
}

export type DiaryEntryWithCheckins = DiaryEntry & {
  checkins: Array<DiaryCheckinLink & { record: CheckinRecord }>
}

export type JourneyEntry = {
  id: string
  userId: string
  diaryType: 'journey'
  status: JourneyStatus
  rangeStart: string
  rangeEnd: string
  title: string
  overallText: string
  primaryEmotionId: string | null
  primaryEmotionSnapshot: DiaryEmotionSnapshot | null
  selectedDailyDiaryIds: string[]
  checkinLinks: DiaryCheckinLink[]
  closingThought: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type JourneyDraft = Omit<JourneyEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'completedAt'> & {
  id?: string
  userId?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
}

export type JourneyCoverage = {
  dayCount: number
  dailyDiaryCount: number
  checkinCount: number
  completedActionCount: number
}

export type DiaryFilter = 'all' | 'user_done' | 'day_locked' | 'draft'

export type DayRecordKind = 'checkin' | 'action'

export type DayRecordFact = {
  kind: DayRecordKind
  sourceId: string
  occurredAt: string
  updatedAt: string
  color: string
  emoji: string
  title: string
  titleEn?: string
  description?: string
  intensity?: number | null
  secondaryEmotions?: string[]
  unknownPrompt?: string
  sourceLabel?: string
  reflectionLabel?: string
  reflectionNote?: string
}

export type DayRecordItem = DayRecordFact & {
  key: string
  changedAfterLock: boolean
  sourceMissing?: boolean
  snapshot?: DayRecordFact
}

export type DayRecordSnapshot = {
  diaryId: string
  sourceType: DayRecordKind
  sourceId: string
  occurredAt: string
  payload: DayRecordFact
  lockedAt: string
}

export type DayRecord = {
  localDate: string
  state: 'live' | 'locked'
  lockedAt: string | null
  items: DayRecordItem[]
  checkinCount: number
  completedActionCount: number
}
