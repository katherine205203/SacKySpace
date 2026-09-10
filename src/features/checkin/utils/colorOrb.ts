import type { CheckinRecord } from '../types'

export type ColorOrbEntry = {
  color: string
  intensity: number
  presenceWeight?: number
  emotionId?: string
  label?: string
  labelEn?: string
  emoji?: string
}

export type LabColor = { l: number; a: number; b: number }
export type RgbColor = readonly [number, number, number]

/**
 * Metadata for one continuous field territory. There is intentionally no
 * path or polygon here: the renderer samples the weighted field directly.
 */
export type OrbRegion = {
  key: string
  color: string
  weight: number
  percentage: number
  start: number
  end: number
  seedX: number
  seedY: number
  labelX: number
  labelY: number
  labelColor: '#FFFFFF' | '#231B46'
  showLabel: boolean
  label?: string
  labelEn?: string
  emoji?: string
  emotionId?: string
  colorLab: LabColor
  colorRgb: RgbColor
  influenceStrength: number
  /**
   * Additive offset calibrated against a low-resolution area map. It keeps a
   * territory's visible area faithful to its real presence weight without
   * turning the map into radial percentage wedges.
   */
  fieldBias: number
  warpPhase: number
  rotation: number
  aspect: number
}

export type OrbField = {
  regions: OrbRegion[]
  totalWeight: number
}

export type OrbFieldSample = {
  primaryIndex: number
  secondaryIndex: number
  blend: number
  ratio: number
}

export type OrbLegendEntry = {
  key: string
  color: string
  percentage: number
  label?: string
  labelEn?: string
  emoji?: string
}

export const PRESENCE_WEIGHT_BY_INTENSITY = [0, 1, 1.35, 1.8, 2.4, 3.2] as const
export const ORB_VIEW_SIZE = 200
export const ORB_RADIUS = 96

const EPSILON = 0.000001
const TWO_PI = Math.PI * 2

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const smoothStep = (value: number): number => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

const normalizeHex = (hex: string): string => {
  const value = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(value)) return `#${value.split('').map((part) => `${part}${part}`).join('').toUpperCase()}`
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value.toUpperCase()}`
  return '#B8A5DF'
}

const srgbToLinear = (value: number): number => {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

const linearToSrgb = (value: number): number => {
  const normalized = clamp(value, 0, 1)
  return normalized <= 0.0031308 ? normalized * 12.92 : 1.055 * (normalized ** (1 / 2.4)) - 0.055
}

const hexToRgb = (hex: string): RgbColor => {
  const normalized = normalizeHex(hex).slice(1)
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

export const hexToOklab = (hex: string): LabColor => {
  const [red, green, blue] = hexToRgb(hex).map(srgbToLinear)
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

export const oklabToRgb = (color: LabColor): RgbColor => {
  const lRoot = color.l + 0.3963377774 * color.a + 0.2158037573 * color.b
  const mRoot = color.l - 0.1055613458 * color.a - 0.0638541728 * color.b
  const sRoot = color.l - 0.0894841775 * color.a - 1.291485548 * color.b
  const red = 4.0767416621 * lRoot ** 3 - 3.3077115913 * mRoot ** 3 + 0.2309699292 * sRoot ** 3
  const green = -1.2684380046 * lRoot ** 3 + 2.6097574011 * mRoot ** 3 - 0.3413193965 * sRoot ** 3
  const blue = -0.0041960863 * lRoot ** 3 - 0.7034186147 * mRoot ** 3 + 1.707614701 * sRoot ** 3
  return [Math.round(linearToSrgb(red) * 255), Math.round(linearToSrgb(green) * 255), Math.round(linearToSrgb(blue) * 255)]
}

export const colorDistance = (first: string, second: string): number => {
  const left = hexToOklab(first)
  const right = hexToOklab(second)
  return Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b)
}

export const intensityToPresenceWeight = (intensity: number): number => {
  const safeIntensity = clamp(Math.round(intensity), 1, 5)
  return PRESENCE_WEIGHT_BY_INTENSITY[safeIntensity]
}

const stableHash = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

type AggregatedEntry = ColorOrbEntry & { key: string; weight: number; index: number }

const aggregateEntries = (entries: readonly ColorOrbEntry[]): AggregatedEntry[] => {
  const grouped = new Map<string, AggregatedEntry>()
  entries.forEach((entry, index) => {
    const color = normalizeHex(entry.color)
    const key = entry.emotionId ? `emotion:${entry.emotionId}` : `color:${color}`
    const weight = Math.max(0, entry.presenceWeight ?? intensityToPresenceWeight(entry.intensity))
    if (weight <= EPSILON) return
    const existing = grouped.get(key)
    if (existing) {
      existing.weight += weight
      return
    }
    grouped.set(key, { ...entry, color, key, weight, index })
  })
  return [...grouped.values()].sort((left, right) => right.weight - left.weight || left.index - right.index)
}

const orderByColorAffinity = (entries: readonly AggregatedEntry[]): AggregatedEntry[] => {
  if (entries.length < 3) return [...entries]
  const remaining = [...entries]
  const ordered: AggregatedEntry[] = [remaining.shift()!]
  while (remaining.length) {
    const previous = ordered[ordered.length - 1]
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((entry, index) => {
      const distance = colorDistance(previous.color, entry.color)
      const tieBreaker = stableHash(entry.key) * 0.000001
      if (distance + tieBreaker < nearestDistance) {
        nearestDistance = distance + tieBreaker
        nearestIndex = index
      }
    })
    ordered.push(remaining.splice(nearestIndex, 1)[0])
  }
  return ordered
}

type Point = { x: number; y: number }

// These are fixed, non-radial anchor slots. Color-affinity ordering puts
// related emotions next to one another before stable per-emotion jitter.
const seedLayouts: Point[][] = [
  [{ x: 0, y: 0 }],
  [{ x: -47, y: -22 }, { x: 43, y: 27 }],
  [{ x: -45, y: -38 }, { x: 43, y: -35 }, { x: 8, y: 52 }],
  [{ x: -49, y: -39 }, { x: 42, y: -35 }, { x: 48, y: 26 }, { x: -38, y: 46 }],
  [{ x: -49, y: -29 }, { x: 5, y: -55 }, { x: 54, y: -8 }, { x: 24, y: 50 }, { x: -51, y: 30 }],
  [{ x: -52, y: -38 }, { x: 0, y: -57 }, { x: 53, y: -34 }, { x: 53, y: 31 }, { x: 0, y: 57 }, { x: -53, y: 29 }],
]

const makeSeeds = (entries: readonly AggregatedEntry[]): Point[] => {
  const layout = seedLayouts[entries.length - 1] ?? []
  return entries.map((entry, index) => {
    const anchor = layout[index] ?? { x: 0, y: 0 }
    const jitterX = (stableHash(`${entry.key}:seed-x`) - 0.5) * 4.5
    const jitterY = (stableHash(`${entry.key}:seed-y`) - 0.5) * 4.5
    return { x: 100 + anchor.x + jitterX, y: 100 + anchor.y + jitterY }
  })
}

const getLabelColor = (color: string): '#FFFFFF' | '#231B46' => hexToOklab(color).l < 0.72 ? '#FFFFFF' : '#231B46'

const warpOrbPoint = (x: number, y: number): Point => ({
  // A shared, gentle coordinate warp makes every boundary curve organically.
  // It is intentionally shared instead of region-specific, so it cannot make
  // spikes, cracks, or independent noisy islands.
  x: x + Math.sin(y * 0.071 + 0.9) * 9 + Math.sin((x + y) * 0.033) * 4,
  y: y + Math.sin(x * 0.063 - 1.2) * 8 + Math.sin((x - y) * 0.029) * 3,
})

const sampleScores = (field: OrbField, x: number, y: number): number[] => field.regions.map((region) => {
  const { x: warpedX, y: warpedY } = warpOrbPoint(x, y)
  const dx = warpedX - region.seedX
  const dy = warpedY - region.seedY
  const cosine = Math.cos(region.rotation)
  const sine = Math.sin(region.rotation)
  const longitudinal = dx * cosine + dy * sine
  const transverse = -dx * sine + dy * cosine
  const territoryScale = 30 + Math.sqrt(region.influenceStrength) * 44
  const organicDistance = Math.hypot(longitudinal / (territoryScale * region.aspect), transverse / (territoryScale / region.aspect))
  // This is intentionally low-frequency and small: it rounds a boundary, but
  // never competes with the dominant distance field or creates tiny islands.
  const organicNoise = Math.sin(warpedX * 0.041 + region.warpPhase) * 0.022 + Math.sin(warpedY * 0.053 - region.warpPhase) * 0.014
  return region.fieldBias - organicDistance ** 1.72 + organicNoise
})

/**
 * A weighted Voronoi-style map looks natural, but raw distance fields do not
 * make a 30% entry occupy 30% of the circle. Calibrate additive field offsets
 * over an internal circular grid, then render at much higher resolution. This
 * preserves organic borders while making the visual weights honest.
 */
const calibrateTerritoryAreas = (regions: OrbRegion[]): void => {
  if (regions.length < 2) return
  const sampleSize = 84
  const samplePoints: Point[] = []
  for (let row = 0; row < sampleSize; row += 1) {
    for (let column = 0; column < sampleSize; column += 1) {
      const x = ((column + 0.5) / sampleSize) * ORB_VIEW_SIZE
      const y = ((row + 0.5) / sampleSize) * ORB_VIEW_SIZE
      if (Math.hypot(x - 100, y - 100) <= ORB_RADIUS) samplePoints.push({ x, y })
    }
  }
  const field: OrbField = { regions, totalWeight: regions.reduce((sum, region) => sum + region.weight, 0) }
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const areas = regions.map(() => 0)
    samplePoints.forEach(({ x, y }) => {
      const sample = sampleColorOrbField(field, x, y)
      if (sample.primaryIndex >= 0) areas[sample.primaryIndex] += 1
    })
    let largestError = 0
    regions.forEach((region, index) => {
      const observed = areas[index] / samplePoints.length
      const expected = region.weight / field.totalWeight
      const error = expected - observed
      largestError = Math.max(largestError, Math.abs(error))
      // A restrained update converges without introducing seed-order jitter.
      region.fieldBias += error * 1.45
    })
    if (largestError < 0.0035) break
  }
}

export const sampleColorOrbField = (field: OrbField, x: number, y: number): OrbFieldSample => {
  if (!field.regions.length || Math.hypot(x - 100, y - 100) > ORB_RADIUS) return { primaryIndex: -1, secondaryIndex: -1, blend: 0, ratio: 0 }
  const scores = sampleScores(field, x, y)
  let primaryIndex = 0
  let secondaryIndex = -1
  scores.forEach((score, index) => {
    if (score > scores[primaryIndex]) {
      secondaryIndex = primaryIndex
      primaryIndex = index
    } else if (index !== primaryIndex && (secondaryIndex < 0 || score > scores[secondaryIndex])) {
      secondaryIndex = index
    }
  })
  if (secondaryIndex < 0) return { primaryIndex, secondaryIndex, blend: 0, ratio: 0 }
  const topScore = scores[primaryIndex]
  const margin = Math.max(0, topScore - scores[secondaryIndex])
  const ratio = Math.exp(-margin)
  const distance = Math.hypot(
    field.regions[primaryIndex].colorLab.l - field.regions[secondaryIndex].colorLab.l,
    field.regions[primaryIndex].colorLab.a - field.regions[secondaryIndex].colorLab.a,
    field.regions[primaryIndex].colorLab.b - field.regions[secondaryIndex].colorLab.b,
  )
  const affinity = 1 - clamp(distance / 0.42, 0, 1)
  // A winner owns every pixel outside this deliberately narrow band. Similar
  // hues get a modestly wider feather, but their cores remain their real hex.
  // At the exact shared edge the mix is 50/50, preventing a hard alias line.
  // Do not create muddy bands between unrelated emotion colors. A very close
  // pair may feather by a maximum of a few high-resolution pixels; the canvas
  // downsample still anti-aliases every other shared edge.
  const blendWidth = affinity < 0.22 ? 0 : 0.012 + affinity * 0.052
  const blend = blendWidth > 0 ? 0.5 * (1 - smoothStep(margin / blendWidth)) : 0
  return { primaryIndex, secondaryIndex, blend, ratio }
}

const deriveVisualCenters = (field: OrbField): OrbRegion[] => {
  const sampleSize = 144
  const centers = field.regions.map(() => ({ x: 0, y: 0, weight: 0 }))
  for (let row = 0; row < sampleSize; row += 1) {
    for (let column = 0; column < sampleSize; column += 1) {
      const x = ((column + 0.5) / sampleSize) * ORB_VIEW_SIZE
      const y = ((row + 0.5) / sampleSize) * ORB_VIEW_SIZE
      const sample = sampleColorOrbField(field, x, y)
      if (sample.primaryIndex < 0) continue
      const confidence = Math.max(0.2, 1 - sample.ratio)
      centers[sample.primaryIndex].x += x * confidence
      centers[sample.primaryIndex].y += y * confidence
      centers[sample.primaryIndex].weight += confidence
    }
  }
  return field.regions.map((region, index) => {
    const center = centers[index]
    const labelX = center.weight > EPSILON ? clamp(center.x / center.weight, 20, 180) : region.seedX
    const labelY = center.weight > EPSILON ? clamp(center.y / center.weight, 20, 180) : region.seedY
    return { ...region, labelX, labelY, showLabel: true }
  })
}

export const buildColorOrbField = (entries: readonly ColorOrbEntry[]): OrbField => {
  const aggregated = orderByColorAffinity(aggregateEntries(entries))
  const totalWeight = aggregated.reduce((sum, entry) => sum + entry.weight, 0)
  if (!aggregated.length || totalWeight <= EPSILON) return { regions: [], totalWeight: 0 }
  const seeds = makeSeeds(aggregated)
  let cursor = 0
  const regions: OrbRegion[] = aggregated.map((entry, index) => {
    const percentage = (entry.weight / totalWeight) * 100
    const proportion = entry.weight / totalWeight
    const region: OrbRegion = {
      key: entry.key,
      color: entry.color,
      weight: entry.weight,
      percentage,
      start: cursor,
      end: index === aggregated.length - 1 ? 1 : cursor + proportion,
      seedX: seeds[index].x,
      seedY: seeds[index].y,
      labelX: seeds[index].x,
      labelY: seeds[index].y,
      labelColor: getLabelColor(entry.color),
      showLabel: true,
      colorLab: hexToOklab(entry.color),
      colorRgb: hexToRgb(entry.color),
      influenceStrength: proportion ** 0.72,
      fieldBias: 0,
      warpPhase: stableHash(`${entry.key}:warp`) * TWO_PI,
      rotation: (stableHash(`${entry.key}:rotation`) - 0.5) * 0.9,
      aspect: 0.84 + stableHash(`${entry.key}:aspect`) * 0.34,
      ...(entry.emotionId ? { emotionId: entry.emotionId } : {}),
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
      ...(entry.emoji ? { emoji: entry.emoji } : {}),
    }
    cursor += proportion
    return region
  })
  calibrateTerritoryAreas(regions)
  return { regions: deriveVisualCenters({ regions, totalWeight }), totalWeight }
}

/** Compatibility name for callers that only need field metadata. */
export const buildColorOrbRegionsFromColors = (entries: readonly ColorOrbEntry[]): OrbRegion[] => buildColorOrbField(entries).regions

export const buildColorOrbRegions = (records: readonly CheckinRecord[]): OrbRegion[] => buildColorOrbRegionsFromColors(records.flatMap((record) => {
  if (record.checkinType !== 'emotion' || !record.primaryEmotion) return []
  const totalWeight = intensityToPresenceWeight(record.intensity ?? 1)
  const secondary = record.secondaryEmotions.filter((emotion, index, list) => emotion.emotion_id !== record.primaryEmotion?.emotion_id && list.findIndex((item) => item.emotion_id === emotion.emotion_id) === index)
  const shares = secondary.length === 0 ? [1] : secondary.length === 1 ? [0.7, 0.3] : [0.7, 0.15, 0.15]
  return [record.primaryEmotion, ...secondary].map((emotion, index) => ({
    color: emotion.color_hex,
    intensity: record.intensity ?? 1,
    presenceWeight: totalWeight * (shares[index] ?? 0),
    emotionId: emotion.emotion_id,
    label: emotion.emotion_name_vn,
    labelEn: emotion.emotion_name_en,
    emoji: emotion.emoji,
  }))
}))

export const getColorOrbLegend = (entries: readonly ColorOrbEntry[], limit = 3): OrbLegendEntry[] => {
  const aggregated = aggregateEntries(entries)
  const totalWeight = aggregated.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight <= EPSILON) return []
  return aggregated.slice(0, limit).map((entry) => ({
    key: entry.key,
    color: entry.color,
    percentage: Math.round((entry.weight / totalWeight) * 100),
    ...(entry.label ? { label: entry.label } : {}),
    ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
    ...(entry.emoji ? { emoji: entry.emoji } : {}),
  }))
}

export const SIMPLIFIED_ORB_MIN_PERCENTAGE = 6.5
export const SIMPLIFIED_ORB_MAX_REGIONS = 6

/**
 * Reduces only the visual field for longer Home ranges. The source entries
 * and their real percentages remain untouched; low-share entries borrow the
 * nearest perceptual color territory instead of becoming tiny new blobs.
 */
export const simplifyColorOrbEntries = (
  entries: readonly ColorOrbEntry[],
  minPercentage = SIMPLIFIED_ORB_MIN_PERCENTAGE,
  maxRegions = SIMPLIFIED_ORB_MAX_REGIONS,
): ColorOrbEntry[] => {
  const aggregated = aggregateEntries(entries)
  const totalWeight = aggregated.reduce((sum, entry) => sum + entry.weight, 0)
  if (!aggregated.length || totalWeight <= EPSILON) return []

  const candidates = aggregated.slice(0, maxRegions)
  const minimumVisibleCount = Math.min(4, candidates.length)
  const retained = candidates.filter((entry, index) => index < minimumVisibleCount || (entry.weight / totalWeight) * 100 >= minPercentage)
  const visible = retained.length ? retained : [candidates[0]]
  const visualWeights = new Map(visible.map((entry) => [entry.key, entry.weight]))
  const visibleByColor = visible.map((entry) => ({ entry, color: entry.color }))

  aggregated.filter((entry) => !visualWeights.has(entry.key)).forEach((entry) => {
    if (visualWeights.has(entry.key)) return
    const nearest = visibleByColor.reduce((best, candidate) => colorDistance(entry.color, candidate.color) < colorDistance(entry.color, best.color) ? candidate : best, visibleByColor[0])
    visualWeights.set(nearest.entry.key, (visualWeights.get(nearest.entry.key) ?? 0) + entry.weight)
  })

  return visible.map((entry) => ({
    color: entry.color,
    intensity: entry.intensity,
    presenceWeight: visualWeights.get(entry.key) ?? entry.weight,
    ...(entry.emotionId ? { emotionId: entry.emotionId } : {}),
    ...(entry.label ? { label: entry.label } : {}),
    ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
    ...(entry.emoji ? { emoji: entry.emoji } : {}),
  }))
}

export type ColorHaloSegment = {
  key: string
  color: string
  weight: number
  percentage: number
  start: number
  end: number
  transitionBefore: number
  transitionAfter: number
  labelAngle: number
  labelColor: '#FFFFFF' | '#231B46'
  showLabel: boolean
  label?: string
  labelEn?: string
  emoji?: string
  emotionId?: string
}

export type ColorHaloRing = {
  segments: ColorHaloSegment[]
  totalWeight: number
  gradient: string
}

const getTransitionWidth = (first: string, second: string, firstSpan: number, secondSpan: number): number => {
  const affinity = 1 - clamp(colorDistance(first, second) / 0.42, 0, 1)
  const idealWidth = 0.018 + affinity * 0.074
  return Math.min(idealWidth, firstSpan * 0.42, secondSpan * 0.42)
}

const toGradientStops = (segments: readonly ColorHaloSegment[]): string => {
  if (!segments.length) return 'conic-gradient(#ECE4FF, #F5F1FF, #ECE4FF)'
  const stops: Array<{ position: number; color: string }> = [
    { position: 0, color: segments[0].color },
    { position: 1, color: segments[0].color },
  ]
  const append = (position: number, color: string) => stops.push({ position: clamp(position, 0, 1), color })

  segments.forEach((segment, index) => {
    const next = segments[index + 1]
    const transition = segment.transitionAfter
    const coreStart = segment.start + segment.transitionBefore / 2
    const coreEnd = segment.end - transition / 2
    append(coreStart, segment.color)
    append(coreEnd, segment.color)
    if (next) {
      append(segment.end - transition / 2, segment.color)
      append(segment.end + transition / 2, next.color)
    } else {
      // The final boundary wraps to 0°. Keeping both seam stops in-range
      // avoids invalid gradients while preserving a soft wrap transition.
      append(1 - transition / 2, segment.color)
      append(1, segments[0].color)
    }
  })

  const normalized = stops.sort((left, right) => left.position - right.position)
  const deduped = normalized.filter((stop, index) => index === 0 || stop.position - normalized[index - 1].position > 0.00001)
  return `conic-gradient(${deduped.map(({ position, color }) => `${color} ${position * 100}%`).join(', ')})`
}

const toProportionalGradient = (segments: readonly ColorHaloSegment[]): string => {
  if (!segments.length) return 'conic-gradient(#ECE4FF, #F5F1FF, #ECE4FF)'
  return `conic-gradient(${segments.map((segment) => `${segment.color} ${segment.start * 100}% ${segment.end * 100}%`).join(', ')})`
}

const toSafeGradient = (segments: readonly ColorHaloSegment[]): string => {
  try {
    return toGradientStops(segments)
  } catch {
    return toProportionalGradient(segments)
  }
}

/**
 * Builds the stable, data-driven model for the Home Color Halo Ring.
 * Arc ownership stays proportional to presence; only the visual transition
 * around a shared boundary is expanded, and hit testing still uses start/end.
 */
export const buildColorHaloRing = (entries: readonly ColorOrbEntry[]): ColorHaloRing => {
  const aggregated = orderByColorAffinity(aggregateEntries(entries))
  const totalWeight = aggregated.reduce((sum, entry) => sum + entry.weight, 0)
  if (!aggregated.length || totalWeight <= EPSILON) return { segments: [], totalWeight: 0, gradient: toSafeGradient([]) }

  let cursor = 0
  const spans = aggregated.map((entry) => entry.weight / totalWeight)
  const segments = aggregated.map((entry, index) => {
    const start = cursor
    const end = index === aggregated.length - 1 ? 1 : cursor + spans[index]
    cursor = end
    return {
      entry,
      start,
      end,
      percentage: spans[index] * 100,
    }
  })
  const ringSegments: ColorHaloSegment[] = segments.map(({ entry, start, end, percentage }, index) => {
    const previous = segments[(index - 1 + segments.length) % segments.length]
    const next = segments[(index + 1) % segments.length]
    const transitionBefore = getTransitionWidth(entry.color, previous.entry.color, end - start, previous.end - previous.start)
    const transitionAfter = getTransitionWidth(entry.color, next.entry.color, end - start, next.end - next.start)
    return {
      key: entry.key,
      color: entry.color,
      weight: entry.weight,
      percentage,
      start,
      end,
      transitionBefore,
      transitionAfter,
      labelAngle: (start + end) / 2,
      labelColor: getLabelColor(entry.color),
      showLabel: true,
      ...(entry.emotionId ? { emotionId: entry.emotionId } : {}),
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
      ...(entry.emoji ? { emoji: entry.emoji } : {}),
    }
  })
  return { segments: ringSegments, totalWeight, gradient: toSafeGradient(ringSegments) }
}
