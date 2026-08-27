import { describe, expect, it } from 'vitest'
import { buildColorOrbRegionsFromColors } from './colorOrb'

describe('Color Orb regions', () => {
  it('aggregates weights and produces deterministic regions', () => {
    const entries = [{ color: '#ff0000', intensity: 2 }, { color: '#00ff00', intensity: 1 }, { color: '#FF0000', intensity: 1 }]
    const first = buildColorOrbRegionsFromColors(entries)
    const second = buildColorOrbRegionsFromColors(entries)
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first.reduce((sum, region) => sum + region.weight, 0)).toBe(4)
    expect(first.at(-1)?.end).toBe(1)
  })
})
