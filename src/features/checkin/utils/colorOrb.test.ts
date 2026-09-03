import { describe, expect, it } from 'vitest'
import { buildColorOrbRegionsFromColors, colorDistance, getColorOrbLegend, intensityToPresenceWeight } from './colorOrb'

describe('Color Orb regions', () => {
  it('maps stored intensity to the non-linear presence weights', () => {
    expect([1, 2, 3, 4, 5].map(intensityToPresenceWeight)).toEqual([1, 1.35, 1.8, 2.4, 3.2])
  })

  it('aggregates presence weights and produces deterministic organic regions', () => {
    const entries = [{ color: '#ff0000', intensity: 5 }, { color: '#00ff00', intensity: 1 }, { color: '#FF0000', intensity: 2 }]
    const first = buildColorOrbRegionsFromColors(entries)
    const second = buildColorOrbRegionsFromColors(entries)
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first.reduce((sum, region) => sum + region.weight, 0)).toBeCloseTo(5.55)
    expect(first[0].percentage).toBeCloseTo((4.55 / 5.55) * 100)
    expect(first.at(-1)?.end).toBe(1)
    expect(first.every((region) => region.path.includes('Q'))).toBe(true)
  })

  it('keeps separate emotion territories even when their colors match', () => {
    const regions = buildColorOrbRegionsFromColors([
      { color: '#743CFF', intensity: 5, emotionId: 'interest', label: 'Hứng thú' },
      { color: '#743CFF', intensity: 3, emotionId: 'curiosity', label: 'Tò mò' },
    ])
    expect(regions).toHaveLength(2)
    expect(regions.map((region) => region.label)).toEqual(['Hứng thú', 'Tò mò'])
    expect(regions.reduce((sum, region) => sum + region.percentage, 0)).toBeCloseTo(100)
  })

  it('uses perceptual color distance for affinity and exposes dominant legend entries', () => {
    expect(colorDistance('#743CFF', '#743CFF')).toBe(0)
    const legend = getColorOrbLegend([
      { color: '#FF9F1C', intensity: 5, emotionId: 'joy', label: 'Hân hoan', emoji: '☀️' },
      { color: '#52B788', intensity: 2, emotionId: 'calm', label: 'Bình yên', emoji: '🌿' },
      { color: '#EF476F', intensity: 1, emotionId: 'love', label: 'Yêu thương', emoji: '💗' },
      { color: '#118AB2', intensity: 1, emotionId: 'curious', label: 'Tò mò', emoji: '🔎' },
    ])
    expect(legend).toHaveLength(3)
    expect(legend[0]).toMatchObject({ label: 'Hân hoan', percentage: 49, emoji: '☀️' })
  })
})
