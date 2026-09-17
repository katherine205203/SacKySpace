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
})
