import { describe, expect, it } from 'vitest'
import { getActionRhythm, getActionTabItems, getUpcomingGroups, isActionActiveOn } from './actionAggregation'
import type { ActionRecord } from './types'

const action = (patch: Partial<ActionRecord>): ActionRecord => ({
  id: patch.id ?? 'action',
  userId: 'user',
  title: patch.title ?? 'Một bước nhỏ',
  note: null,
  plannedDate: null,
  plannedEndDate: null,
  dueTime: null,
  status: 'pending',
  completedAt: null,
  createdAt: '2026-08-30T01:00:00.000Z',
  updatedAt: '2026-08-30T01:00:00.000Z',
  origin: 'user_created',
  sourceCheckinId: null,
  careActionId: null,
  ...patch,
})

const now = new Date('2026-08-30T03:00:00.000Z')

describe('Action Space date semantics', () => {
  const actions = [
    action({ id: 'today', plannedDate: '2026-08-30' }),
    action({ id: 'range', plannedDate: '2026-08-29', plannedEndDate: '2026-09-01' }),
    action({ id: 'tomorrow', plannedDate: '2026-08-31' }),
    action({ id: 'later', plannedDate: '2026-09-10' }),
    action({ id: 'overdue', plannedDate: '2026-08-28' }),
    action({ id: 'unscheduled' }),
    action({ id: 'done', plannedDate: '2026-08-30', status: 'completed', completedAt: '2026-08-29T03:00:00.000Z' }),
  ]

  it('keeps date ranges as one action and shows them on every active date', () => {
    expect(isActionActiveOn(actions[1], '2026-08-30')).toBe(true)
    expect(getActionTabItems(actions, 'today', now).map((item) => item.id)).toEqual(['range', 'today'])
  })

  it('separates all five workspace buckets without duplicating completed items', () => {
    expect(getActionTabItems(actions, 'upcoming', now).map((item) => item.id)).toEqual(['tomorrow', 'later'])
    expect(getActionTabItems(actions, 'overdue', now).map((item) => item.id)).toEqual(['overdue'])
    expect(getActionTabItems(actions, 'unscheduled', now).map((item) => item.id)).toEqual(['unscheduled'])
    expect(getActionTabItems(actions, 'completed', now).map((item) => item.id)).toEqual(['done'])
    expect(getUpcomingGroups(actions, now).map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ['Ngày mai', ['tomorrow']],
      ['Sau đó', ['later']],
    ])
  })

  it('calculates a gentle rolling seven-day rhythm from completion dates', () => {
    const completed = [
      action({ id: 'today-done', status: 'completed', completedAt: '2026-08-30T04:00:00.000Z' }),
      action({ id: 'yesterday-done', status: 'completed', completedAt: '2026-08-29T04:00:00.000Z' }),
    ]
    expect(getActionRhythm(completed, now)).toEqual([false, false, false, false, false, true, true])
  })
})
