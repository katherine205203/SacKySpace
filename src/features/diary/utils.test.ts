import { describe, expect, it } from 'vitest'
import { getDiaryCalendarStatus, getDiaryMetrics, isDiaryBackfilledDate, shouldSystemCompleteDiary, systemCompleteDiary } from './utils'
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
  completionSource: status === 'done' ? 'user' : null,
  isBackfilled: false,
})

describe('Diary metrics', () => {
  it('counts only Done entries for streaks and monthly completion', () => {
    const entries = [entry('2026-08-30', 'done'), entry('2026-08-29', 'done'), entry('2026-08-28', 'draft'), entry('2026-08-10', 'done')]
    expect(getDiaryMetrics(entries, new Date('2026-08-30T04:00:00.000Z'))).toMatchObject({ currentStreak: 2, longestStreak: 2, doneCount: 3, draftCount: 1 })
  })
})

describe('Diary lifecycle and calendar status', () => {
  const today = '2026-09-17'

  it('keeps a draft for today', () => {
    const draft = entry(today, 'draft')
    expect(shouldSystemCompleteDiary(draft, today)).toBe(false)
    expect(getDiaryCalendarStatus(draft)).toBe('draft')
  })

  it('system-completes a normal draft once its day has ended', () => {
    const draft = entry('2026-09-16', 'draft')
    expect(shouldSystemCompleteDiary(draft, today)).toBe(true)
    expect(systemCompleteDiary(draft, '2026-09-17T00:00:00.000Z')).toMatchObject({ status: 'done', completionSource: 'system', completedAt: '2026-09-17T00:00:00.000Z' })
  })

  it('marks an old date as a backfill candidate while keeping its initial status draft', () => {
    expect(isDiaryBackfilledDate('2026-09-16', new Date('2026-09-17T02:00:00.000Z'))).toBe(true)
    const backfilledDraft = { ...entry('2026-09-16', 'draft'), isBackfilled: true }
    expect(backfilledDraft.status).toBe('draft')
    expect(shouldSystemCompleteDiary(backfilledDraft, today)).toBe(false)
  })

  it('renders no dot for an empty date and the correct color state for draft and done', () => {
    expect(getDiaryCalendarStatus(null)).toBe('empty')
    expect(getDiaryCalendarStatus(entry('2026-09-16', 'draft'))).toBe('draft')
    expect(getDiaryCalendarStatus(entry('2026-09-15', 'done'))).toBe('done')
  })
})
