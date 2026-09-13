import { describe, expect, it } from 'vitest'
import { buildDayRecord, isDayRecordLocked } from './dayRecord'
import type { ActionRecord } from '../../actionspace/types'
import type { CheckinRecord } from '../../checkin/types'
import type { DayRecordSnapshot } from '../types'
import { serializeRichText } from '../../../components/richText'

const emotionCheckin = (id: string, createdAt: string, note = 'Một ghi chú', updatedAt = createdAt): CheckinRecord => ({
  id,
  userId: 'user',
  checkinType: 'emotion',
  primaryEmotionId: 'calm',
  primaryEmotion: { emotion_id: 'calm', emotion_family_id: 'rest', emotion_name_vn: 'Bình yên', emotion_name_en: 'Calm', emoji: '🌿', color_hex: '#52B788', description_vn: '', description_en: '', active: true, sort_order: 1 },
  intensity: 4,
  note,
  unknownPromptId: null,
  unknownPrompt: null,
  secondaryEmotions: [{ emotion_id: 'curious', emotion_family_id: 'thought', emotion_name_vn: 'Bối rối', emotion_name_en: 'Confused', emoji: '🌀', color_hex: '#8B5CF6', description_vn: '', description_en: '', active: true, sort_order: 1 }],
  needs: [],
  contexts: [],
  actions: [],
  occurredAt: createdAt,
  createdAt,
  updatedAt,
})

const unknownCheckin = (id: string, createdAt: string): CheckinRecord => ({
  ...emotionCheckin(id, createdAt),
  checkinType: 'unknown',
  primaryEmotionId: null,
  primaryEmotion: null,
  intensity: null,
  unknownPromptId: 'unknown',
  unknownPrompt: { prompt_id: 'unknown', emoji: '◌', prompt_text_vn: 'Mình chưa gọi tên được điều này.', active: true, sort_order: 1 },
})

const action = (id: string, completedAt: string | null, sourceCheckinId: string | null = null): ActionRecord => ({
  id,
  userId: 'user',
  title: 'Đi bộ 10 phút',
  note: 'Ra ngoài một chút',
  plannedDate: '2026-09-02',
  plannedEndDate: null,
  dueTime: null,
  status: completedAt ? 'completed' : 'pending',
  completedAt,
  createdAt: '2026-09-02T01:00:00.000Z',
  updatedAt: completedAt ?? '2026-09-02T01:00:00.000Z',
  origin: sourceCheckinId ? 'checkin' : 'user_created',
  sourceCheckinId,
  careActionId: null,
})

const snapshotsFor = (diaryId: string, record: ReturnType<typeof buildDayRecord>, lockedAt: string): DayRecordSnapshot[] => record.items.map(({ key: _key, changedAfterLock: _changedAfterLock, sourceMissing: _sourceMissing, snapshot: _snapshot, ...payload }) => ({ diaryId, sourceType: payload.kind, sourceId: payload.sourceId, occurredAt: payload.occurredAt, payload, lockedAt }))

describe('Day Record', () => {
  it('includes all factual check-ins and only actions completed on the local day', () => {
    const checkins = [emotionCheckin('checkin-1', '2026-09-02T01:15:00.000Z'), unknownCheckin('checkin-2', '2026-09-02T09:30:00.000Z')]
    const record = buildDayRecord({
      localDate: '2026-09-02',
      checkins,
      actions: [action('done-today', '2026-09-02T13:20:00.000Z', 'checkin-1'), action('pending', null), action('done-other-day', '2026-09-03T01:20:00.000Z')],
      reflections: [{ id: 'reflection-1', actionId: 'done-today', completionCycleId: 'cycle-1', outcomeId: 'better', outcomeSnapshot: 'Ổn hơn', note: 'Dễ thở hơn.', createdAt: '2026-09-02T13:21:00.000Z' }],
    })
    expect(record).toMatchObject({ checkinCount: 2, completedActionCount: 1 })
    expect(record.items.map((item) => item.kind)).toEqual(['checkin', 'checkin', 'action'])
    expect(record.items.at(-1)).toMatchObject({ sourceLabel: 'Từ Check-in Bình yên', reflectionLabel: 'Ổn hơn', reflectionNote: 'Dễ thở hơn.' })
    expect(record.items[1]).toMatchObject({ unknownPrompt: 'Mình chưa gọi tên được điều này.' })
  })

  it('keeps rich-text check-in notes for the Day Record renderer', () => {
    const note = serializeRichText({
      type: 'doc',
      version: 1,
      lineSpacing: 'normal',
      paragraphSpacing: 'normal',
      blocks: [
        { type: 'paragraph', children: [{ text: 'Buổi sáng mình đã đi chơi.' }] },
        { type: 'paragraph', children: [{ text: 'Mình thấy nhẹ lòng hơn.' }] },
      ],
    })
    const record = buildDayRecord({
      localDate: '2026-09-02',
      checkins: [emotionCheckin('checkin-rich-text', '2026-09-02T01:15:00.000Z', note)],
      actions: [],
      reflections: [],
    })
    expect(record.items[0].description).toBe(note)
  })

  it('keeps the locked fact and flags a current source changed after the day ended', () => {
    const lockedAt = '2026-09-03T00:00:00.000Z'
    const initial = buildDayRecord({ localDate: '2026-09-02', checkins: [emotionCheckin('checkin-1', '2026-09-02T01:15:00.000Z')], actions: [], reflections: [] })
    const record = buildDayRecord({
      localDate: '2026-09-02',
      checkins: [emotionCheckin('checkin-1', '2026-09-02T01:15:00.000Z', 'Nội dung đã sửa', '2026-09-04T01:00:00.000Z')],
      actions: [],
      reflections: [],
      snapshots: snapshotsFor('diary-1', initial, lockedAt),
      lockedAt,
    })
    expect(record.items[0]).toMatchObject({ changedAfterLock: true, description: 'Nội dung đã sửa', snapshot: { description: 'Một ghi chú' } })
  })

  it('retains a snapshot when the current source has been removed', () => {
    const lockedAt = '2026-09-03T00:00:00.000Z'
    const initial = buildDayRecord({ localDate: '2026-09-02', checkins: [emotionCheckin('checkin-1', '2026-09-02T01:15:00.000Z')], actions: [], reflections: [] })
    const record = buildDayRecord({ localDate: '2026-09-02', checkins: [], actions: [], reflections: [], snapshots: snapshotsFor('diary-1', initial, lockedAt), lockedAt })
    expect(record.items[0]).toMatchObject({ sourceMissing: true, changedAfterLock: true, title: 'Check-in · Bình yên' })
  })

  it('locks only once the local calendar day has passed', () => {
    expect(isDayRecordLocked('2026-09-02', new Date('2026-09-02T16:00:00.000Z'))).toBe(false)
    expect(isDayRecordLocked('2026-09-02', new Date('2026-09-02T18:00:00.000Z'))).toBe(true)
  })
})
