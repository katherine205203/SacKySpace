import { describe, expect, it } from 'vitest'
import { getJourneyCoverage, getJourneyDays, journeyDateFor, journeyDateInRange } from './journeyUtils'

describe('Journey date helpers', () => {
  it('supports arbitrary valid ranges and rejects reversed ranges', () => {
    expect(getJourneyDays('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(getJourneyDays('2026-09-03', '2026-09-01')).toEqual([])
    expect(getJourneyDays('2026-01-01', '2027-12-31')).toHaveLength(730)
  })

  it('normalizes timestamps to the diary timezone before comparing dates', () => {
    expect(journeyDateFor('2026-09-02T17:30:00.000Z')).toBe('2026-09-03')
    expect(journeyDateInRange('2026-09-03', '2026-09-01', '2026-09-03')).toBe(true)
    expect(journeyDateInRange('2026-09-04', '2026-09-01', '2026-09-03')).toBe(false)
  })

  it('summarizes an empty range without inventing records', () => {
    expect(getJourneyCoverage('2026-09-01', '2026-09-03', [], [], [])).toEqual({
      dayCount: 3,
      dailyDiaryCount: 0,
      checkinCount: 0,
      completedActionCount: 0,
    })
  })
})
