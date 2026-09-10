import { describe, expect, it } from 'vitest'
import { buildColorHaloRing, buildColorOrbField, buildColorOrbRegionsFromColors, colorDistance, getColorOrbLegend, intensityToPresenceWeight, ORB_RADIUS, ORB_VIEW_SIZE, readableColorOrbEntries, sampleColorOrbField, simplifyColorOrbEntries } from './colorOrb'

describe('Color Orb regions', () => {
  it('maps stored intensity to the non-linear presence weights', () => {
    expect([1, 2, 3, 4, 5].map(intensityToPresenceWeight)).toEqual([1, 1.35, 1.8, 2.4, 3.2])
  })

  it('aggregates presence weights and produces deterministic field metadata', () => {
    const entries = [{ color: '#ff0000', intensity: 5 }, { color: '#00ff00', intensity: 1 }, { color: '#FF0000', intensity: 2 }]
    const first = buildColorOrbRegionsFromColors(entries)
    const second = buildColorOrbRegionsFromColors(entries)
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first.reduce((sum, region) => sum + region.weight, 0)).toBeCloseTo(5.55)
    expect(first[0].percentage).toBeCloseTo((4.55 / 5.55) * 100)
    expect(first.at(-1)?.end).toBe(1)
    expect(first.every((region) => Number.isFinite(region.seedX) && Number.isFinite(region.labelX))).toBe(true)
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

  it('keeps the canvas field continuous and lets a dominant weight own more area', () => {
    const field = buildColorOrbField([
      { color: '#FF9F1C', intensity: 1, presenceWeight: 40, emotionId: 'dominant' },
      { color: '#52B788', intensity: 1, presenceWeight: 9, emotionId: 'small' },
      { color: '#118AB2', intensity: 1, presenceWeight: 7, emotionId: 'other' },
    ])
    const counts = field.regions.map(() => 0)
    let missing = 0
    for (let row = 0; row < 200; row += 1) {
      for (let column = 0; column < 200; column += 1) {
        const x = column + 0.5
        const y = row + 0.5
        if (Math.hypot(x - 100, y - 100) > ORB_RADIUS) continue
        const sample = sampleColorOrbField(field, x, y)
        if (sample.primaryIndex < 0) missing += 1
        else counts[sample.primaryIndex] += 1
      }
    }
    expect(missing).toBe(0)
    expect(counts[field.regions.findIndex((region) => region.emotionId === 'dominant')]).toBeGreaterThan(counts[field.regions.findIndex((region) => region.emotionId === 'small')])
  })

  it('calibrates each territory to the real presence weights instead of letting a seed dominate', () => {
    const field = buildColorOrbField([
      { color: '#A66CFF', intensity: 1, presenceWeight: 40, emotionId: 'confused' },
      { color: '#6C757D', intensity: 1, presenceWeight: 30, emotionId: 'bored' },
      { color: '#8A7CCF', intensity: 1, presenceWeight: 9, emotionId: 'unclear' },
    ])
    const areas = field.regions.map(() => 0)
    let total = 0
    for (let row = 0; row < 180; row += 1) {
      for (let column = 0; column < 180; column += 1) {
        const x = (column + 0.5) * (ORB_VIEW_SIZE / 180)
        const y = (row + 0.5) * (ORB_VIEW_SIZE / 180)
        if (Math.hypot(x - 100, y - 100) > ORB_RADIUS) continue
        areas[sampleColorOrbField(field, x, y).primaryIndex] += 1
        total += 1
      }
    }
    const expected = field.regions.map((region) => region.weight / field.totalWeight)
    areas.forEach((area, index) => expect(area / total).toBeCloseTo(expected[index], 1))
  })

  it('keeps real color cores distinct and blends only in a narrow shared boundary band', () => {
    const field = buildColorOrbField([
      { color: '#FFB703', intensity: 1, presenceWeight: 40, emotionId: 'sun' },
      { color: '#FF6B4A', intensity: 1, presenceWeight: 30, emotionId: 'coral' },
      { color: '#3B82F6', intensity: 1, presenceWeight: 9, emotionId: 'blue' },
      { color: '#22C55E', intensity: 1, presenceWeight: 8, emotionId: 'green' },
      { color: '#8B5CF6', intensity: 1, presenceWeight: 7, emotionId: 'violet' },
    ])
    const territoryPixels = field.regions.map(() => 0)
    let sampled = 0
    let boundaryPixels = 0
    for (let row = 0; row < 180; row += 1) {
      for (let column = 0; column < 180; column += 1) {
        const x = (column + 0.5) * (200 / 180)
        const y = (row + 0.5) * (200 / 180)
        if (Math.hypot(x - 100, y - 100) > ORB_RADIUS) continue
        const sample = sampleColorOrbField(field, x, y)
        sampled += 1
        territoryPixels[sample.primaryIndex] += 1
        if (sample.blend > 0.01) boundaryPixels += 1
      }
    }
    expect(territoryPixels.every((pixels) => pixels > 40)).toBe(true)
    expect(boundaryPixels / sampled).toBeLessThan(0.12)
  })

  it('keeps the real territory ratio stable when the orb has five emotions', () => {
    const field = buildColorOrbField([
      { color: '#A66CFF', intensity: 1, presenceWeight: 40, emotionId: 'confused' },
      { color: '#6C757D', intensity: 1, presenceWeight: 30, emotionId: 'bored' },
      { color: '#8A7CCF', intensity: 1, presenceWeight: 9, emotionId: 'unclear' },
      { color: '#34D399', intensity: 1, presenceWeight: 8, emotionId: 'calm' },
      { color: '#FFB703', intensity: 1, presenceWeight: 7, emotionId: 'joy' },
    ])
    const areas = field.regions.map(() => 0)
    let total = 0
    for (let row = 0; row < 180; row += 1) {
      for (let column = 0; column < 180; column += 1) {
        const x = (column + 0.5) * (ORB_VIEW_SIZE / 180)
        const y = (row + 0.5) * (ORB_VIEW_SIZE / 180)
        if (Math.hypot(x - 100, y - 100) > ORB_RADIUS) continue
        areas[sampleColorOrbField(field, x, y).primaryIndex] += 1
        total += 1
      }
    }
    const expected = field.regions.map((region) => region.weight / field.totalWeight)
    areas.forEach((area, index) => expect(area / total).toBeCloseTo(expected[index], 1))
  })

  it('simplifies long-range visuals without changing the total presence weight', () => {
    const simplified = simplifyColorOrbEntries([
      { color: '#FF9F1C', intensity: 1, presenceWeight: 40, emotionId: 'orange' },
      { color: '#743CFF', intensity: 1, presenceWeight: 20, emotionId: 'violet' },
      { color: '#3B82F6', intensity: 1, presenceWeight: 15, emotionId: 'blue' },
      { color: '#22C55E', intensity: 1, presenceWeight: 10, emotionId: 'green' },
      { color: '#FF6B4A', intensity: 1, presenceWeight: 5, emotionId: 'coral' },
      { color: '#6A5ACD', intensity: 1, presenceWeight: 4, emotionId: 'blue-violet' },
      { color: '#FFB703', intensity: 1, presenceWeight: 3, emotionId: 'yellow' },
    ])
    expect(simplified).toHaveLength(4)
    expect(simplified.map((entry) => entry.emotionId)).toEqual(['orange', 'violet', 'blue', 'green'])
    expect(simplified.reduce((sum, entry) => sum + (entry.presenceWeight ?? 0), 0)).toBe(97)
    expect(simplified.find((entry) => entry.emotionId === 'orange')?.presenceWeight).toBeGreaterThan(40)
    expect(simplified.find((entry) => entry.emotionId === 'violet')?.presenceWeight).toBeGreaterThan(20)
  })

  it('keeps secondary color territories while limiting inline labels', () => {
    const readable = readableColorOrbEntries([
      { color: '#FFB703', intensity: 1, presenceWeight: 30, emotionId: 'joy', label: 'Jovial' },
      { color: '#6C757D', intensity: 1, presenceWeight: 24, emotionId: 'bored', label: 'Mất động lực' },
      { color: '#34C3B8', intensity: 1, presenceWeight: 18, emotionId: 'free', label: 'Phóng khoáng' },
      { color: '#FF6B8A', intensity: 1, presenceWeight: 8, emotionId: 'close' },
      { color: '#3B82F6', intensity: 1, presenceWeight: 7, emotionId: 'tired' },
      { color: '#E56A96', intensity: 1, presenceWeight: 5, emotionId: 'sad' },
    ])
    expect(readable).toHaveLength(6)
    expect(readable.filter((entry) => entry.showLabel).map((entry) => entry.emotionId)).toEqual(['joy', 'bored', 'free'])
    const field = buildColorOrbField(readable)
    expect(field.regions).toHaveLength(6)
    expect(field.regions.filter((region) => region.showLabel)).toHaveLength(3)
    expect(field.totalWeight).toBe(92)
  })
})

describe('Color Halo Ring', () => {
  it('renders a neutral empty state without inventing emotion colors', () => {
    const ring = buildColorHaloRing([])
    expect(ring.segments).toEqual([])
    expect(ring.gradient).toContain('#ECE4FF')
  })

  it('keeps a single emotion on the full circumference using its source hex', () => {
    const ring = buildColorHaloRing([{ color: '#34D399', intensity: 1, emotionId: 'calm' }])
    expect(ring.segments).toHaveLength(1)
    expect(ring.segments[0]).toMatchObject({ color: '#34D399', percentage: 100, start: 0, end: 1 })
    expect(ring.gradient).toContain('#34D399')
  })

  it('maps arc spans to normalized presence percentages and keeps small emotions', () => {
    const ring = buildColorHaloRing([
      { color: '#FFB703', intensity: 1, presenceWeight: 40, emotionId: 'dominant' },
      { color: '#FF6B4A', intensity: 1, presenceWeight: 30, emotionId: 'coral' },
      { color: '#8B5CF6', intensity: 1, presenceWeight: 9, emotionId: 'violet' },
      { color: '#22C55E', intensity: 1, presenceWeight: 12, emotionId: 'green' },
      { color: '#38BDF8', intensity: 1, presenceWeight: 9, emotionId: 'cyan' },
    ])
    expect(ring.segments).toHaveLength(5)
    const percentages = new Map(ring.segments.map((segment) => [segment.emotionId, Math.round(segment.percentage)]))
    expect(percentages).toEqual(new Map([['dominant', 40], ['coral', 30], ['violet', 9], ['green', 12], ['cyan', 9]]))
    expect(ring.segments.map((segment) => segment.end - segment.start).reduce((sum, span) => sum + span, 0)).toBeCloseTo(1)
    expect(ring.segments.every((segment) => segment.color.startsWith('#'))).toBe(true)
  })

  it('keeps every CSS gradient stop inside the conic ring bounds', () => {
    const ring = buildColorHaloRing([
      { color: '#743CFF', intensity: 1, presenceWeight: 7, emotionId: 'violet' },
      { color: '#FFB703', intensity: 1, presenceWeight: 2, emotionId: 'yellow' },
      { color: '#34D399', intensity: 1, presenceWeight: 1, emotionId: 'mint' },
    ])
    const positions = [...ring.gradient.matchAll(/(\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]))
    expect(positions.length).toBeGreaterThan(0)
    expect(positions.every((position) => position >= 0 && position <= 100)).toBe(true)
  })

  it('labels every halo arc with its percentage', () => {
    const ring = buildColorHaloRing([
      { color: '#743CFF', intensity: 1, presenceWeight: 40, emotionId: 'forty' },
      { color: '#FFB703', intensity: 1, presenceWeight: 25, emotionId: 'twenty-five' },
      { color: '#34D399', intensity: 1, presenceWeight: 19, emotionId: 'nineteen' },
      { color: '#FF6B4A', intensity: 1, presenceWeight: 11, emotionId: 'eleven' },
      { color: '#38BDF8', intensity: 1, presenceWeight: 5, emotionId: 'five' },
    ])
    const labelled = ring.segments.filter((segment) => segment.showLabel).map((segment) => segment.emotionId)
    expect(labelled).toHaveLength(5)
    expect(labelled).toEqual(expect.arrayContaining(['forty', 'twenty-five', 'nineteen', 'eleven', 'five']))
  })

  it('gives perceptually similar neighbors a wider blend transition', () => {
    const similar = buildColorHaloRing([
      { color: '#743CFF', intensity: 1, presenceWeight: 1, emotionId: 'violet' },
      { color: '#6A5ACD', intensity: 1, presenceWeight: 1, emotionId: 'blue-violet' },
    ])
    const distant = buildColorHaloRing([
      { color: '#743CFF', intensity: 1, presenceWeight: 1, emotionId: 'violet' },
      { color: '#FFB703', intensity: 1, presenceWeight: 1, emotionId: 'yellow' },
    ])
    expect(similar.segments[0].transitionAfter).toBeGreaterThan(distant.segments[0].transitionAfter)
  })
})
