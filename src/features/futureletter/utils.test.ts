import { describe, expect, it } from 'vitest'
import type { CheckinRecord } from '../checkin/types'
import type { ActionRecord } from '../actionspace/types'
import type { FutureLetterRuleGroup } from './types'
import { compareValues, evaluateTriggerGroups, getCompletedActionCount, getEmotionChainEvidence, isHomeAvailable, isTriggerTypeLatched, selectRandomPoolLetter, TRIGGER_OPTIONS } from './utils'

const checkin = (date: string, primaryEmotionId = 'calm', secondaryEmotionIds: string[] = []): CheckinRecord => ({
  id: date,
  userId: 'user',
  checkinType: 'emotion',
  primaryEmotionId,
  primaryEmotion: { emotion_id: primaryEmotionId, emotion_family_id: 'family', emotion_name_vn: primaryEmotionId, emotion_name_en: primaryEmotionId, emoji: '◉', color_hex: '#743cff', description_vn: '', description_en: '', active: true, sort_order: 1 },
  intensity: 3,
  note: null,
  unknownPromptId: null,
  unknownPrompt: null,
  secondaryEmotions: secondaryEmotionIds.map((emotionId) => ({ emotion_id: emotionId, emotion_family_id: 'family', emotion_name_vn: emotionId, emotion_name_en: emotionId, emoji: '◌', color_hex: '#743cff', description_vn: '', description_en: '', active: true, sort_order: 1 })),
  needs: [],
  contexts: [],
  actions: [],
  occurredAt: `${date}T08:00:00+07:00`,
  createdAt: `${date}T08:00:00+07:00`,
  updatedAt: `${date}T08:00:00+07:00`,
})

const action = (date: string): ActionRecord => ({ id: date, userId: 'user', title: 'Action', note: null, plannedDate: date, plannedEndDate: null, dueTime: null, status: 'completed', completedAt: `${date}T08:00:00+07:00`, createdAt: `${date}T08:00:00+07:00`, updatedAt: `${date}T08:00:00+07:00`, origin: 'action-space', sourceCheckinId: null, careActionId: null })

describe('FutureMe trigger semantics', () => {
  it('supports every comparator', () => {
    expect(compareValues(5, '>', 4)).toBe(true)
    expect(compareValues(5, '>=', 5)).toBe(true)
    expect(compareValues(5, '=', 5)).toBe(true)
    expect(compareValues(5, '<=', 5)).toBe(true)
    expect(compareValues(5, '<', 6)).toBe(true)
  })

  it('uses a non-rolling 30-day emotion chain and starts a new chain after expiry', () => {
    const records = [checkin('2026-01-01'), checkin('2026-01-12'), checkin('2026-02-05')]
    expect(getEmotionChainEvidence(records, 'calm', 'primary', '2026-01-20')).toEqual({ count: 2, windowStart: '2026-01-01', windowEnd: '2026-01-30' })
    expect(getEmotionChainEvidence(records, 'calm', 'primary', '2026-02-10')).toEqual({ count: 1, windowStart: '2026-02-05', windowEnd: '2026-03-06' })
  })

  it('respects Primary-only versus Primary + Secondary emotion scope', () => {
    const records = [checkin('2026-01-04', 'calm', ['restless'])]
    expect(getEmotionChainEvidence(records, 'restless', 'primary', '2026-01-04').count).toBe(0)
    expect(getEmotionChainEvidence(records, 'restless', 'primary_secondary', '2026-01-04').count).toBe(1)
  })

  it('evaluates AND inside a group and OR across groups', () => {
    const groups: FutureLetterRuleGroup[] = [
      { id: 'one', operator: 'AND', position: 1, rules: [
        { id: 'a', groupId: 'one', type: 'checkin_streak', comparator: '>=', threshold: 2, config: {}, position: 1 },
        { id: 'b', groupId: 'one', type: 'diary_streak', comparator: '>=', threshold: 1, config: {}, position: 2 },
      ] },
      { id: 'two', operator: 'OR', position: 2, rules: [{ id: 'c', groupId: 'two', type: 'specific_date', comparator: null, threshold: null, config: { date: '2026-01-01' }, position: 1 }] },
    ]
    expect(evaluateTriggerGroups(groups, 'OR', { today: '2026-01-04', checkins: [checkin('2026-01-03'), checkin('2026-01-04')], diaryEntries: [], actions: [] })).toBe(true)
  })

  it('counts completed Actions for lifetime and bounded windows', () => {
    const actions = [action('2026-07-01'), action('2026-08-25'), action('2026-08-30')]
    expect(getCompletedActionCount(actions, '2026-08-31', 'all_time')).toBe(3)
    expect(getCompletedActionCount(actions, '2026-08-31', 'last_7_days')).toBe(2)
    expect(getCompletedActionCount(actions, '2026-08-31', 'last_30_days')).toBe(2)
  })

  it('rolls at most one letter for the whole pool and no roll when chance misses', () => {
    const pool = [{ id: 'a', openedCount: 0 }, { id: 'b', openedCount: 4 }]
    expect(selectRandomPoolLetter(pool, 0.31, 0)).toBeNull()
    expect(selectRandomPoolLetter([], 0, 0)).toBeNull()
    expect(selectRandomPoolLetter(pool, 0.1, 0)).toEqual(pool[0])
  })

  it('keeps available-unopened carry-over and excludes archived letters from Home', () => {
    expect(isHomeAvailable({ state: 'available_unopened', lastOpenedAt: null }, '2026-08-31')).toBe(true)
    expect(isHomeAvailable({ state: 'archived', lastOpenedAt: null }, '2026-08-31')).toBe(false)
    expect(isHomeAvailable({ state: 'opened', lastOpenedAt: '2026-08-31T10:00:00+07:00' }, '2026-08-31')).toBe(true)
    expect(isHomeAvailable({ state: 'opened', lastOpenedAt: '2026-08-30T10:00:00+07:00' }, '2026-08-31')).toBe(false)
  })

  it('latches a conditional trigger after its first evidence event', () => {
    expect(isTriggerTypeLatched([{ triggerType: 'diary_streak' }], 'diary_streak')).toBe(true)
    expect(isTriggerTypeLatched([{ triggerType: 'diary_streak' }], 'checkin_streak')).toBe(false)
  })

  it('keeps trigger choices in user language', () => {
    const copy = TRIGGER_OPTIONS.map((option) => `${option.label} ${option.description}`).join(' ')
    expect(copy).not.toMatch(/latch|pool|snapshot|immutable|comparator|condition group/i)
    expect(copy).toContain('Một ngày bất chợt')
  })
})
