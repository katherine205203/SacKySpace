import { describe, expect, it } from 'vitest'
import { UI_CONTENT_DEFAULTS, uiContentDefaultText } from './uiContentRegistry'

describe('ui content registry', () => {
  it('keeps required Vietnamese defaults for seeded app surfaces', () => {
    expect(Object.keys(UI_CONTENT_DEFAULTS).length).toBeGreaterThan(30)
    expect(uiContentDefaultText('home.landing.orb_title')).toBe('Khoảng màu hiện tại')
    expect(uiContentDefaultText('home.landing.checkin_cta')).toBe('Check-in ngay')
  })

  it('uses a safe fallback for an unknown key', () => {
    expect(uiContentDefaultText('missing.key', 'Fallback copy')).toBe('Fallback copy')
  })
})
