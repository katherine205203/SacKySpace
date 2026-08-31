import type { CheckinRecord, Emotion } from '../checkin/types'
import type { DiaryEntry } from '../diary/types'
import type { ActionRecord } from '../actionspace/types'

export type FutureLetterState =
  | 'draft'
  | 'writing'
  | 'decorating'
  | 'preview'
  | 'sealed_waiting'
  | 'available_unopened'
  | 'opened'
  | 'archived'

export type Comparator = '>' | '>=' | '=' | '<=' | '<'
export type GroupOperator = 'AND' | 'OR'
export type TriggerType =
  | 'random_date'
  | 'specific_date'
  | 'checkin_streak'
  | 'diary_streak'
  | 'emotion_frequency'
  | 'done_action'

export type EmotionFrequencyScope = 'primary' | 'primary_secondary'
export type DoneActionMode = 'lifetime' | 'window'
export type DoneActionWindow = 'all_time' | 'last_7_days' | 'last_30_days'

export type FutureLetterRuleConfig = {
  date?: string
  emotionId?: string
  emotionName?: string
  scope?: EmotionFrequencyScope
  mode?: DoneActionMode
  window?: DoneActionWindow
  dailyChance?: number
}

export type FutureLetterRule = {
  id: string
  groupId: string
  type: TriggerType
  comparator: Comparator | null
  threshold: number | null
  config: FutureLetterRuleConfig
  position: number
}

export type FutureLetterRuleGroup = {
  id: string
  operator: GroupOperator
  position: number
  rules: FutureLetterRule[]
}

export type FutureLetterContextAttachment = {
  id: string
  attachmentType: 'emotion' | 'checkin'
  refId: string
  snapshot: Record<string, unknown> | null
  position: number
}

export type FutureLetterDecorationSnapshot = {
  envelopeAssetId: string
  sealAssetId: string
  envelopeLabel: string
  sealLabel: string
  capturedAt: string
}

export type FutureLetterTriggerEvent = {
  id: string
  letterId: string
  triggerType: TriggerType
  ruleSnapshot: Record<string, unknown>
  observedValues: Record<string, unknown>
  windowStart: string | null
  windowEnd: string | null
  triggeredAt: string
  availableSince: string
  openedAt: string | null
  sourceRefIds: string[]
}

export type FutureLetter = {
  id: string
  userId: string
  title: string
  body: string
  state: FutureLetterState
  groupOperator: GroupOperator
  groups: FutureLetterRuleGroup[]
  attachments: FutureLetterContextAttachment[]
  envelopeAssetId: string | null
  sealAssetId: string | null
  decorationSnapshot: FutureLetterDecorationSnapshot | null
  createdAt: string
  updatedAt: string
  sealedAt: string | null
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  openedCount: number
  archivedAt: string | null
  triggerEvents: FutureLetterTriggerEvent[]
}

export type FutureLetterDraft = Omit<FutureLetter, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'sealedAt' | 'firstOpenedAt' | 'lastOpenedAt' | 'openedCount' | 'archivedAt' | 'triggerEvents'> & {
  id?: string
  userId?: string
  createdAt?: string
  updatedAt?: string
  sealedAt?: string | null
  firstOpenedAt?: string | null
  lastOpenedAt?: string | null
  openedCount?: number
  archivedAt?: string | null
  triggerEvents?: FutureLetterTriggerEvent[]
}

export type FutureLetterLibrary = {
  letters: FutureLetter[]
  counts: Record<'draft' | 'waiting' | 'available' | 'opened' | 'archived', number>
}

export type FutureLetterEvaluationContext = {
  today: string
  checkins: readonly CheckinRecord[]
  diaryEntries: readonly DiaryEntry[]
  actions: readonly ActionRecord[]
}

export type FutureLetterContextOptions = {
  checkins: CheckinRecord[]
  emotions: Emotion[]
}

export type FutureLetterAssetOption = {
  id: string
  label: string
  caption: string
  variant: 'envelope' | 'seal'
}
