import { describe, expect, it } from 'vitest'
import { getCheckinErrorMessage } from './errors'

describe('getCheckinErrorMessage', () => {
  it('reads Supabase plain-object errors instead of hiding them behind the fallback', () => {
    expect(getCheckinErrorMessage({ message: 'A check-in can have at most 2 secondary emotions' })).toContain('database chưa đồng bộ')
  })

  it('maps duplicate errors to a retry-safe message', () => {
    expect(getCheckinErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint' })).toContain('lưu trùng')
  })

  it('keeps actionable unknown errors', () => {
    expect(getCheckinErrorMessage({ message: 'new row violates row-level security policy' })).toBe('new row violates row-level security policy')
  })

  it('does not mislabel an edit conflict-target error as a secondary-emotion limit', () => {
    const message = 'there is no unique or exclusion constraint matching the ON CONFLICT specification for table checkin_secondary_emotions'
    expect(getCheckinErrorMessage({ code: '42P10', message })).toBe(message)
  })

  it('translates the linked-action limit into an actionable message', () => {
    expect(getCheckinErrorMessage({ message: 'A check-in has reached its active action limit' })).toBe('Check-in này đã có tối đa 2 Action đang hoạt động.')
  })
})
