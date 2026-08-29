import { describe, expect, it } from 'vitest'
import { buildColorOrbRegionsFromColors, buildOrbClouds } from './colorOrb'

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

  it('keeps a readable low-blur core while layering a soft color aura', () => {
    const clouds = buildOrbClouds([{ color: '#FF9F1C', intensity: 5 }])
    expect(clouds).toHaveLength(6)
    expect(clouds.some((cloud) => cloud.blur < 3 && cloud.opacity > .7)).toBe(true)
    expect(clouds.some((cloud) => cloud.blendMode === 'screen')).toBe(true)
  })

  it('preserves distinct color sources in a multi-color orb', () => {
    const clouds = buildOrbClouds([
      { color: '#FF9F1C', intensity: 3 },
      { color: '#52B788', intensity: 2 },
    ])
    expect(clouds.filter((cloud) => cloud.color === '#FF9F1C')).toHaveLength(2)
    expect(clouds.filter((cloud) => cloud.color === '#52B788')).toHaveLength(2)
  })
})
