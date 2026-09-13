import { describe, expect, it } from 'vitest'
import { formatCheckinDateShort, formatCheckinTime, getCurrentStreak, getHomeActionItems, getHomeActionSummary, getHomeOrbEntries, getRecentJourneyCheckins } from './homeAggregation'
import type { CheckinRecord } from '../../checkin/types'
import type { HomeReminder } from '../types'

const record = (createdAt: string, checkinType: 'emotion' | 'unknown' = 'emotion'): CheckinRecord => ({
  id: createdAt,
  userId: 'user',
  checkinType,
  primaryEmotionId: checkinType === 'emotion' ? 'emotion' : null,
  primaryEmotion: checkinType === 'emotion' ? { color_hex: '#FF6B8A' } as CheckinRecord['primaryEmotion'] : null,
  intensity: checkinType === 'emotion' ? 3 : null,
  note: null,
  unknownPromptId: checkinType === 'unknown' ? 'prompt' : null,
  unknownPrompt: checkinType === 'unknown' ? { emoji: '🌫️' } as CheckinRecord['unknownPrompt'] : null,
  secondaryEmotions: [],
  needs: [],
  contexts: [],
  actions: [],
  occurredAt: createdAt,
  createdAt,
  updatedAt: createdAt,
})

describe('Home aggregation', () => {
  const now = new Date('2026-08-29T04:00:00.000Z')

  it('returns every Check-in in the latest three local calendar days, newest first', () => {
    const records = [
      record('2026-08-29T03:00:00.000Z'),
      record('2026-08-29T02:00:00.000Z'),
      record('2026-08-29T01:00:00.000Z'),
      record('2026-08-28T03:00:00.000Z'),
      record('2026-08-28T02:00:00.000Z'),
      record('2026-08-27T03:00:00.000Z'),
      record('2026-08-26T03:00:00.000Z'),
    ]
    const journey = getRecentJourneyCheckins(records, now)
    expect(journey).toHaveLength(6)
    expect(journey.map((item) => item.createdAt)).toEqual(records.slice(0, 6).map((item) => item.createdAt))
  })

  it('formats the Home journey timestamp as a compact local date and time pair', () => {
    const createdAt = '2026-08-29T23:02:00.000Z'
    expect(formatCheckinDateShort(createdAt)).toBe('30/08/26')
    expect(formatCheckinTime(createdAt)).toBe('06:02')
  })

  it('counts Unknown Check-ins for streaks but excludes them from Orb color', () => {
    const records = [
      record('2026-08-29T03:00:00.000Z'),
      record('2026-08-28T03:00:00.000Z', 'unknown'),
    ]
    expect(getCurrentStreak(records, now)).toBe(2)
    expect(getHomeOrbEntries(records)).toEqual([{ color: '#FF6B8A', intensity: 3, presenceWeight: 1.8 }])
  })

  it('splits one emotion check-in across primary and secondary presence without adding weight', () => {
    const emotion = (id: string, name: string, color: string) => ({ emotion_id: id, emotion_name_vn: name, emotion_name_en: name, emoji: '◉', color_hex: color })
    const richRecord = {
      ...record('2026-08-29T03:00:00.000Z'),
      intensity: 5,
      primaryEmotion: emotion('interest', 'Hứng thú', '#FF9F1C') as CheckinRecord['primaryEmotion'],
      secondaryEmotions: [
        emotion('calm', 'Bình yên', '#52B788') as NonNullable<CheckinRecord['primaryEmotion']>,
        emotion('curious', 'Tò mò', '#118AB2') as NonNullable<CheckinRecord['primaryEmotion']>,
      ],
    }
    const entries = getHomeOrbEntries([richRecord])
    expect(entries[0].presenceWeight).toBeCloseTo(2.24)
    expect(entries.slice(1).map((entry) => entry.presenceWeight)).toEqual([.48, .48])
    expect(entries.reduce((sum, entry) => sum + (entry.presenceWeight ?? 0), 0)).toBeCloseTo(3.2)
  })

  it('splits three secondary emotions into equal 10% shares', () => {
    const emotion = (id: string, color: string) => ({ emotion_id: id, emotion_name_vn: id, emotion_name_en: id, emoji: '◉', color_hex: color })
    const entries = getHomeOrbEntries([{
      ...record('2026-08-29T03:00:00.000Z'),
      intensity: 5,
      primaryEmotion: emotion('primary', '#FF9F1C') as CheckinRecord['primaryEmotion'],
      secondaryEmotions: [
        emotion('secondary-a', '#52B788') as NonNullable<CheckinRecord['primaryEmotion']>,
        emotion('secondary-b', '#118AB2') as NonNullable<CheckinRecord['primaryEmotion']>,
        emotion('secondary-c', '#EF476F') as NonNullable<CheckinRecord['primaryEmotion']>,
      ],
    }])
    expect(entries[0].presenceWeight).toBeCloseTo(2.24)
    entries.slice(1).forEach((entry) => expect(entry.presenceWeight).toBeCloseTo(0.32))
    expect(entries.reduce((sum, entry) => sum + (entry.presenceWeight ?? 0), 0)).toBeCloseTo(3.2)
  })

  it('keeps completed actions out of Home while counting them for Hero metrics', () => {
    const reminders: HomeReminder[] = [
      { id: 'today-pending', sourceCheckinId: null, title: 'Pending', note: null, plannedDate: '2026-08-29', dueTime: null, status: 'pending', completedAt: null, origin: 'manual' },
      { id: 'today-done', sourceCheckinId: null, title: 'Done', note: null, plannedDate: '2026-08-29', dueTime: null, status: 'completed', completedAt: '2026-08-29T02:00:00.000Z', origin: 'manual' },
      { id: 'tomorrow-done', sourceCheckinId: null, title: 'Tomorrow', note: null, plannedDate: '2026-08-30', dueTime: null, status: 'completed', completedAt: '2026-08-29T02:00:00.000Z', origin: 'manual' },
    ]
    expect(getHomeActionItems(reminders, 'today', now)).toHaveLength(1)
    expect(getHomeActionItems(reminders, 'today', now).map((item) => item.id)).toEqual(['today-pending'])
    expect(getHomeActionSummary(reminders, now)).toEqual({ total: 2, completed: 1, remaining: 1 })
    expect(getHomeActionSummary(reminders, now, 'week')).toEqual({ total: 3, completed: 2, remaining: 1 })
  })

  it('keeps unscheduled actions out of Today and Home metrics', () => {
    const reminders: HomeReminder[] = [
      { id: 'unscheduled', sourceCheckinId: null, title: 'Unscheduled', note: null, plannedDate: null, dueTime: null, status: 'pending', completedAt: null, origin: 'manual' },
      { id: 'today', sourceCheckinId: null, title: 'Today', note: null, plannedDate: '2026-08-29', dueTime: null, status: 'pending', completedAt: null, origin: 'manual' },
    ]
    expect(getHomeActionItems(reminders, 'today', now).map((item) => item.id)).toEqual(['today'])
    expect(getHomeActionItems(reminders, 'unscheduled', now).map((item) => item.id)).toEqual(['unscheduled'])
    expect(getHomeActionSummary(reminders, now)).toEqual({ total: 1, completed: 0, remaining: 1 })
  })

  it('returns every active Home action so the preview can scroll after the third row', () => {
    const reminders: HomeReminder[] = Array.from({ length: 8 }, (_, index) => ({
      id: `action-${index + 1}`,
      sourceCheckinId: null,
      title: `Action ${index + 1}`,
      note: null,
      plannedDate: '2026-08-29',
      dueTime: null,
      status: 'pending',
      completedAt: null,
      origin: 'manual',
    }))

    expect(getHomeActionItems(reminders, 'today', now)).toHaveLength(8)
    expect(getHomeActionItems(reminders, 'today', now).map((item) => item.id)).toContain('action-8')
  })

  it('keeps a dated range active across Home today and uses its end for overdue', () => {
    const reminders: HomeReminder[] = [
      { id: 'range', sourceCheckinId: null, title: 'Range', note: null, plannedDate: '2026-08-28', plannedEndDate: '2026-08-31', dueTime: null, status: 'pending', completedAt: null, origin: 'manual' },
      { id: 'old-range', sourceCheckinId: null, title: 'Old range', note: null, plannedDate: '2026-08-20', plannedEndDate: '2026-08-27', dueTime: null, status: 'pending', completedAt: null, origin: 'manual' },
    ]

    expect(getHomeActionItems(reminders, 'today', now).map((item) => item.id)).toEqual(['range'])
    expect(getHomeActionItems(reminders, 'overdue', now).map((item) => item.id)).toEqual(['old-range'])
  })
})
