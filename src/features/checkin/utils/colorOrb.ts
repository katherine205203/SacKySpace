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
  return buildColorOrbRegionsFromColors(
    records
      .filter((record) => record.checkinType === 'emotion' && record.primaryEmotion)
      .map((record) => ({ color: record.primaryEmotion!.color_hex, intensity: record.intensity ?? 1 })),
  )
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
