import type { CheckinRecord, Emotion } from '../checkin/types'
import type { DiaryEntry, JourneyEntry } from '../diary/types'
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
  | 'random_condition'
  | 'specific_date'
  | 'minimum_wait'
  | 'time_window'
  | 'checkin_streak'
  | 'checkin_total'
  | 'checkin_frequency'
  | 'checkin_return_after_inactivity'
  | 'diary_streak'
  | 'diary_total'
  | 'journey_total'
  | 'emotion_frequency'
  | 'emotion_condition'
  | 'done_action'

export type EmotionFrequencyScope = 'primary' | 'primary_secondary'
export type DoneActionMode = 'lifetime' | 'window'
export type DoneActionWindow = 'all_time' | 'last_7_days' | 'last_30_days'

export type TimeUnit = 'day' | 'week' | 'month' | 'year'
export type TimeWindowMode = 'day_of_month' | 'month' | 'weekday' | 'date_range'
export type CheckinFrequencyPeriod = 'day' | 'week' | 'month'
export type EmotionConditionOperator = 'exists' | 'count_gte' | 'absent'
export type EmotionWindowType = 'since_sent' | 'last_days' | 'consecutive_days' | 'custom_range'
export type RandomEvaluationPeriod = 'daily' | 'weekly'
export type RandomConditionMode = 'always' | 'after_prerequisites' | 'window'

export type FutureLetterRuleConfig = {
  date?: string
  amount?: number
  unit?: TimeUnit
  anchor?: 'letter_sent_at'
  timeWindowMode?: TimeWindowMode
  dayOfMonth?: number
  month?: number
  weekday?: number
  startDate?: string
  endDate?: string
  recurrence?: 'none' | 'yearly'
  emotionId?: string
  emotionName?: string
  scope?: EmotionFrequencyScope
  emotionOperator?: EmotionConditionOperator
  count?: number
  windowType?: EmotionWindowType
  windowValue?: number
  customWindowStart?: string
  customWindowEnd?: string
  metric?: 'streak' | 'total' | 'frequency' | 'return_after_inactivity'
  minimumOccurrences?: number
  period?: CheckinFrequencyPeriod
  periodCount?: number
  inactiveDays?: number
  mode?: DoneActionMode
  window?: DoneActionWindow
  dailyChance?: number
  probability?: number
  evaluationPeriod?: RandomEvaluationPeriod
  randomMode?: RandomConditionMode
  windowStart?: string
  windowEnd?: string
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
  journeys?: readonly JourneyEntry[]
  actions: readonly ActionRecord[]
  letterSentAt?: string | null
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
