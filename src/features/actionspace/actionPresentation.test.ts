import { describe, expect, it } from 'vitest'
import { ACTION_INDEPENDENT_COLOR, getActionAccentColor } from './actionPresentation'
import type { ActionRecord } from './types'
import type { CheckinRecord } from '../checkin/types'

const action = (sourceCheckinId: string | null): ActionRecord => ({
  id: 'action-1',
  userId: 'user-1',
  title: 'Một bước nhỏ',
  note: null,
  plannedDate: null,
  plannedEndDate: null,
  dueTime: null,
  status: 'pending',
  completedAt: null,
  createdAt: '2026-08-30T01:00:00.000Z',
  updatedAt: '2026-08-30T01:00:00.000Z',
  origin: 'user_created',
  sourceCheckinId,
  careActionId: null,
})

const checkin = (id: string, color: string): CheckinRecord => ({
  id,
  userId: 'user-1',
  checkinType: 'emotion',
  primaryEmotionId: 'emotion-1',
  primaryEmotion: { color_hex: color } as CheckinRecord['primaryEmotion'],
  intensity: 3,
  note: null,
  unknownPromptId: null,
  unknownPrompt: null,
  secondaryEmotions: [],
  needs: [],
  contexts: [],
  actions: [],
  createdAt: '2026-08-30T01:00:00.000Z',
  updatedAt: '2026-08-30T01:00:00.000Z',
})

describe('Action visual source semantics', () => {
  it('uses the linked Check-in pigment for the Action rail', () => {
    expect(getActionAccentColor(action('checkin-1'), [checkin('checkin-1', '#ff7a66')])).toBe('#ff7a66')
  })

  it('uses a neutral Action Space accent for an independent Action', () => {
    expect(getActionAccentColor(action(null), [])).toBe(ACTION_INDEPENDENT_COLOR)
  })
})
