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

  it('keeps action preview bounded while counting all of today for Hero metrics', () => {
    const reminders: HomeReminder[] = [
      { id: 'today-pending', sourceCheckinId: null, title: 'Pending', note: null, plannedDate: '2026-08-29', dueTime: null, status: 'pending', completedAt: null, origin: 'manual' },
      { id: 'today-done', sourceCheckinId: null, title: 'Done', note: null, plannedDate: '2026-08-29', dueTime: null, status: 'completed', completedAt: '2026-08-29T02:00:00.000Z', origin: 'manual' },
      { id: 'tomorrow-done', sourceCheckinId: null, title: 'Tomorrow', note: null, plannedDate: '2026-08-30', dueTime: null, status: 'completed', completedAt: '2026-08-29T02:00:00.000Z', origin: 'manual' },
    ]
    expect(getHomeActionItems(reminders, 'today', now)).toHaveLength(2)
    expect(getHomeActionSummary(reminders, now)).toEqual({ total: 2, completed: 1, remaining: 1 })
    expect(getHomeActionSummary(reminders, now, 'week')).toEqual({ total: 3, completed: 2, remaining: 1 })
  })
})
