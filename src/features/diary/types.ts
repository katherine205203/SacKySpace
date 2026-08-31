import type { CheckinRecord, Emotion } from '../checkin/types'

export type DiaryStatus = 'draft' | 'done' | 'deleted'

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

export type DiaryFilter = 'all' | 'done' | 'draft'
