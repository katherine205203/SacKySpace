import { describe, expect, it } from 'vitest'
import { getDiaryMetrics } from './utils'
import type { DiaryEntry } from './types'

const entry = (localDate: string, status: DiaryEntry['status']): DiaryEntry => ({
  id: localDate,
  userId: 'user-1',
  localDate,
  status,
  title: 'Một ngày',
  overallText: 'Một vài dòng',
  dailyEmotionId: null,
  dailyEmotionSnapshot: null,
  promptResponses: [],
  checkinLinks: [],
  images: [],
  createdAt: `${localDate}T03:00:00.000Z`,
  updatedAt: `${localDate}T03:00:00.000Z`,
  completedAt: status === 'done' ? `${localDate}T03:00:00.000Z` : null,
})

describe('Diary metrics', () => {
  it('counts only Done entries for streaks and monthly completion', () => {
    const entries = [entry('2026-08-30', 'done'), entry('2026-08-29', 'done'), entry('2026-08-28', 'draft'), entry('2026-08-10', 'done')]
    expect(getDiaryMetrics(entries, new Date('2026-08-30T04:00:00.000Z'))).toMatchObject({ currentStreak: 2, longestStreak: 2, doneCount: 3, draftCount: 1 })
  })
})
