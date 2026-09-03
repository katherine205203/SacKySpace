import { supabase } from '../../../services/supabase/client'
import { listActions, listActionReflections } from '../../actionspace/actionService'
import type { ActionRecord, ActionReflection } from '../../actionspace/types'
import { getReferenceData } from '../../checkin/services/referenceRepository'
import { listCheckins } from '../../checkin/services/checkinRepository'
import type { CheckinRecord } from '../../checkin/types'
import { getDiaryLocalDate } from '../utils'
import type { DayRecord, DayRecordFact, DayRecordItem, DayRecordSnapshot } from '../types'

const ACTION_COLOR = '#743CFF'
const UNKNOWN_COLOR = '#7B879D'

const dayFor = (value: string): string => getDiaryLocalDate(new Date(value))

export const isDayRecordLocked = (localDate: string, now = new Date()): boolean => localDate < getDiaryLocalDate(now)

const checkinFact = (record: CheckinRecord): DayRecordFact => {
  if (record.checkinType === 'unknown') {
    return {
      kind: 'checkin',
      sourceId: record.id,
      occurredAt: record.createdAt,
      updatedAt: record.updatedAt,
      color: UNKNOWN_COLOR,
      emoji: record.unknownPrompt?.emoji ?? '◌',
      title: 'Check-in · Mình còn đang mơ hồ',
      description: record.note ?? undefined,
      unknownPrompt: record.unknownPrompt?.prompt_text_vn ?? undefined,
    }
  }
  return {
    kind: 'checkin',
    sourceId: record.id,
    occurredAt: record.createdAt,
    updatedAt: record.updatedAt,
    color: record.primaryEmotion?.color_hex ?? UNKNOWN_COLOR,
    emoji: record.primaryEmotion?.emoji ?? '◉',
    title: `Check-in · ${record.primaryEmotion?.emotion_name_vn ?? 'Cảm xúc'}`,
    titleEn: record.primaryEmotion?.emotion_name_en,
    description: record.note ?? undefined,
    intensity: record.intensity,
    secondaryEmotions: record.secondaryEmotions.map((emotion) => emotion.emotion_name_vn),
  }
}

const latestReflection = (reflections: readonly ActionReflection[], actionId: string): ActionReflection | null =>
  reflections.filter((reflection) => reflection.actionId === actionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null

const actionFact = (action: ActionRecord, source: CheckinRecord | null, reflection: ActionReflection | null): DayRecordFact => ({
  kind: 'action',
  sourceId: action.id,
  occurredAt: action.completedAt ?? action.updatedAt,
  updatedAt: action.updatedAt,
  color: source?.primaryEmotion?.color_hex ?? ACTION_COLOR,
  emoji: source?.primaryEmotion?.emoji ?? source?.unknownPrompt?.emoji ?? '✨',
  title: action.title,
  description: action.note ?? undefined,
  sourceLabel: source ? `Từ Check-in ${source.primaryEmotion?.emotion_name_vn ?? 'đã gắn'}` : 'Độc lập',
  reflectionLabel: reflection?.outcomeSnapshot ?? undefined,
  reflectionNote: reflection?.note ?? undefined,
})

const factKey = (fact: Pick<DayRecordFact, 'kind' | 'sourceId'>): string => `${fact.kind}:${fact.sourceId}`

const factsMatch = (left: DayRecordFact, right: DayRecordFact): boolean => JSON.stringify({
  kind: left.kind,
  sourceId: left.sourceId,
  occurredAt: left.occurredAt,
  color: left.color,
  emoji: left.emoji,
  title: left.title,
  titleEn: left.titleEn,
  description: left.description,
  intensity: left.intensity,
  secondaryEmotions: left.secondaryEmotions,
  unknownPrompt: left.unknownPrompt,
  sourceLabel: left.sourceLabel,
  reflectionLabel: left.reflectionLabel,
  reflectionNote: left.reflectionNote,
}) === JSON.stringify({
  kind: right.kind,
  sourceId: right.sourceId,
  occurredAt: right.occurredAt,
  color: right.color,
  emoji: right.emoji,
  title: right.title,
  titleEn: right.titleEn,
  description: right.description,
  intensity: right.intensity,
  secondaryEmotions: right.secondaryEmotions,
  unknownPrompt: right.unknownPrompt,
  sourceLabel: right.sourceLabel,
  reflectionLabel: right.reflectionLabel,
  reflectionNote: right.reflectionNote,
})

export const buildDayRecord = ({ localDate, checkins, actions, reflections, snapshots = [], lockedAt = null }: {
  localDate: string
  checkins: readonly CheckinRecord[]
  actions: readonly ActionRecord[]
  reflections: readonly ActionReflection[]
  snapshots?: readonly DayRecordSnapshot[]
  lockedAt?: string | null
}): DayRecord => {
  const dayCheckins = checkins.filter((record) => dayFor(record.createdAt) === localDate)
  const checkinById = new Map(checkins.map((record) => [record.id, record]))
  const currentFacts: DayRecordFact[] = [
    ...dayCheckins.map(checkinFact),
    ...actions
      .filter((action) => action.status === 'completed' && action.completedAt && dayFor(action.completedAt) === localDate)
      .map((action) => actionFact(action, checkinById.get(action.sourceCheckinId ?? '') ?? null, latestReflection(reflections, action.id))),
  ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))

  return applyDayRecordSnapshots({
    localDate,
    state: lockedAt || isDayRecordLocked(localDate) ? 'locked' : 'live',
    lockedAt,
    items: currentFacts.map((fact) => ({ ...fact, key: factKey(fact), changedAfterLock: false })),
    checkinCount: currentFacts.filter((item) => item.kind === 'checkin').length,
    completedActionCount: currentFacts.filter((item) => item.kind === 'action').length,
  }, snapshots, lockedAt)
}

export const applyDayRecordSnapshots = (record: DayRecord, snapshots: readonly DayRecordSnapshot[], lockedAt = record.lockedAt): DayRecord => {
  const currentFacts = record.items.map(({ key: _key, changedAfterLock: _changedAfterLock, sourceMissing: _sourceMissing, snapshot: _snapshot, ...fact }) => fact)
  const snapshotByKey = new Map(snapshots.map((snapshot) => [factKey({ kind: snapshot.sourceType, sourceId: snapshot.sourceId }), snapshot]))
  const hasSnapshotContext = snapshots.length > 0
  const currentKeys = new Set(currentFacts.map(factKey))
  const currentItems: DayRecordItem[] = currentFacts.map((fact) => {
    const snapshot = snapshotByKey.get(factKey(fact))
    return {
      ...fact,
      key: factKey(fact),
      changedAfterLock: Boolean(snapshot && !factsMatch(snapshot.payload, fact)) || Boolean(lockedAt && hasSnapshotContext && !snapshot),
      ...(snapshot ? { snapshot: snapshot.payload } : {}),
    }
  })
  const removedItems: DayRecordItem[] = snapshots
    .filter((snapshot) => !currentKeys.has(factKey({ kind: snapshot.sourceType, sourceId: snapshot.sourceId })))
    .map((snapshot) => ({
      ...snapshot.payload,
      key: factKey({ kind: snapshot.sourceType, sourceId: snapshot.sourceId }),
      changedAfterLock: true,
      sourceMissing: true,
      snapshot: snapshot.payload,
    }))
  const items = [...currentItems, ...removedItems].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
  return {
    ...record,
    state: lockedAt || isDayRecordLocked(record.localDate) ? 'locked' : 'live',
    lockedAt,
    items,
    checkinCount: items.filter((item) => item.kind === 'checkin').length,
    completedActionCount: items.filter((item) => item.kind === 'action').length,
  }
}

export const loadLiveDayRecord = async (localDate: string): Promise<DayRecord> => {
  const reference = await getReferenceData()
  const [checkins, actions] = await Promise.all([listCheckins(reference), listActions()])
  const completedForDay = actions.filter((action) => action.status === 'completed' && action.completedAt && dayFor(action.completedAt) === localDate)
  const reflectionResult = await listActionReflections(completedForDay.map((action) => action.id))
  return buildDayRecord({ localDate, checkins, actions, reflections: reflectionResult.reflections })
}

type SnapshotRow = {
  diary_id: string
  source_type: DayRecordSnapshot['sourceType']
  source_id: string
  occurred_at: string
  payload: DayRecordFact
  locked_at: string
}

const snapshotUnavailable = (message: string): boolean => /diary_day_record_snapshots|relation .* does not exist|schema cache/i.test(message)

export const listDayRecordSnapshots = async (diaryId: string): Promise<DayRecordSnapshot[]> => {
  const { data, error } = await supabase
    .from('diary_day_record_snapshots')
    .select('diary_id, source_type, source_id, occurred_at, payload, locked_at')
    .eq('diary_id', diaryId)
  if (error) {
    if (snapshotUnavailable(error.message)) return []
    throw error
  }
  return ((data ?? []) as SnapshotRow[]).map((row) => ({
    diaryId: row.diary_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    occurredAt: row.occurred_at,
    payload: row.payload,
    lockedAt: row.locked_at,
  }))
}

export const saveDayRecordSnapshots = async (diaryId: string, facts: readonly DayRecordFact[], lockedAt: string): Promise<void> => {
  if (!facts.length) return
  const { error } = await supabase.from('diary_day_record_snapshots').upsert(
    facts.map((fact) => ({
      diary_id: diaryId,
      source_type: fact.kind,
      source_id: fact.sourceId,
      occurred_at: fact.occurredAt,
      payload: fact,
      locked_at: lockedAt,
    })),
    { onConflict: 'diary_id,source_type,source_id' },
  )
  if (error && !snapshotUnavailable(error.message)) throw error
}
