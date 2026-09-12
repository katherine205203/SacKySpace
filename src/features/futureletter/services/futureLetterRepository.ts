import { supabase } from '../../../services/supabase/client'
import { getPublishedRuntimeValue } from '../../../services/runtimeConfig'
import { listActions } from '../../actionspace/actionService'
import { listCheckins } from '../../checkin/services/checkinRepository'
import { getReferenceData } from '../../checkin/services/referenceRepository'
import { listDiaryEntries, listJourneyEntries } from '../../diary/services/diaryRepository'
import type { CheckinRecord, Emotion, ReferenceData } from '../../checkin/types'
import type { FutureLetter, FutureLetterDraft, FutureLetterRule, FutureLetterRuleGroup, FutureLetterTriggerEvent, FutureLetterEvaluationContext } from '../types'
import { ENVELOPE_ASSETS, RANDOM_DAILY_CHANCE, SEAL_ASSETS, evaluateGroup, evaluateRule, evaluateTriggerGroups, getFutureLetterLocalDate, getFutureLetterRuleValidationError, getEmotionChainEvidence, isHomeAvailable, isTriggerTypeLatched, selectRandomPoolLetter } from '../utils'
import { isRichTextEmpty } from '../../../components/richText'

const LOCAL_STORAGE_KEY = 'sacky:future-letter:v2:'
let remoteDraftQueue: Promise<void> = Promise.resolve()
const knownLetters = new Map<string, FutureLetter>()
let contextOptionsPromise: Promise<{ checkins: CheckinRecord[]; emotions: Emotion[] }> | null = null
let contextOptionsUserId: string | null = null

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0
    const value = character === 'x' ? random : random & 0x3 | 0x8
    return value.toString(16)
  })
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: string | undefined): value is string => Boolean(value && UUID_PATTERN.test(value))

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Bạn cần đăng nhập để dùng FutureMe.')
  return data.user.id
}

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try { return window.localStorage } catch { return null }
}

const readLocalLetters = (userId: string): FutureLetter[] => {
  const storage = getLocalStorage()
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(`${LOCAL_STORAGE_KEY}${userId}`) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is FutureLetter => Boolean(item && typeof item === 'object' && typeof (item as FutureLetter).id === 'string' && typeof (item as FutureLetter).title === 'string'))
  } catch { return [] }
}

const writeLocalLetters = (userId: string, letters: FutureLetter[]): void => {
  const storage = getLocalStorage()
  if (!storage) return
  try { storage.setItem(`${LOCAL_STORAGE_KEY}${userId}`, JSON.stringify(letters)) } catch { /* Remote remains authoritative. */ }
}

const describeRemoteError = (reason: unknown): string | null => {
  if (reason instanceof Error && reason.message) return reason.message
  if (!reason || typeof reason !== 'object') return null
  const error = reason as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
  const parts = [error.message, error.details, error.hint].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const code = typeof error.code === 'string' && error.code ? ` [${error.code}]` : ''
  return parts.length ? `${parts.join(' — ')}${code}` : null
}

const remotePersistenceError = (operation: string, reason: unknown): Error => {
  const detail = describeRemoteError(reason)
  const error = new Error(`${operation}${detail ? `: ${detail}` : ''}`)
  Object.assign(error, { cause: reason })
  return error
}

type FutureLetterRow = {
  id: string
  user_id: string
  title: string
  body: string
  lifecycle_state: FutureLetter['state']
  group_operator: FutureLetter['groupOperator']
  envelope_asset_id: string | null
  seal_asset_id: string | null
  decoration_snapshot: FutureLetter['decorationSnapshot']
  opened_count: number
  created_at: string
  updated_at: string
  sealed_at: string | null
  first_opened_at: string | null
  last_opened_at: string | null
  archived_at: string | null
}

type AttachmentRow = { id: string; letter_id: string; attachment_type: 'emotion' | 'checkin'; ref_id: string; snapshot: Record<string, unknown> | null; position: number }
type GroupRow = { id: string; letter_id: string; group_operator: FutureLetterRuleGroup['operator']; position: number }
type RuleRow = { id: string; group_id: string; rule_type: FutureLetterRule['type']; comparator: FutureLetterRule['comparator']; threshold: number | null; config_json: FutureLetterRule['config']; position: number }
type EventRow = { id: string; letter_id: string; dedupe_key: string; trigger_type: FutureLetterTriggerEvent['triggerType']; rule_snapshot: Record<string, unknown>; observed_values: Record<string, unknown>; window_start: string | null; window_end: string | null; triggered_at: string; available_since: string; opened_at: string | null; source_ref_ids: string[] }

const mapRemoteLetters = (rows: FutureLetterRow[], attachments: AttachmentRow[], groups: GroupRow[], rules: RuleRow[], events: EventRow[]): FutureLetter[] => rows.map((row) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  body: row.body,
  state: row.lifecycle_state,
  groupOperator: row.group_operator,
  groups: groups.filter((group) => group.letter_id === row.id).sort((left, right) => left.position - right.position).map((group) => ({
    id: group.id,
    operator: group.group_operator,
    position: group.position,
    rules: rules.filter((rule) => rule.group_id === group.id).sort((left, right) => left.position - right.position).map((rule) => ({ id: rule.id, groupId: rule.group_id, type: rule.rule_type, comparator: rule.comparator, threshold: rule.threshold === null ? null : Number(rule.threshold), config: rule.config_json ?? {}, position: rule.position })),
  })),
  attachments: attachments.filter((attachment) => attachment.letter_id === row.id).sort((left, right) => left.position - right.position).map((attachment) => ({ id: attachment.id, attachmentType: attachment.attachment_type, refId: attachment.ref_id, snapshot: attachment.snapshot, position: attachment.position })),
  envelopeAssetId: row.envelope_asset_id,
  sealAssetId: row.seal_asset_id,
  decorationSnapshot: row.decoration_snapshot,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sealedAt: row.sealed_at,
  firstOpenedAt: row.first_opened_at,
  lastOpenedAt: row.last_opened_at,
  openedCount: row.opened_count,
  archivedAt: row.archived_at,
  triggerEvents: events.filter((event) => event.letter_id === row.id).sort((left, right) => right.triggered_at.localeCompare(left.triggered_at)).map((event) => ({ id: event.id, letterId: event.letter_id, triggerType: event.trigger_type, ruleSnapshot: event.rule_snapshot ?? {}, observedValues: event.observed_values ?? {}, windowStart: event.window_start, windowEnd: event.window_end, triggeredAt: event.triggered_at, availableSince: event.available_since, openedAt: event.opened_at, sourceRefIds: event.source_ref_ids ?? [] })),
}))

const listRemoteLetters = async (userId: string): Promise<FutureLetter[]> => {
  const { data, error } = await supabase.from('future_letters').select('id, user_id, title, body, lifecycle_state, group_operator, envelope_asset_id, seal_asset_id, decoration_snapshot, opened_count, created_at, updated_at, sealed_at, first_opened_at, last_opened_at, archived_at').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as FutureLetterRow[]
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [attachmentResult, groupResult, eventResult] = await Promise.all([
    supabase.from('future_letter_context_attachments').select('id, letter_id, attachment_type, ref_id, snapshot, position').in('letter_id', ids).order('position'),
    supabase.from('future_letter_rule_groups').select('id, letter_id, group_operator, position').in('letter_id', ids).order('position'),
    supabase.from('future_letter_trigger_events').select('id, letter_id, dedupe_key, trigger_type, rule_snapshot, observed_values, window_start, window_end, triggered_at, available_since, opened_at, source_ref_ids').in('letter_id', ids).order('triggered_at', { ascending: false }),
  ])
  if (attachmentResult.error) throw attachmentResult.error
  if (groupResult.error) throw groupResult.error
  if (eventResult.error) throw eventResult.error
  const groupIds = ((groupResult.data ?? []) as GroupRow[]).map((group) => group.id)
  const ruleResult = groupIds.length ? await supabase.from('future_letter_rules').select('id, group_id, rule_type, comparator, threshold, config_json, position').in('group_id', groupIds).order('position') : { data: [], error: null }
  if (ruleResult.error) throw ruleResult.error
  return mapRemoteLetters(rows, (attachmentResult.data ?? []) as AttachmentRow[], (groupResult.data ?? []) as GroupRow[], (ruleResult.data ?? []) as RuleRow[], (eventResult.data ?? []) as EventRow[])
}

export const listFutureLetters = async (requestedUserId?: string): Promise<FutureLetter[]> => {
  const userId = requestedUserId ?? await currentUserId()
  const localLetters = readLocalLetters(userId)
  try {
    const remoteLetters = await listRemoteLetters(userId)
    remoteLetters.forEach((letter) => knownLetters.set(letter.id, letter))
    const remoteIds = new Set(remoteLetters.map((letter) => letter.id))
    return [...remoteLetters, ...localLetters.filter((letter) => !remoteIds.has(letter.id))].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  } catch {
    return localLetters.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }
}

const normalizeDraft = (draft: FutureLetterDraft, userId: string, existing: FutureLetter | null): FutureLetter => {
  const now = new Date().toISOString()
  const groups = draft.groups.map((group, groupIndex) => {
    const groupId = isUuid(group.id) ? group.id : createId()
    return {
      id: groupId,
      operator: group.operator,
      position: groupIndex + 1,
      rules: group.rules.map((rule, ruleIndex) => ({ ...rule, id: isUuid(rule.id) ? rule.id : createId(), groupId, position: ruleIndex + 1 })),
    }
  })
  return {
    id: isUuid(draft.id) ? draft.id : isUuid(existing?.id) ? existing.id : createId(),
    userId,
    title: draft.title,
    body: draft.body,
    state: draft.state,
    groupOperator: draft.groupOperator,
    groups,
    attachments: draft.attachments.map((attachment, index) => ({ ...attachment, id: isUuid(attachment.id) ? attachment.id : createId(), position: index + 1 })),
    envelopeAssetId: draft.envelopeAssetId,
    sealAssetId: draft.sealAssetId,
    decorationSnapshot: draft.decorationSnapshot,
    createdAt: existing?.createdAt ?? draft.createdAt ?? now,
    updatedAt: now,
    sealedAt: draft.sealedAt ?? existing?.sealedAt ?? null,
    firstOpenedAt: draft.firstOpenedAt ?? existing?.firstOpenedAt ?? null,
    lastOpenedAt: draft.lastOpenedAt ?? existing?.lastOpenedAt ?? null,
    openedCount: draft.openedCount ?? existing?.openedCount ?? 0,
    archivedAt: draft.archivedAt ?? existing?.archivedAt ?? null,
    triggerEvents: draft.triggerEvents ?? existing?.triggerEvents ?? [],
  }
}

const toEventRow = (event: FutureLetterTriggerEvent) => ({
  id: event.id,
  letter_id: event.letterId,
  dedupe_key: `${event.letterId}:${event.triggerType}:${event.availableSince}`,
  trigger_type: event.triggerType,
  rule_snapshot: event.ruleSnapshot,
  observed_values: event.observedValues,
  window_start: event.windowStart,
  window_end: event.windowEnd,
  triggered_at: event.triggeredAt,
  available_since: event.availableSince,
  opened_at: event.openedAt,
  source_ref_ids: event.sourceRefIds,
})

const persistRemoteLetter = async (letter: FutureLetter): Promise<FutureLetter> => {
  const { data, error } = await supabase.from('future_letters').upsert({ id: letter.id, user_id: letter.userId, title: letter.title, body: letter.body, lifecycle_state: letter.state, group_operator: letter.groupOperator, envelope_asset_id: letter.envelopeAssetId, seal_asset_id: letter.sealAssetId, decoration_snapshot: letter.decorationSnapshot, opened_count: letter.openedCount, sealed_at: letter.sealedAt, first_opened_at: letter.firstOpenedAt, last_opened_at: letter.lastOpenedAt, archived_at: letter.archivedAt }).select('id, user_id, title, body, lifecycle_state, group_operator, envelope_asset_id, seal_asset_id, decoration_snapshot, opened_count, created_at, updated_at, sealed_at, first_opened_at, last_opened_at, archived_at').single()
  if (error) throw remotePersistenceError('Không thể lưu thông tin lá thư', error)
  const row = data as FutureLetterRow
  const letterId = row.id
  const deleteChildren = await Promise.all([
    supabase.from('future_letter_context_attachments').delete().eq('letter_id', letterId),
    supabase.from('future_letter_rule_groups').delete().eq('letter_id', letterId),
    supabase.from('future_letter_trigger_events').delete().eq('letter_id', letterId),
  ])
  for (const result of deleteChildren) if (result.error) throw remotePersistenceError('Không thể làm mới điều kiện của lá thư', result.error)
  if (letter.attachments.length) {
    const { error: attachmentError } = await supabase.from('future_letter_context_attachments').insert(letter.attachments.map((attachment) => ({ id: attachment.id, letter_id: letterId, attachment_type: attachment.attachmentType, ref_id: attachment.refId, snapshot: attachment.snapshot, position: attachment.position })))
    if (attachmentError) throw remotePersistenceError('Không thể lưu ký ức đi cùng lá thư', attachmentError)
  }
  if (letter.groups.length) {
    const { error: groupError } = await supabase.from('future_letter_rule_groups').insert(letter.groups.map((group) => ({ id: group.id, letter_id: letterId, group_operator: group.operator, position: group.position })))
    if (groupError) throw remotePersistenceError('Không thể lưu nhóm điều kiện của lá thư', groupError)
    const rules = letter.groups.flatMap((group) => group.rules.map((rule) => ({ id: rule.id, group_id: group.id, rule_type: rule.type, comparator: rule.comparator, threshold: rule.threshold, config_json: rule.config, position: rule.position })))
    if (rules.length) {
      const { error: ruleError } = await supabase.from('future_letter_rules').insert(rules)
      if (ruleError) throw remotePersistenceError('Không thể lưu điều kiện của lá thư', ruleError)
    }
  }
  if (letter.triggerEvents.length) {
    const { error: eventError } = await supabase.from('future_letter_trigger_events').insert(letter.triggerEvents.map(toEventRow))
    if (eventError) throw remotePersistenceError('Không thể lưu lịch sử trở về của lá thư', eventError)
  }
  return { ...letter, id: letterId, createdAt: row.created_at, updatedAt: row.updated_at, sealedAt: row.sealed_at, firstOpenedAt: row.first_opened_at, lastOpenedAt: row.last_opened_at, openedCount: row.opened_count, archivedAt: row.archived_at }
}

const persistLocalLetter = (letter: FutureLetter): FutureLetter => {
  knownLetters.set(letter.id, letter)
  const letters = readLocalLetters(letter.userId).filter((item) => item.id !== letter.id)
  writeLocalLetters(letter.userId, [letter, ...letters])
  return letter
}

const enqueueRemoteDraft = (letter: FutureLetter): void => {
  remoteDraftQueue = remoteDraftQueue
    .catch(() => undefined)
    .then(async () => {
      try { persistLocalLetter(await persistRemoteLetter(letter)) } catch { /* Local draft remains available when remote persistence is unavailable. */ }
    })
}

export const flushFutureLetterDraft = async (): Promise<void> => {
  await remoteDraftQueue.catch(() => undefined)
}

export const saveFutureLetterDraft = async (draft: FutureLetterDraft): Promise<FutureLetter> => {
  if (!draft.title.trim()) throw new Error('Hãy đặt tiêu đề cho bản nháp.')
  if (isRichTextEmpty(draft.body)) throw new Error('Hãy viết nội dung cho bản nháp.')
  const userId = await currentUserId()
  const existing = draft.id ? readLocalLetters(userId).find((letter) => letter.id === draft.id) ?? knownLetters.get(draft.id) ?? null : null
  if (existing?.state === 'sealed_waiting' || existing?.state === 'available_unopened' || existing?.state === 'opened' || existing?.state === 'archived') throw new Error('Lá thư đã niêm phong nên không thể chỉnh sửa.')
  const letter = normalizeDraft(draft, userId, existing)
  persistLocalLetter(letter)
  enqueueRemoteDraft(letter)
  return letter
}

const validateSeal = (letter: FutureLetter): void => {
  if (!letter.title.trim()) throw new Error('Hãy đặt tiêu đề cho lá thư.')
  if (isRichTextEmpty(letter.body)) throw new Error('Hãy viết nội dung trước khi niêm phong.')
  const ruleError = getFutureLetterRuleValidationError(letter.groups)
  if (ruleError) throw new Error(ruleError)
  if (!letter.envelopeAssetId || !letter.sealAssetId) throw new Error('Hãy chọn phong bì và ấn niêm phong.')
}

export const sealFutureLetter = async (draft: FutureLetterDraft): Promise<FutureLetter> => {
  const userId = await currentUserId()
  await flushFutureLetterDraft()
  const existing = draft.id ? readLocalLetters(userId).find((letter) => letter.id === draft.id) ?? knownLetters.get(draft.id) ?? null : null
  const now = new Date().toISOString()
  const envelope = ENVELOPE_ASSETS.find((asset) => asset.id === draft.envelopeAssetId)
  const seal = SEAL_ASSETS.find((asset) => asset.id === draft.sealAssetId)
  const letter = normalizeDraft({ ...draft, state: 'sealed_waiting', sealedAt: now, decorationSnapshot: { envelopeAssetId: draft.envelopeAssetId ?? '', sealAssetId: draft.sealAssetId ?? '', envelopeLabel: envelope?.label ?? 'Phong bì', sealLabel: seal?.label ?? 'Ấn niêm phong', capturedAt: now } }, userId, existing)
  validateSeal(letter)
  try {
    const saved = await persistRemoteLetter(letter)
    return persistLocalLetter(saved)
  } catch (reason) {
    console.warn('[Future Letter] Remote seal sync failed; keeping the sealed letter locally and retrying.', reason)
    persistLocalLetter(letter)
    enqueueRemoteDraft(letter)
    return letter
  }
}

export const openFutureLetter = async (id: string): Promise<FutureLetter> => {
  const userId = await currentUserId()
  const letter = (await listFutureLetters()).find((item) => item.id === id)
  if (!letter) throw new Error('Không tìm thấy lá thư.')
  if (letter.state !== 'available_unopened' && letter.state !== 'opened') throw new Error('Lá thư này chưa sẵn sàng để mở.')
  const now = new Date().toISOString()
  const nextEvents = letter.triggerEvents.map((event, index) => index === 0 && !event.openedAt ? { ...event, openedAt: now } : event)
  const updated: FutureLetter = { ...letter, userId, state: 'opened', openedCount: letter.openedCount + 1, firstOpenedAt: letter.firstOpenedAt ?? now, lastOpenedAt: now, updatedAt: now, triggerEvents: nextEvents }
  try { return persistLocalLetter(await persistRemoteLetter(updated)) } catch { return persistLocalLetter(updated) }
}

export const archiveFutureLetter = async (id: string): Promise<FutureLetter> => {
  const userId = await currentUserId()
  const letter = (await listFutureLetters()).find((item) => item.id === id)
  if (!letter) throw new Error('Không tìm thấy lá thư.')
  const now = new Date().toISOString()
  const archived = { ...letter, userId, state: 'archived' as const, archivedAt: now, updatedAt: now }
  try { return persistLocalLetter(await persistRemoteLetter(archived)) } catch { return persistLocalLetter(archived) }
}

export const deleteFutureLetter = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  await flushFutureLetterDraft()
  const { error } = await supabase.from('future_letters').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  knownLetters.delete(id)
  writeLocalLetters(userId, readLocalLetters(userId).filter((letter) => letter.id !== id))
}

const createTriggerEvent = (letter: FutureLetter, type: FutureLetterTriggerEvent['triggerType'], observedValues: Record<string, unknown>, windowStart: string | null, windowEnd: string | null, sourceRefIds: string[]): FutureLetterTriggerEvent => {
  const now = new Date().toISOString()
  return { id: createId(), letterId: letter.id, triggerType: type, ruleSnapshot: { type, groups: letter.groups }, observedValues, windowStart, windowEnd, triggeredAt: now, availableSince: now, openedAt: null, sourceRefIds }
}

const getFirstQualifyingRule = (letter: FutureLetter, context: FutureLetterEvaluationContext): { rule: FutureLetterRule; observedValues: Record<string, unknown>; windowStart: string | null; windowEnd: string | null } | null => {
  for (const group of letter.groups) {
    if (!evaluateGroup(group, context)) continue
    for (const rule of group.rules) {
      const evaluation = evaluateRule(rule, context)
      if (evaluation.qualifies) return { rule, observedValues: evaluation.observedValues, windowStart: evaluation.windowStart, windowEnd: evaluation.windowEnd }
    }
  }
  return null
}

const isRandomRule = (rule: FutureLetterRule): boolean => rule.type === 'random_date' || rule.type === 'random_condition'

const getEligibleRandomRule = (letter: FutureLetter, context: FutureLetterEvaluationContext): FutureLetterRule | null => {
  for (const group of letter.groups) {
    const prerequisites = group.rules.filter((rule) => !isRandomRule(rule))
    const prerequisitesMet = prerequisites.length === 0 || evaluateGroup({ ...group, rules: prerequisites }, context)
    if (!prerequisitesMet) continue
    for (const rule of group.rules.filter(isRandomRule)) {
      if (rule.type === 'random_date') return rule
      const mode = rule.config.randomMode ?? 'after_prerequisites'
      if (mode === 'always') return rule
      if (mode === 'window' && rule.config.windowStart && rule.config.windowEnd && context.today >= rule.config.windowStart && context.today <= rule.config.windowEnd) return rule
      if (mode === 'after_prerequisites') return rule
    }
  }
  return null
}

const localRollKey = (userId: string, date: string): string => `${LOCAL_STORAGE_KEY}roll:${userId}:${date}`

const hasLocalRoll = (userId: string, date: string): boolean => {
  const storage = getLocalStorage()
  return Boolean(storage?.getItem(localRollKey(userId, date)))
}

const saveLocalRoll = (userId: string, date: string): void => getLocalStorage()?.setItem(localRollKey(userId, date), '1')

export const reconcileFutureLetters = async (requestedUserId?: string): Promise<FutureLetter[]> => {
  const userId = requestedUserId ?? await currentUserId()
  const letters = await listFutureLetters(userId)
  const today = getFutureLetterLocalDate()
  const [reference, contextOptions, diaryEntries, journeys, actions] = await Promise.all([
    getReferenceData().catch(() => null as ReferenceData | null),
    getContextOptions(userId),
    listDiaryEntries().catch(() => []),
    listJourneyEntries().catch(() => []),
    listActions(userId).catch(() => []),
  ])
  const checkins = reference ? contextOptions.checkins : []
  const baseContext: FutureLetterEvaluationContext = { today, checkins, diaryEntries, journeys, actions }
  const randomDailyChance = await getPublishedRuntimeValue('future_letter.random_daily_chance', RANDOM_DAILY_CHANCE)
  let nextLetters = [...letters]
  const updateLetter = async (letter: FutureLetter): Promise<void> => {
    nextLetters = nextLetters.map((item) => item.id === letter.id ? letter : item)
    try { await persistRemoteLetter(letter) } catch { persistLocalLetter(letter) }
  }

  for (const letter of nextLetters) {
    if (letter.state !== 'sealed_waiting') continue
    const context: FutureLetterEvaluationContext = { ...baseContext, letterSentAt: letter.sealedAt ?? letter.createdAt }
    if (letter.groups.some((group) => group.rules.some(isRandomRule))) continue
    if (!evaluateTriggerGroups(letter.groups, letter.groupOperator, context)) continue
    const qualifying = getFirstQualifyingRule(letter, context)
    if (!qualifying || qualifying.rule.type === 'random_date' || qualifying.rule.type === 'random_condition') continue
    if (isTriggerTypeLatched(letter.triggerEvents, qualifying.rule.type)) continue
    const event = createTriggerEvent(letter, qualifying.rule.type, qualifying.observedValues, qualifying.windowStart, qualifying.windowEnd, qualifying.rule.config.emotionId ? [qualifying.rule.config.emotionId] : [])
    await updateLetter({ ...letter, state: 'available_unopened', updatedAt: new Date().toISOString(), triggerEvents: [event, ...letter.triggerEvents] })
  }

  if (!hasLocalRoll(userId, today)) {
    let shouldRoll = true
    try {
      const { data } = await supabase.from('future_letter_random_rolls').select('id').eq('user_id', userId).eq('local_date', today).maybeSingle()
      shouldRoll = !data
    } catch { shouldRoll = true }
    if (shouldRoll) {
      saveLocalRoll(userId, today)
      const eligible = nextLetters.map((letter) => ({ letter, rule: getEligibleRandomRule(letter, { ...baseContext, letterSentAt: letter.sealedAt ?? letter.createdAt }) })).filter((item): item is { letter: FutureLetter; rule: FutureLetterRule } => Boolean(item.rule) && item.letter.state === 'sealed_waiting' && !item.letter.triggerEvents.some((event) => event.triggerType === 'random_date' || event.triggerType === 'random_condition'))
      const pool = eligible.map((item) => item.letter)
      const poolChance = eligible.some((item) => item.rule.type === 'random_date') ? randomDailyChance : Math.max(...eligible.map((item) => item.rule.config.probability ?? item.rule.config.dailyChance ?? randomDailyChance), 0)
      const selected = selectRandomPoolLetter(pool, Math.random(), Math.random(), poolChance)
      let canApplySelection = true
      try {
        const result = await supabase.from('future_letter_random_rolls').insert({ user_id: userId, local_date: today, daily_chance: poolChance, rolled: true, selected_letter_id: selected?.id ?? null })
        // A concurrent device may win the unique (user, local day) roll.
        if (result.error?.code === '23505') canApplySelection = false
      } catch { /* Local roll remains idempotent when the migration is not live. */ }
      if (selected && canApplySelection) {
        const selectedRule = eligible.find((item) => item.letter.id === selected.id)?.rule
        const eventType = selectedRule?.type ?? 'random_date'
        const event = createTriggerEvent(selected, eventType, { daily_chance: selectedRule?.config.probability ?? selectedRule?.config.dailyChance ?? poolChance, pool_size: pool.length, selected_letter_id: selected.id }, selectedRule?.config.windowStart ?? null, selectedRule?.config.windowEnd ?? null, [])
        await updateLetter({ ...selected, state: 'available_unopened', updatedAt: new Date().toISOString(), triggerEvents: [event, ...selected.triggerEvents] })
      }
    }
  }
  return nextLetters
}

export const getFutureLetterLibrary = async (): Promise<{ letters: FutureLetter[]; counts: Record<'draft' | 'waiting' | 'available' | 'opened' | 'archived', number> }> => {
  const letters = await reconcileFutureLetters()
  return {
    letters,
    counts: {
      draft: letters.filter((letter) => ['draft', 'writing', 'decorating', 'preview'].includes(letter.state)).length,
      waiting: letters.filter((letter) => letter.state === 'sealed_waiting').length,
      available: letters.filter((letter) => letter.state === 'available_unopened').length,
      opened: letters.filter((letter) => letter.state === 'opened').length,
      archived: letters.filter((letter) => letter.state === 'archived').length,
    },
  }
}

export const getFutureLetterHomeProjection = async (userId?: string): Promise<{ availableCount: number; availableTitle: string | null }> => {
  try {
    // Reconciliation belongs to FutureMe; Home only receives the resulting projection.
    const letters = await reconcileFutureLetters(userId)
    const available = letters.filter((letter) => isHomeAvailable(letter))
    return { availableCount: available.length, availableTitle: available[0]?.title ?? null }
  } catch { return { availableCount: 0, availableTitle: null } }
}

export const createEmptyFutureLetterDraft = (): FutureLetterDraft => {
  const groupId = createId()
  return {
    id: createId(),
    title: '',
    body: '',
    state: 'writing',
    groupOperator: 'OR',
    groups: [{ id: groupId, operator: 'AND', position: 1, rules: [{ id: createId(), groupId, type: 'random_date', comparator: null, threshold: null, config: { dailyChance: RANDOM_DAILY_CHANCE }, position: 1 }] }],
    attachments: [],
    envelopeAssetId: null,
    sealAssetId: null,
    decorationSnapshot: null,
  }
}

export const getContextOptions = async (requestedUserId?: string): Promise<{ checkins: CheckinRecord[]; emotions: Emotion[] }> => {
  const userId = requestedUserId ?? await currentUserId()
  if (!contextOptionsPromise || contextOptionsUserId !== userId) {
    contextOptionsUserId = userId
    contextOptionsPromise = (async () => {
      const reference = await getReferenceData()
      const checkins = await listCheckins(reference, userId)
      const emotionIds = new Set(checkins.flatMap((record) => [record.primaryEmotionId, ...record.secondaryEmotions.map((emotion) => emotion.emotion_id)]).filter((id): id is string => Boolean(id)))
      return { checkins, emotions: reference.emotions.filter((emotion) => emotionIds.has(emotion.emotion_id)) }
    })().catch((reason: unknown) => {
      contextOptionsPromise = null
      contextOptionsUserId = null
      throw reason
    })
  }
  try { return await contextOptionsPromise } catch { return { checkins: [], emotions: [] } }
}

export const getEmotionAttachmentSnapshot = (emotion: Emotion): Record<string, unknown> => ({ emotion_id: emotion.emotion_id, emotion_name_vn: emotion.emotion_name_vn, emoji: emotion.emoji, color_hex: emotion.color_hex })
export const getCheckinAttachmentSnapshot = (record: CheckinRecord): Record<string, unknown> => ({ id: record.id, occurred_at: record.occurredAt, created_at: record.createdAt, checkin_type: record.checkinType, primary_emotion_id: record.primaryEmotionId, emotion_name_vn: record.primaryEmotion?.emotion_name_vn ?? null, emoji: record.primaryEmotion?.emoji ?? record.unknownPrompt?.emoji ?? '◌' })

export const findEmotionChainEvidence = getEmotionChainEvidence
