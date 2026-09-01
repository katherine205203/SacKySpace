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
 * Builds overlapping radial cloud layers for the canonical ColorOrb renderer.
 * Intensity controls each color's total visual presence, while all tonal
 * variants remain derived from the same source color.
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
    const centerX = 100 + Math.cos(angle) * 27
    const centerY = 100 + Math.sin(angle) * 27
    const auraRadius = 62 + contribution * 12
    const coreRadius = 39 + contribution * 13
    const amplitude = 10 + contribution * 10
    const light = tint(source, .18)
    const soft = tint(source, .48)
    const deep = shade(source, .18)
    return [
      { color: source, x: centerX, y: centerY, radius: auraRadius, opacity: .18 + contribution * .1, blur: 3.4, blendMode: 'normal' },
      { color: source, x: centerX, y: centerY, radius: coreRadius, opacity: .88 + contribution * .08, blur: .4, blendMode: 'normal' },
      { color: light, x: centerX + amplitude, y: centerY - amplitude, radius: 34 + contribution * 7, opacity: .24 + contribution * .1, blur: 1.2, blendMode: 'normal' },
      { color: soft, x: centerX - amplitude * .8, y: centerY - amplitude * .4, radius: 27 + contribution * 6, opacity: .16 + contribution * .08, blur: 1.8, blendMode: 'normal' },
      { color: deep, x: centerX - amplitude, y: centerY + amplitude, radius: 31 + contribution * 7, opacity: .34 + contribution * .16, blur: .9, blendMode: 'normal' },
      { color: '#FFFFFF', x: centerX + amplitude * .15, y: centerY - amplitude * 1.2, radius: 18 + contribution * 4, opacity: .12 + contribution * .05, blur: .6, blendMode: 'screen' },
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

const organicPath = (start: number, end: number, index: number): string => {
  const left = 0
  const right = 200
  const amplitude = 15 + (index % 3) * 6
  const phase = index * 17
  const wave = (x: number, offset: number) =>
    100 + offset + Math.sin((x + phase) / 28) * amplitude + Math.sin((x + phase) / 13) * 5
  const top = wave(left, (start - 0.5) * 170)
  const topMid = wave(100, (start - 0.5) * 170)
  const topRight = wave(right, (start - 0.5) * 170)
  const bottom = wave(left, (end - 0.5) * 170)
  const bottomMid = wave(100, (end - 0.5) * 170)
  const bottomRight = wave(right, (end - 0.5) * 170)
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
  return sorted.map((item, index) => {
    const start = cursor
    cursor += item.weight / total
    return {
      color: item.color,
      weight: item.weight,
      start,
      end: cursor,
      path: organicPath(start, cursor, index),
    }
  })
}
