import { describe, expect, it } from 'vitest'
import { getHistoryDateRange } from './history'

describe('history date ranges', () => {
  const now = new Date('2026-08-27T04:00:00.000Z')

  it('uses the user timezone for today', () => {
    expect(getHistoryDateRange('today', now, undefined, 'Asia/Ho_Chi_Minh')).toEqual({ start: '2026-08-27', end: '2026-08-27' })
  })

  it('returns a Monday-to-Sunday week', () => {
    expect(getHistoryDateRange('week', now, undefined, 'Asia/Ho_Chi_Minh')).toEqual({ start: '2026-08-24', end: '2026-08-30' })
  })
})
