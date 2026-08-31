export type GiftType = 'question' | 'message'
export type GiftStatus = 'draft' | 'sent' | 'delivered'
export type GiftReceiptStatus = 'pending' | 'received' | 'declined'

export type GiftBoxStyle = {
  id: string
  name: string
  palette: string[]
  ribbon: string
  shape: 'square' | 'round' | 'tall'
  config: Record<string, unknown>
}

export type GiftRecord = {
  id: string
  userId: string
  creationLocalDate: string
  type: GiftType
  status: GiftStatus
  questionText: string | null
  messageText: string | null
  emotionId: string | null
  emotionSnapshot: { emotion_id: string; emotion_name_vn: string; emoji: string; color_hex: string } | null
  boxStyleId: string
  boxStyleSnapshot: GiftBoxStyle | null
  sentAt: string | null
  lockedAt: string | null
  deliverAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  receiptStatus: GiftReceiptStatus
  createdAt: string
  updatedAt: string
}

export type GiftQuestionAnswer = {
  giftId: string
  answerText: string
  isDone: boolean
  answeredAt: string | null
  updatedAt: string
}

export type DiaryConversionLink = {
  giftId: string
  diaryId: string
  diaryPromptResponseId: string | null
  convertedAt: string
}

export type GiftDraft = {
  id?: string
  type: GiftType
  questionText: string
  messageText: string
  emotionId: string | null
  emotionSnapshot: GiftRecord['emotionSnapshot']
  boxStyleId: string
  boxStyleSnapshot: GiftBoxStyle | null
}

export type GiftHomeProjection = {
  gift: GiftRecord | null
  todayGift: GiftRecord | null
  answer: GiftQuestionAnswer | null
}

export type GiftHistoryFilter = 'all' | 'question' | 'message' | 'unopened' | 'received' | 'declined'
