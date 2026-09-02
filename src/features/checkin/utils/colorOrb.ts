import type { CheckinRecord } from '../types'

export type OrbRegion = {
  color: string
  weight: number
  start: number
  end: number
  path: string
}

type WeightedColor = {
  color: string
  weight: number
  hue: number
}

export type OrbCloud = {
  color: string
  x: number
  y: number
  radius: number
  opacity: number
  blur: number
  blendMode: 'normal' | 'screen'
}

const normalizeHex = (hex: string): string => /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : '#D9D0EA'

const hexToRgb = (hex: string): [number, number, number] => {
  const value = normalizeHex(hex).slice(1)
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

const rgbToHex = (red: number, green: number, blue: number): string =>
  `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`

const tint = (hex: string, amount: number): string => {
  const [red, green, blue] = hexToRgb(hex)
  return rgbToHex(red + (255 - red) * amount, green + (255 - green) * amount, blue + (255 - blue) * amount)
}

const shade = (hex: string, amount: number): string => {
  const [red, green, blue] = hexToRgb(hex)
  return rgbToHex(red * (1 - amount), green * (1 - amount), blue * (1 - amount))
}

/**
 * Builds the visual layers for the canonical ColorOrb renderer.
 * Intensity controls each territory's total visual presence, while all tonal
 * variants remain derived from the same source color. The pigment anchor is
 * intentionally crisp; only the outer aura gets a soft feather.
 */
export const buildOrbClouds = (
  entries: readonly { color: string; intensity: number }[],
): OrbCloud[] => {
  const weights = new Map<string, number>()
  for (const entry of entries) {
    const color = normalizeHex(entry.color)
    weights.set(color, (weights.get(color) ?? 0) + Math.max(entry.intensity, .25))
  }

  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0)
  if (!total) return []

  return [...weights.entries()].flatMap(([source, weight], index) => {
    const contribution = weight / total
    const angle = (index / Math.max(weights.size, 1)) * Math.PI * 2 - Math.PI / 2
    const centerX = 100 + Math.cos(angle) * (weights.size > 1 ? 35 : 0)
    const centerY = 100 + Math.sin(angle) * (weights.size > 1 ? 35 : 0)
    const auraRadius = 52 + contribution * 9
    const coreRadius = 31 + contribution * 10
    const amplitude = 7 + contribution * 7
    const light = tint(source, .14)
    const soft = tint(source, .34)
    const deep = shade(source, .1)
    return [
      { color: source, x: centerX, y: centerY, radius: auraRadius, opacity: .035 + contribution * .025, blur: 4.5, blendMode: 'normal' },
      // The core is the readable Color Territory: vivid, source-colour first.
      { color: source, x: centerX, y: centerY, radius: coreRadius, opacity: .96 + contribution * .04, blur: 0, blendMode: 'normal' },
      { color: light, x: centerX + amplitude, y: centerY - amplitude, radius: 23 + contribution * 5, opacity: .13 + contribution * .05, blur: .35, blendMode: 'normal' },
      { color: soft, x: centerX - amplitude * .65, y: centerY - amplitude * .55, radius: 16 + contribution * 4, opacity: .065 + contribution * .025, blur: .25, blendMode: 'normal' },
      { color: deep, x: centerX - amplitude * .8, y: centerY + amplitude * .8, radius: 20 + contribution * 5, opacity: .1 + contribution * .04, blur: .3, blendMode: 'normal' },
      { color: '#FFFFFF', x: centerX + amplitude * .2, y: centerY - amplitude * 1.1, radius: 13 + contribution * 3, opacity: .045 + contribution * .02, blur: .2, blendMode: 'screen' },
    ]
  })
}

const hueFromHex = (hex: string): number => {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return 0
  if (max === red) return ((green - blue) / delta) % 6 * 60
  if (max === green) return ((blue - red) / delta + 2) * 60
  return ((red - green) / delta + 4) * 60
}

const organicBoundary = (x: number, position: number): number => {
  const wave = Math.sin((x + 18) / 29) * 13 + Math.sin((x + 7) / 14) * 4
  return 100 + (position - .5) * 170 + wave
}

const organicPath = (start: number, end: number): string => {
  const left = 0
  const right = 200
  const top = organicBoundary(left, start)
  const topMid = organicBoundary(100, start)
  const topRight = organicBoundary(right, start)
  const bottom = organicBoundary(left, end)
  const bottomMid = organicBoundary(100, end)
  const bottomRight = organicBoundary(right, end)
  return `M ${left} ${top} Q 50 ${topMid - 18} 100 ${topMid} T ${right} ${topRight} L ${right} ${bottomRight} Q 150 ${bottomMid + 18} 100 ${bottomMid} T ${left} ${bottom} Z`
}

export const buildColorOrbRegions = (records: readonly CheckinRecord[]): OrbRegion[] => {
  return buildColorOrbRegionsFromColors(records.flatMap((record) => {
    if (record.checkinType !== 'emotion' || !record.primaryEmotion) return []
    return [{ color: record.primaryEmotion.color_hex, intensity: record.intensity ?? 1 }, ...record.secondaryEmotions.map((emotion) => ({ color: emotion.color_hex, intensity: 1 }))]
  }))
}

export const buildColorOrbRegionsFromColors = (
  entries: readonly { color: string; intensity: number }[],
): OrbRegion[] => {
  const weights = new Map<string, number>()
  for (const entry of entries) {
    const color = entry.color.toUpperCase()
    weights.set(color, (weights.get(color) ?? 0) + entry.intensity)
  }

  const sorted: WeightedColor[] = [...weights.entries()]
    .map(([color, weight]) => ({ color, weight, hue: hueFromHex(color) }))
    .sort((left, right) => left.hue - right.hue || left.color.localeCompare(right.color))
  const total = sorted.reduce((sum, item) => sum + item.weight, 0)
  if (!total) return []

  let cursor = 0
  return sorted.map((item) => {
    const start = cursor
    cursor += item.weight / total
    return {
      color: item.color,
      weight: item.weight,
      start,
      end: cursor,
      path: organicPath(start, cursor),
    }
  })
}
