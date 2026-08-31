import { describe, expect, it } from 'vitest'
import { getCurrentStreak, getHomeActionItems, getHomeActionSummary, getHomeOrbEntries, getRecentJourneyCheckins } from './homeAggregation'
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

  it('counts Unknown Check-ins for streaks but excludes them from Orb color', () => {
    const records = [
      record('2026-08-29T03:00:00.000Z'),
      record('2026-08-28T03:00:00.000Z', 'unknown'),
    ]
    expect(getCurrentStreak(records, now)).toBe(2)
    expect(getHomeOrbEntries(records)).toEqual([{ color: '#FF6B8A', intensity: 3 }])
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
