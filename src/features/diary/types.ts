import type { CheckinRecord, Emotion } from '../checkin/types'

export const MAX_DIARY_IMAGES = 8

export type DiaryStatus = 'draft' | 'done'
export type DiaryCompletionSource = 'user' | 'system'

export type JourneyStatus = 'draft' | 'done'

export type DiaryPrompt = {
  id: string
  code: string
  textVn: string
  textEn?: string
  emoji: string
  hexColor: string
  description?: string
  source?: 'catalog' | 'gift_for_tomorrow'
  sourceGiftId?: string
}

export type DiaryEmotionSnapshot = Pick<Emotion, 'emotion_id' | 'emotion_name_vn' | 'emotion_name_en' | 'emoji' | 'color_hex'> & {
  description_vn?: string
}

export type DiaryPromptResponse = {
  promptId: string | null
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
  mediaKey?: string
  externalUrl: string
  position: number
  caption: string
  sourceType?: 'local_upload' | 'url_import' | 'legacy'
  originalSourceUrl?: string
  mimeType?: string
  width?: number
  height?: number
  fileSizeBytes?: number
  uploadStatus?: 'saved' | 'failed'
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
  completionSource: DiaryCompletionSource | null
  isBackfilled: boolean
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

export type DiaryFilter = 'all' | 'draft' | 'done'

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
