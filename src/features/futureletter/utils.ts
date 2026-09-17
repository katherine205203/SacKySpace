import type { CheckinRecord } from '../checkin/types'
import { getHistoryMetrics } from '../checkin/utils/history'
import type { DiaryEntry } from '../diary/types'
import { getDiaryMetrics } from '../diary/utils'
import type { ActionRecord } from '../actionspace/types'
import type {
  Comparator,
  FutureLetterEvaluationContext,
  FutureLetterRule,
  FutureLetterRuleGroup,
  FutureLetterState,
  GroupOperator,
} from './types'

export const FUTURE_LETTER_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const RANDOM_DAILY_CHANCE = 0.3

export const ENVELOPE_ASSETS = [
  { id: 'envelope-paper', label: 'Giấy thư', caption: 'Một khoảng lặng trên giấy', variant: 'envelope' as const },
  { id: 'envelope-night', label: 'Đêm tím', caption: 'Gửi từ một buổi tối yên', variant: 'envelope' as const },
  { id: 'envelope-garden', label: 'Khu vườn', caption: 'Một điều đang nảy mầm', variant: 'envelope' as const },
  { id: 'envelope-sunrise', label: 'Bình minh', caption: 'Mở ra khi mình sẵn sàng', variant: 'envelope' as const },
  { id: 'envelope-sea', label: 'Mặt biển', caption: 'Một khoảng xanh để thở', variant: 'envelope' as const },
  { id: 'envelope-clay', label: 'Đất ấm', caption: 'Dịu dàng như một trang mới', variant: 'envelope' as const },
]

export const SEAL_ASSETS = [
  { id: 'seal-violet', label: 'Ấn tím', caption: 'Một lời hứa nhỏ với mình', symbol: 'S', variant: 'seal' as const },
  { id: 'seal-rose', label: 'Ấn hồng', caption: 'Dịu dàng giữ lại', symbol: '✦', variant: 'seal' as const },
  { id: 'seal-amber', label: 'Ấn hổ phách', caption: 'Điều mình muốn nhớ', symbol: '◌', variant: 'seal' as const },
  { id: 'seal-forest', label: 'Ấn rừng', caption: 'Bền bỉ qua những ngày', symbol: '↗', variant: 'seal' as const },
  { id: 'seal-sky', label: 'Ấn trời', caption: 'Một khoảng rộng để mở ra', symbol: '≈', variant: 'seal' as const },
  { id: 'seal-coral', label: 'Ấn san hô', caption: 'Ấm áp và còn đang lớn', symbol: '∞', variant: 'seal' as const },
]

export const TRIGGER_OPTIONS: Array<{ type: FutureLetterRule['type']; label: string; description: string; icon: string }> = [
  { type: 'random_date', label: 'Một ngày bất chợt', description: 'Mỗi ngày có 30% cơ hội để một lá thư trở về.', icon: '✦' },
  { type: 'specific_date', label: 'Một ngày cụ thể', description: 'Đến ngày này, thư sẽ sẵn sàng để mở.', icon: '◷' },
  { type: 'minimum_wait', label: 'Khoảng chờ tối thiểu', description: 'Giữ lá thư lại đủ lâu trước khi trở về.', icon: '⌛' },
  { type: 'time_window', label: 'Lịch thời gian đặc biệt', description: 'Chỉ trở về vào một ngày hoặc khoảng đã chọn.', icon: '▦' },
  { type: 'checkin_streak', label: 'Chuỗi Check-in', description: 'Khi mình giữ được nhịp Check-in.', icon: '◉' },
  { type: 'checkin_total', label: 'Tổng Check-in', description: 'Khi mình đã có đủ số lần Check-in.', icon: '◌' },
  { type: 'checkin_frequency', label: 'Tần suất Check-in', description: 'Giữ nhịp trong nhiều tuần hoặc tháng.', icon: '≋' },
  { type: 'checkin_return_after_inactivity', label: 'Quay lại sau một khoảng nghỉ', description: 'Một Check-in mới sau những ngày vắng mặt.', icon: '↩' },
  { type: 'diary_streak', label: 'Chuỗi Diary', description: 'Khi mình viết Diary đủ đều.', icon: '▤' },
  { type: 'diary_total', label: 'Tổng Diary', description: 'Khi mình đã viết đủ số Diary.', icon: '▥' },
  { type: 'journey_total', label: 'Tổng Journey', description: 'Khi mình đã khép lại đủ số Journey.', icon: '⌁' },
  { type: 'emotion_frequency', label: 'Cảm xúc lặp lại', description: 'Một cảm xúc xuất hiện đủ nhiều trong 30 ngày.', icon: '◌' },
  { type: 'emotion_condition', label: 'Cảm xúc', description: 'Một cảm xúc xuất hiện hoặc vắng mặt theo cách mình chọn.', icon: '♡' },
  { type: 'random_condition', label: 'Xác suất bất chợt', description: 'Một cơ hội ngẫu nhiên theo điều kiện riêng.', icon: '✧' },
  { type: 'done_action', label: 'Đã làm đủ Action', description: 'Theo dõi những bước mình đã hoàn thành.', icon: '↳' },
]

const toDateKey = (date: Date, timeZone = FUTURE_LETTER_TIME_ZONE): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export const getFutureLetterLocalDate = (date = new Date()): string => toDateKey(date)

export const addDays = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

export const getLocalDateKey = (isoDate: string): string => toDateKey(new Date(isoDate))

export const compareValues = (left: number, comparator: Comparator, right: number): boolean => {
  if (comparator === '>') return left > right
  if (comparator === '>=') return left >= right
  if (comparator === '=') return left === right
  if (comparator === '<=') return left <= right
  return left < right
}

const sortedDates = (dates: string[]): string[] => [...dates].sort()

export const getCheckinStreak = (records: readonly CheckinRecord[], today: string): number => {
  return getHistoryMetrics(records, new Date(`${today}T12:00:00+07:00`), FUTURE_LETTER_TIME_ZONE).currentStreak
}

export const getDiaryStreak = (entries: readonly DiaryEntry[], today: string): number => {
  return getDiaryMetrics(entries, new Date(`${today}T12:00:00+07:00`)).currentStreak
}

export const isCompletedAction = (action: ActionRecord): boolean => action.status === 'completed' || Boolean(action.completedAt)

export const getCompletedActionCount = (actions: readonly ActionRecord[], today: string, window: 'all_time' | 'last_7_days' | 'last_30_days'): number => {
  const completed = actions.filter((action) => isCompletedAction(action) && action.completedAt)
  if (window === 'all_time') return completed.length
  const start = addDays(today, window === 'last_7_days' ? -6 : -29)
  return completed.filter((action) => {
    const date = getLocalDateKey(action.completedAt as string)
    return date >= start && date <= today
  }).length
}

const emotionMatches = (record: CheckinRecord, emotionId: string, scope: 'primary' | 'primary_secondary'): boolean => {
  if (record.primaryEmotionId === emotionId) return true
  return scope === 'primary_secondary' && record.secondaryEmotions.some((emotion) => emotion.emotion_id === emotionId)
}

export type EmotionChainEvidence = { count: number; windowStart: string | null; windowEnd: string | null }

/**
 * Emotion frequency is intentionally not a rolling window. The first qualifying
 * occurrence starts a 30-day chain; when it expires, the next occurrence starts
 * a new chain. This keeps evaluation deterministic across client reconciliations.
 */
export const getEmotionChainEvidence = (
  records: readonly CheckinRecord[],
  emotionId: string,
  scope: 'primary' | 'primary_secondary' = 'primary',
  today: string,
): EmotionChainEvidence => {
  const dates = sortedDates(records.filter((record) => emotionMatches(record, emotionId, scope)).map((record) => getLocalDateKey(record.occurredAt))).filter((date) => date <= today)
  if (!dates.length) return { count: 0, windowStart: null, windowEnd: null }

  let chainStart = dates[0]
  for (const date of dates.slice(1)) if (date > addDays(chainStart, 29)) chainStart = date
  const end = addDays(chainStart, 29)
  return { count: dates.filter((date) => date >= chainStart && date <= end).length, windowStart: chainStart, windowEnd: end }
}

/** Roll once for a pool. The caller supplies both random values so the rule is deterministic in tests. */
export const selectRandomPoolLetter = <T extends { openedCount: number }>(pool: readonly T[], chanceRoll: number, selectionRoll: number, dailyChance = RANDOM_DAILY_CHANCE): T | null => {
  if (!pool.length || chanceRoll >= dailyChance) return null
  const weights = pool.map((letter) => 1 / (1 + letter.openedCount))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = Math.max(0, Math.min(0.999999, selectionRoll)) * total
  for (let index = 0; index < pool.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return pool[index]
  }
  return pool[pool.length - 1]
}

const ruleValue = (rule: FutureLetterRule, context: FutureLetterEvaluationContext): { value: number; observed: Record<string, unknown>; windowStart: string | null; windowEnd: string | null } | null => {
  if (rule.type === 'checkin_streak') return { value: getCheckinStreak(context.checkins, context.today), observed: { checkin_streak: getCheckinStreak(context.checkins, context.today) }, windowStart: null, windowEnd: null }
  if (rule.type === 'diary_streak') return { value: getDiaryStreak(context.diaryEntries, context.today), observed: { diary_streak: getDiaryStreak(context.diaryEntries, context.today) }, windowStart: null, windowEnd: null }
  if (rule.type === 'checkin_total') return { value: context.checkins.filter((record) => getLocalDateKey(record.occurredAt) <= context.today).length, observed: { checkin_total: context.checkins.length }, windowStart: null, windowEnd: context.today }
  if (rule.type === 'checkin_frequency') {
    const period = rule.config.period ?? 'week'
    const periodCount = Math.max(1, rule.config.periodCount ?? 4)
    const days = period === 'day' ? 1 : period === 'month' ? 30 : 7
    const start = addDays(context.today, -(days * periodCount - 1))
    const value = new Set(context.checkins.map((record) => getLocalDateKey(record.occurredAt)).filter((date) => date >= start && date <= context.today)).size
    return { value, observed: { checkin_frequency: value, minimum_occurrences: rule.config.minimumOccurrences ?? rule.threshold ?? 0, period, period_count: periodCount }, windowStart: start, windowEnd: context.today }
  }
  if (rule.type === 'checkin_return_after_inactivity') {
    const inactiveDays = Math.max(1, rule.config.inactiveDays ?? 30)
    const dates = [...new Set(context.checkins.map((record) => getLocalDateKey(record.occurredAt)).filter((date) => date <= context.today))].sort()
    const qualifying = dates.find((date, index) => index > 0 && date >= addDays(dates[index - 1], inactiveDays + 1))
    return { value: qualifying ? inactiveDays : 0, observed: { return_after_inactivity: Boolean(qualifying), inactive_days: inactiveDays, checkin_date: qualifying ?? null }, windowStart: qualifying ? addDays(qualifying, -inactiveDays) : null, windowEnd: qualifying ?? null }
  }
  if (rule.type === 'diary_total') {
    const value = context.diaryEntries.filter((entry) => entry.status === 'done' && entry.localDate <= context.today).length
    return { value, observed: { diary_total: value }, windowStart: null, windowEnd: context.today }
  }
  if (rule.type === 'journey_total') {
    const value = (context.journeys ?? []).filter((journey) => journey.status === 'done' && Boolean(journey.completedAt)).length
    return { value, observed: { journey_total: value }, windowStart: null, windowEnd: context.today }
  }
  if (rule.type === 'minimum_wait') {
    const anchor = context.letterSentAt
    if (!anchor) return null
    const anchorDate = getLocalDateKey(anchor)
    const elapsedDays = Math.max(0, Math.round((Date.parse(`${context.today}T12:00:00+07:00`) - Date.parse(`${anchorDate}T12:00:00+07:00`)) / 86400000))
    const unit = rule.config.unit ?? 'day'
    const divisor = unit === 'week' ? 7 : unit === 'month' ? 30 : unit === 'year' ? 365 : 1
    return { value: Math.floor(elapsedDays / divisor), observed: { elapsed_days: elapsedDays, anchor: anchorDate, unit }, windowStart: anchorDate, windowEnd: context.today }
  }
  if (rule.type === 'time_window') {
    const mode = rule.config.timeWindowMode ?? 'date_range'
    const todayParts = context.today.split('-').map(Number)
    const day = todayParts[2]
    const month = todayParts[1]
    const weekday = new Date(Date.UTC(todayParts[0], month - 1, day)).getUTCDay()
    const inWindow = mode === 'day_of_month' ? day === rule.config.dayOfMonth : mode === 'month' ? month === rule.config.month : mode === 'weekday' ? weekday === rule.config.weekday : Boolean(rule.config.startDate && rule.config.endDate && context.today >= rule.config.startDate && context.today <= rule.config.endDate)
    return { value: inWindow ? 1 : 0, observed: { time_window_mode: mode, today: context.today }, windowStart: rule.config.startDate ?? context.today, windowEnd: rule.config.endDate ?? context.today }
  }
  if (rule.type === 'emotion_frequency') {
    const emotionId = rule.config.emotionId
    if (!emotionId) return null
    const scope = rule.config.scope ?? 'primary'
    const evidence = getEmotionChainEvidence(context.checkins, emotionId, scope, context.today)
    return { value: evidence.count, observed: { emotion_id: emotionId, scope, observed_count: evidence.count }, windowStart: evidence.windowStart, windowEnd: evidence.windowEnd }
  }
  if (rule.type === 'done_action') {
    const window = rule.config.mode === 'lifetime' ? 'all_time' : (rule.config.window ?? 'last_30_days')
    const value = getCompletedActionCount(context.actions, context.today, window)
    return { value, observed: { completed_actions: value, mode: rule.config.mode ?? 'window', window }, windowStart: window === 'all_time' ? null : addDays(context.today, window === 'last_7_days' ? -6 : -29), windowEnd: window === 'all_time' ? null : context.today }
  }
  if (rule.type === 'emotion_condition') {
    const emotionId = rule.config.emotionId
    if (!emotionId) return null
    const windowType = rule.config.windowType ?? 'since_sent'
    const windowValue = Math.max(1, rule.config.windowValue ?? 30)
    const start = windowType === 'last_days' || windowType === 'consecutive_days' ? addDays(context.today, -(windowValue - 1)) : rule.config.customWindowStart ?? null
    const end = rule.config.customWindowEnd ?? context.today
    const records = context.checkins.filter((record) => {
      const date = getLocalDateKey(record.occurredAt)
      return date <= end && (!start || date >= start) && emotionMatches(record, emotionId, rule.config.scope ?? 'primary')
    })
    const count = records.length
    const operator = rule.config.emotionOperator ?? 'exists'
    const value = operator === 'absent' ? (count === 0 ? 1 : 0) : operator === 'exists' ? (count > 0 ? 1 : 0) : count
    return { value, observed: { emotion_id: emotionId, emotion_operator: operator, observed_count: count }, windowStart: start, windowEnd: end }
  }
  return null
}

export type RuleEvaluation = {
  qualifies: boolean
  observedValues: Record<string, unknown>
  windowStart: string | null
  windowEnd: string | null
}

export const evaluateRule = (rule: FutureLetterRule, context: FutureLetterEvaluationContext): RuleEvaluation => {
  if (rule.type === 'random_date' || rule.type === 'random_condition') return { qualifies: false, observedValues: { daily_chance: rule.config.dailyChance ?? rule.config.probability ?? RANDOM_DAILY_CHANCE }, windowStart: rule.config.windowStart ?? null, windowEnd: rule.config.windowEnd ?? null }
  if (rule.type === 'specific_date') {
    const date = rule.config.date
    return { qualifies: Boolean(date && context.today >= date), observedValues: { date, today: context.today }, windowStart: date ?? null, windowEnd: date ?? null }
  }
  const details = ruleValue(rule, context)
  if (rule.type === 'emotion_condition') {
    const operator = rule.config.emotionOperator ?? 'exists'
    const qualifies = operator === 'absent' ? details?.value === 1 : operator === 'exists' ? details?.value === 1 : Boolean(details && details.value >= (rule.config.count ?? 1))
    return { qualifies, observedValues: { ...details?.observed, operator, count: rule.config.count ?? null }, windowStart: details?.windowStart ?? null, windowEnd: details?.windowEnd ?? null }
  }
  if (!details || rule.comparator === null || rule.threshold === null) return { qualifies: false, observedValues: details?.observed ?? {}, windowStart: details?.windowStart ?? null, windowEnd: details?.windowEnd ?? null }
  return { qualifies: compareValues(details.value, rule.comparator, rule.threshold), observedValues: { ...details.observed, threshold: rule.threshold, comparator: rule.comparator }, windowStart: details.windowStart, windowEnd: details.windowEnd }
}

export const evaluateGroup = (group: FutureLetterRuleGroup, context: FutureLetterEvaluationContext): boolean => {
  if (!group.rules.length) return false
  const results = group.rules.map((rule) => evaluateRule(rule, context).qualifies)
  return group.operator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

export const evaluateTriggerGroups = (groups: readonly FutureLetterRuleGroup[], groupOperator: GroupOperator, context: FutureLetterEvaluationContext): boolean => {
  if (!groups.length) return false
  const results = groups.map((group) => evaluateGroup(group, context))
  return groupOperator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

export const getFutureLetterRuleValidationError = (groups: readonly FutureLetterRuleGroup[], today = getFutureLetterLocalDate()): string | null => {
  if (!groups.length) return 'Hãy thêm ít nhất một nhóm điều kiện.'
  if (groups.some((group) => group.rules.length === 0)) return 'Mỗi nhóm điều kiện cần có ít nhất một điều kiện.'
  for (const rule of groups.flatMap((group) => group.rules)) {
    if (rule.type === 'random_date') {
      const chance = rule.config.dailyChance ?? RANDOM_DAILY_CHANCE
      if (chance <= 0 || chance > 1) return 'Xác suất cần lớn hơn 0% và không quá 100%.'
    } else if (rule.type === 'random_condition') {
      const chance = rule.config.probability ?? rule.config.dailyChance ?? RANDOM_DAILY_CHANCE
      if (chance <= 0 || chance > 1) return 'Xác suất cần lớn hơn 0% và không quá 100%.'
      if (rule.config.randomMode === 'window' && (!rule.config.windowStart || !rule.config.windowEnd || rule.config.windowEnd < rule.config.windowStart)) return 'Khoảng thời gian của xác suất chưa hợp lệ.'
    } else if (rule.type === 'specific_date') {
      if (!rule.config.date) return 'Hãy chọn ngày lá thư có thể trở về.'
      if (rule.config.date < today) return 'Ngày trở về không thể nằm hoàn toàn trước hôm nay.'
    } else if (rule.type === 'minimum_wait') {
      if (!rule.config.amount || rule.config.amount <= 0) return 'Khoảng chờ cần lớn hơn 0.'
    } else if (rule.type === 'time_window') {
      const mode = rule.config.timeWindowMode ?? 'date_range'
      if (mode === 'day_of_month' && (!rule.config.dayOfMonth || rule.config.dayOfMonth < 1 || rule.config.dayOfMonth > 31)) return 'Ngày trong tháng cần nằm từ 1 đến 31.'
      if (mode === 'month' && (!rule.config.month || rule.config.month < 1 || rule.config.month > 12)) return 'Hãy chọn một tháng hợp lệ.'
      if (mode === 'weekday' && (rule.config.weekday === undefined || rule.config.weekday < 0 || rule.config.weekday > 6)) return 'Hãy chọn một ngày trong tuần.'
      if (mode === 'date_range' && (!rule.config.startDate || !rule.config.endDate || rule.config.endDate < rule.config.startDate)) return 'Khoảng ngày chưa hợp lệ.'
    } else if (rule.type === 'checkin_frequency') {
      if (!rule.config.minimumOccurrences || rule.config.minimumOccurrences <= 0 || !rule.config.periodCount || rule.config.periodCount <= 0) return 'Tần suất Check-in cần có số lần và số chu kỳ lớn hơn 0.'
    } else if (rule.type === 'checkin_return_after_inactivity') {
      if (!rule.config.inactiveDays || rule.config.inactiveDays <= 0) return 'Khoảng nghỉ cần lớn hơn 0 ngày.'
    } else if (rule.type === 'emotion_condition') {
      if (!rule.config.emotionId) return 'Hãy chọn một cảm xúc.'
      if (rule.config.emotionOperator === 'count_gte' && (!rule.config.count || rule.config.count <= 0)) return 'Số lần xuất hiện cần lớn hơn 0.'
      if ((rule.config.windowType === 'last_days' || rule.config.windowType === 'consecutive_days') && (!rule.config.windowValue || rule.config.windowValue <= 0)) return 'Khoảng thời gian cần lớn hơn 0 ngày.'
      if (rule.config.windowType === 'custom_range' && (!rule.config.customWindowStart || !rule.config.customWindowEnd || rule.config.customWindowEnd < rule.config.customWindowStart)) return 'Khoảng thời gian cảm xúc chưa hợp lệ.'
    } else if (rule.comparator === null || rule.threshold === null || rule.threshold <= 0) {
      return 'Mỗi điều kiện cần có giá trị lớn hơn 0.'
    }
  }
  return null
}

export const isHomeAvailable = (letter: { state: FutureLetterState; lastOpenedAt: string | null }, today = getFutureLetterLocalDate()): boolean =>
  letter.state === 'available_unopened' || (letter.state === 'opened' && Boolean(letter.lastOpenedAt && getLocalDateKey(letter.lastOpenedAt) === today))

export const isTriggerTypeLatched = (events: Array<{ triggerType: string }>, triggerType: string): boolean => events.some((event) => event.triggerType === triggerType)

export const stateLabel = (state: FutureLetterState): string => ({
  draft: 'Bản nháp',
  writing: 'Đang viết',
  decorating: 'Đang trang trí',
  preview: 'Sẵn sàng niêm phong',
  sealed_waiting: 'Đang chờ',
  available_unopened: 'Đang chờ bạn mở',
  opened: 'Đã mở',
  archived: 'Đã lưu giữ',
}[state])

export const triggerLabel = (type: FutureLetterRule['type']): string => TRIGGER_OPTIONS.find((item) => item.type === type)?.label ?? type

export const formatFutureLetterDate = (isoOrDate: string): string => {
  const date = isoOrDate.includes('T') ? new Date(isoOrDate) : new Date(`${isoOrDate}T12:00:00+07:00`)
  return new Intl.DateTimeFormat('vi-VN', { timeZone: FUTURE_LETTER_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export const formatFutureLetterDateTime = (isoDate: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: FUTURE_LETTER_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(isoDate))
