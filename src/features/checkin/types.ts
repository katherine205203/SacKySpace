export type CheckinType = 'emotion' | 'unknown'

export type EmotionFamily = {
  emotion_family_id: string
  family_code: string
  family_name_vn: string
  family_name_en: string
  color_hex: string
  active: boolean
  sort_order: number
}

export type Emotion = {
  emotion_id: string
  emotion_family_id: string
  emotion_name_vn: string
  emotion_name_en: string
  emoji: string
  color_hex: string
  description_vn: string
  description_en: string
  active: boolean
  sort_order: number
}

export type NeedGroup = {
  need_group_id: string
  group_code: string
  group_name_vn: string
  group_name_en: string
  color_hex: string
  active: boolean
  sort_order: number
}

export type Need = {
  need_id: string
  need_group_id: string
  need_name_vn: string
  need_name_en: string
  emoji: string
  color_hex: string
  description_vn: string
  description_en: string
  active: boolean
  sort_order: number
}

export type Context = {
  context_id: string
  context_group: string
  context_name_vn: string
  emoji: string
  color_hex: string
  description_vn: string
  active: boolean
  sort_order: number
}

export type UnknownPrompt = {
  prompt_id: string
  emoji: string
  prompt_text_vn: string
  active: boolean
  sort_order: number
}

export type CareAction = {
  care_action_id: string
  care_group: string
  emoji: string
  title_vn: string
  description_vn: string
  duration_min: number | null
  active: boolean
  sort_order: number
}

export type ActionDraft = {
  id?: string
  careActionId: string | null
  title: string
  note: string
  plannedDate: string
  dueTime: string
  status?: 'pending' | 'completed'
  completedAt?: string | null
}

export type ReferenceData = {
  emotionFamilies: EmotionFamily[]
  emotions: Emotion[]
  needGroups: NeedGroup[]
  needs: Need[]
  contexts: Context[]
  unknownPrompts: UnknownPrompt[]
  careActions: CareAction[]
}

export type CheckinDraft = {
  id?: string
  createdAt?: string
  occurredAt?: string
  checkinType: CheckinType
  primaryEmotionId: string | null
  intensity: number | null
  note: string
  unknownPromptId: string | null
  secondaryEmotionIds: string[]
  needIds: string[]
  contextIds: string[]
  actions: ActionDraft[]
}

export type CheckinRecord = {
  id: string
  userId: string
  checkinType: CheckinType
  primaryEmotionId: string | null
  primaryEmotion: Emotion | null
  intensity: number | null
  note: string | null
  unknownPromptId: string | null
  unknownPrompt: UnknownPrompt | null
  secondaryEmotions: Emotion[]
  needs: Need[]
  contexts: Context[]
  actions: ActionDraft[]
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export const INTENSITY_OPTIONS = [
  { value: 1, label: 'Thoáng qua' },
  { value: 2, label: 'Nhẹ nhàng' },
  { value: 3, label: 'Vừa phải' },
  { value: 4, label: 'Hiện diện rõ' },
  { value: 5, label: 'Rất mạnh' },
] as const

export const createEmptyDraft = (checkinType: CheckinType = 'emotion'): CheckinDraft => ({
  checkinType,
  primaryEmotionId: null,
  intensity: null,
  note: '',
  unknownPromptId: null,
  secondaryEmotionIds: [],
  needIds: [],
  contextIds: [],
  actions: [],
})
