import { describe, expect, it } from 'vitest'
import { addGiftDays, deriveGiftStatus, getGiftCutoffAt, getGiftDeliveryAt, getGiftLocalDate, isGiftEditable, isGiftInHistory, isGiftOnHome } from './utils'

describe('Gift for Tomorrow timing', () => {
  it('uses the product timezone for the local creation date', () => {
    expect(getGiftLocalDate(new Date('2026-08-31T16:00:00.000Z'))).toBe('2026-08-31')
    expect(getGiftLocalDate(new Date('2026-08-31T17:00:00.000Z'))).toBe('2026-09-01')
  })

  it('schedules delivery at 03:00 the following local day', () => {
    expect(addGiftDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(getGiftDeliveryAt('2026-08-31').toISOString()).toBe('2026-08-31T20:00:00.000Z')
    expect(getGiftCutoffAt('2026-08-31').toISOString()).toBe('2026-08-31T16:30:00.000Z')
  })

  it('keeps delivered gifts on Home until 23:30 of delivery day', () => {
    const gift = { status: 'delivered' as const, deliveredAt: '2026-08-31T20:00:00.000Z', deliverAt: '2026-08-31T20:00:00.000Z' }
    expect(isGiftOnHome(gift, new Date('2026-09-01T16:29:00.000Z'))).toBe(true)
    expect(isGiftOnHome(gift, new Date('2026-09-01T16:30:00.000Z'))).toBe(false)
    expect(isGiftInHistory(gift, new Date('2026-09-01T16:30:00.000Z'))).toBe(true)
  })

  it('locks sent gifts at the stored cutoff and derives delivery from deliver_at', () => {
    const gift = { status: 'sent' as const, lockedAt: '2026-08-31T16:30:00.000Z' }
    expect(isGiftEditable(gift, new Date('2026-08-31T16:29:00.000Z'))).toBe(true)
    expect(isGiftEditable(gift, new Date('2026-08-31T16:30:00.000Z'))).toBe(false)
    expect(deriveGiftStatus({ status: 'sent', deliverAt: '2026-08-31T20:00:00.000Z' }, new Date('2026-08-31T19:59:00.000Z'))).toBe('sent')
    expect(deriveGiftStatus({ status: 'sent', deliverAt: '2026-08-31T20:00:00.000Z' }, new Date('2026-08-31T20:00:00.000Z'))).toBe('delivered')
  })
})
