import type { CheckinRecord } from '../types'

export type ColorOrbEntry = {
  color: string
  intensity: number
  /** Use this when the caller has already split one check-in into contributions. */
  presenceWeight?: number
  emotionId?: string
  label?: string
  emoji?: string
}

export type OrbRegion = {
  key: string
  color: string
  weight: number
  percentage: number
  start: number
  end: number
  path: string
  labelX: number
  labelY: number
  labelColor: '#FFFFFF' | '#231B46'
  showLabel: boolean
  edgeOpacity: number
  label?: string
  emoji?: string
  emotionId?: string
}

export type OrbLegendEntry = {
  key: string
  color: string
  percentage: number
  label?: string
  emoji?: string
}

export const PRESENCE_WEIGHT_BY_INTENSITY = [0, 1, 1.35, 1.8, 2.4, 3.2] as const

export const intensityToPresenceWeight = (intensity: number): number => {
  const level = Math.min(5, Math.max(1, Math.round(intensity)))
  return PRESENCE_WEIGHT_BY_INTENSITY[level]
}

const normalizeHex = (hex: string): string => {
  const value = hex.trim()
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${value.slice(1).split('').map((part) => `${part}${part}`).join('')}`.toUpperCase()
  return '#D9D0EA'
}

const hexToRgb = (hex: string): [number, number, number] => {
  const value = normalizeHex(hex).slice(1)
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

const srgbToLinear = (value: number): number => {
  const normalized = value / 255
  return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4
}

/** OKLab keeps the topology based on perceived colour distance rather than RGB channel distance. */
export const hexToOklab = (hex: string): [number, number, number] => {
  const [red, green, blue] = hexToRgb(hex).map(srgbToLinear)
  const lightness = .4122214708 * red + .5363325363 * green + .0514459929 * blue
  const greenAxis = .2119034982 * red + .6806995451 * green + .1073969566 * blue
  const blueAxis = .0883024619 * red + .2817188376 * green + .6299787005 * blue
  const lightnessRoot = Math.cbrt(lightness)
  const greenRoot = Math.cbrt(greenAxis)
  const blueRoot = Math.cbrt(blueAxis)
  return [
    .2104542553 * lightnessRoot + .793617785 * greenRoot - .0040720468 * blueRoot,
    1.9779984951 * lightnessRoot - 2.428592205 * greenRoot + .4505937099 * blueRoot,
    .0259040371 * lightnessRoot + .7827717662 * greenRoot - .808675766 * blueRoot,
  ]
}

export const colorDistance = (left: string, right: string): number => {
  const [leftL, leftA, leftB] = hexToOklab(left)
  const [rightL, rightA, rightB] = hexToOklab(right)
  return Math.hypot(leftL - rightL, leftA - rightA, leftB - rightB)
}

const relativeLuminance = (hex: string): number => {
  const [red, green, blue] = hexToRgb(hex).map(srgbToLinear)
  return .2126 * red + .7152 * green + .0722 * blue
}

const labelColorFor = (hex: string): '#FFFFFF' | '#231B46' => relativeLuminance(hex) > .58 ? '#231B46' : '#FFFFFF'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const stableHash = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

type WeightedColor = {
  key: string
  color: string
  weight: number
  label?: string
  emoji?: string
  emotionId?: string
}

const aggregateEntries = (entries: readonly ColorOrbEntry[]): WeightedColor[] => {
  const weights = new Map<string, WeightedColor>()
  for (const entry of entries) {
    const color = normalizeHex(entry.color)
    const weight = Math.max(0, entry.presenceWeight ?? intensityToPresenceWeight(entry.intensity))
    if (!weight) continue
    const key = entry.emotionId ? `emotion:${entry.emotionId}` : `color:${color}`
    const current = weights.get(key)
    if (current) {
      current.weight += weight
      continue
    }
    weights.set(key, {
      key,
      color,
      weight,
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.emoji ? { emoji: entry.emoji } : {}),
      ...(entry.emotionId ? { emotionId: entry.emotionId } : {}),
    })
  }
  return [...weights.values()]
}

const orderByColorAffinity = (items: WeightedColor[]): WeightedColor[] => {
  if (items.length < 3) return [...items].sort((left, right) => right.weight - left.weight || left.key.localeCompare(right.key))

  const remaining = [...items]
  remaining.sort((left, right) => right.weight - left.weight || left.key.localeCompare(right.key))
  const ordered = [remaining.shift() as WeightedColor]
  while (remaining.length) {
    const previous = ordered.at(-1) as WeightedColor
    remaining.sort((left, right) => {
      const distanceDelta = colorDistance(previous.color, left.color) - colorDistance(previous.color, right.color)
      return distanceDelta || right.weight - left.weight || stableHash(left.key) - stableHash(right.key)
    })
    ordered.push(remaining.shift() as WeightedColor)
  }
  return ordered
}

const pointOnCircle = (angle: number, radius: number): [number, number] => [100 + Math.cos(angle) * radius, 100 + Math.sin(angle) * radius]

const organicRadius = (angle: number): number => 94 + Math.sin(angle * 3.1 + .4) * 1.65 + Math.sin(angle * 7.3 - 1.1) * .85

const boundaryControls = (angle: number): [[number, number], [number, number]] => {
  const bend = Math.sin(angle * 2.6 + 1.4) * .075
  return [pointOnCircle(angle + bend, 38), pointOnCircle(angle + bend * .45, 72)]
}

const pointString = ([x, y]: [number, number]): string => `${x.toFixed(2)} ${y.toFixed(2)}`

const organicRegionPath = (startAngle: number, endAngle: number): string => {
  const span = endAngle - startAngle
  const innerRadius = 14
  const innerStart = pointOnCircle(startAngle, innerRadius)
  const innerEnd = pointOnCircle(endAngle, innerRadius)
  const outerStart = pointOnCircle(startAngle, organicRadius(startAngle))
  const outerEnd = pointOnCircle(endAngle, organicRadius(endAngle))
  const [startInnerControl, startOuterControl] = boundaryControls(startAngle)
  const [endInnerControl, endOuterControl] = boundaryControls(endAngle)
  const firstAngle = startAngle + span * .27
  const secondAngle = startAngle + span * .53
  const thirdAngle = startAngle + span * .78
  const firstPoint = pointOnCircle(firstAngle, organicRadius(firstAngle))
  const secondPoint = pointOnCircle(secondAngle, organicRadius(secondAngle))
  const thirdPoint = pointOnCircle(thirdAngle, organicRadius(thirdAngle))
  const firstControl = pointOnCircle(startAngle + span * .13, organicRadius(firstAngle) + 2.4)
  const secondControl = pointOnCircle(startAngle + span * .4, organicRadius(secondAngle) + 2.6)
  const thirdControl = pointOnCircle(startAngle + span * .66, organicRadius(thirdAngle) + 2.2)
  const largeArc = span > Math.PI ? 1 : 0

  return [
    `M ${pointString(innerStart)}`,
    `C ${pointString(startInnerControl)} ${pointString(startOuterControl)} ${pointString(outerStart)}`,
    `Q ${pointString(firstControl)} ${pointString(firstPoint)}`,
    `Q ${pointString(secondControl)} ${pointString(secondPoint)}`,
    `Q ${pointString(thirdControl)} ${pointString(thirdPoint)}`,
    `Q ${pointString(endOuterControl)} ${pointString(outerEnd)}`,
    `C ${pointString(endOuterControl)} ${pointString(endInnerControl)} ${pointString(innerEnd)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${pointString(innerStart)} Z`,
  ].join(' ')
}

const fullOrganicCirclePath = 'M 100 6 A 94 94 0 1 1 99.99 6 Z'

export const buildColorOrbRegionsFromColors = (entries: readonly ColorOrbEntry[]): OrbRegion[] => {
  const aggregated = orderByColorAffinity(aggregateEntries(entries))
  const total = aggregated.reduce((sum, item) => sum + item.weight, 0)
  if (!total) return []

  let cursor = 0
  return aggregated.map((item, index) => {
    const proportion = item.weight / total
    const start = cursor
    const end = index === aggregated.length - 1 ? 1 : cursor + proportion
    cursor = end
    const startAngle = -Math.PI / 2 + start * Math.PI * 2
    const endAngle = -Math.PI / 2 + end * Math.PI * 2
    const midAngle = startAngle + (endAngle - startAngle) / 2
    const labelRadius = aggregated.length === 1 ? 0 : clamp(25 + proportion * 78, 30, 49)
    const [labelX, labelY] = pointOnCircle(midAngle, labelRadius)
    const previous = aggregated[(index + aggregated.length - 1) % aggregated.length]
    const next = aggregated[(index + 1) % aggregated.length]
    const nearestEdgeDistance = Math.max(colorDistance(item.color, previous.color), colorDistance(item.color, next.color))
    const edgeOpacity = .24 + clamp((nearestEdgeDistance - .035) / .42, 0, 1) * .34
    const percentage = proportion * 100
    return {
      key: item.key,
      color: item.color,
      weight: item.weight,
      percentage,
      start,
      end,
      path: aggregated.length === 1 ? fullOrganicCirclePath : organicRegionPath(startAngle, endAngle),
      labelX,
      labelY,
      labelColor: labelColorFor(item.color),
      showLabel: percentage >= 7.5,
      edgeOpacity,
      ...(item.label ? { label: item.label } : {}),
      ...(item.emoji ? { emoji: item.emoji } : {}),
      ...(item.emotionId ? { emotionId: item.emotionId } : {}),
    }
  })
}

export const buildColorOrbRegions = (records: readonly CheckinRecord[]): OrbRegion[] => {
  return buildColorOrbRegionsFromColors(records.flatMap((record) => {
    if (record.checkinType !== 'emotion' || !record.primaryEmotion) return []
    const totalWeight = intensityToPresenceWeight(record.intensity ?? 1)
    const secondary = record.secondaryEmotions.filter((emotion, index, list) => emotion.emotion_id !== record.primaryEmotion?.emotion_id && list.findIndex((item) => item.emotion_id === emotion.emotion_id) === index)
    const shares = secondary.length === 0 ? [1] : secondary.length === 1 ? [.7, .3] : [.7, .15, .15]
    return [record.primaryEmotion, ...secondary].map((emotion, index) => ({
      color: emotion.color_hex,
      intensity: record.intensity ?? 1,
      presenceWeight: totalWeight * (shares[index] ?? 0),
      emotionId: emotion.emotion_id,
      label: emotion.emotion_name_vn,
      emoji: emotion.emoji,
    }))
  }))
}

export const getColorOrbLegend = (entries: readonly ColorOrbEntry[], limit = 3): OrbLegendEntry[] =>
  buildColorOrbRegionsFromColors(entries)
    .sort((left, right) => right.weight - left.weight || left.key.localeCompare(right.key))
    .slice(0, limit)
    .map((region) => ({
      key: region.key,
      color: region.color,
      percentage: Math.round(region.percentage),
      ...(region.label ? { label: region.label } : {}),
      ...(region.emoji ? { emoji: region.emoji } : {}),
    }))
