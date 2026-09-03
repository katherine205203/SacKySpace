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
  labelEn?: string
  emoji?: string
  emotionId?: string
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

const GRID_SIZE = 52
const ORB_CENTER = 100
const ORB_RADIUS = 96
const GRID_RADIUS = 94
const EPSILON = 0.000001

type Point = { x: number; y: number }
type Seed = Point & { index: number }
type LabColor = { l: number; a: number; b: number }
type AggregatedEntry = ColorOrbEntry & { key: string; weight: number; index: number }

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

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

const hexToRgb = (hex: string): [number, number, number] => {
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

const makeSeeds = (entries: readonly AggregatedEntry[]): Seed[] => {
  const angleStep = Math.PI * (3 - Math.sqrt(5))
  return entries.map((entry, index) => {
    const random = stableHash(`${entry.key}:seed`)
    const angle = -Math.PI * 0.8 + index * angleStep + (random - 0.5) * 0.52
    const radius = entries.length === 1 ? 0 : 38 + random * 20
    return {
      index,
      x: ORB_CENTER + Math.cos(angle) * radius,
      y: ORB_CENTER + Math.sin(angle) * radius,
    }
  })
}

const cellCenter = (column: number, row: number): Point => ({
  x: ((column + 0.5) / GRID_SIZE) * ORB_RADIUS * 2 + (ORB_CENTER - ORB_RADIUS),
  y: ((row + 0.5) / GRID_SIZE) * ORB_RADIUS * 2 + (ORB_CENTER - ORB_RADIUS),
})

const isInsideDisc = (point: Point): boolean => Math.hypot(point.x - ORB_CENTER, point.y - ORB_CENTER) <= GRID_RADIUS

const pointKey = (point: Point): string => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`

const organicPoint = (point: Point, entryKey: string): Point => {
  const dx = point.x - ORB_CENTER
  const dy = point.y - ORB_CENTER
  const radius = Math.hypot(dx, dy)
  if (radius < EPSILON || radius > GRID_RADIUS - 3) {
    if (radius > GRID_RADIUS - 3) {
      const angle = Math.atan2(dy, dx)
      const nudge = Math.sin(angle * 4.7 + stableHash(entryKey) * Math.PI * 2) * 1.05
      const nextRadius = GRID_RADIUS - 0.7 + nudge
      return { x: ORB_CENTER + Math.cos(angle) * nextRadius, y: ORB_CENTER + Math.sin(angle) * nextRadius }
    }
    return point
  }
  const angle = Math.atan2(dy, dx)
  const nudge = Math.sin(angle * 3.2 + stableHash(entryKey) * Math.PI * 2) * 0.9
  const nextRadius = Math.min(GRID_RADIUS - 1, radius + nudge)
  return { x: ORB_CENTER + (dx / radius) * nextRadius, y: ORB_CENTER + (dy / radius) * nextRadius }
}

const roundedPolygonPath = (points: readonly Point[]): string => {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const point = points[0]
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} Q ${(point.x + 1).toFixed(2)} ${point.y.toFixed(2)} ${point.x.toFixed(2)} ${(point.y + 1).toFixed(2)} Q ${(point.x - 1).toFixed(2)} ${point.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)} Z`
  }
  const first = points[0]
  const last = points[points.length - 1]
  const start = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 }
  const commands = [`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`]
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
    commands.push(`Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${midpoint.x.toFixed(2)} ${midpoint.y.toFixed(2)}`)
  })
  return `${commands.join(' ')} Z`
}

const fullDiscPath = (): string => 'M 100 4 Q 100 4 100 4 A 96 96 0 1 1 99.99 4 Q 100 4 100 4 Z'

const getLabelColor = (color: string): '#FFFFFF' | '#231B46' => hexToOklab(color).l < 0.72 ? '#FFFFFF' : '#231B46'

const getBoundaryPoints = (
  regionIndex: number,
  cells: readonly number[][],
  entry: AggregatedEntry,
  cellSize: number,
): Point[] => {
  const points = new Map<string, Point>()
  const addPoint = (point: Point) => {
    if (!isInsideDisc(point) && Math.hypot(point.x - ORB_CENTER, point.y - ORB_CENTER) < GRID_RADIUS + 4) return
    const adjusted = organicPoint(point, entry.key)
    points.set(pointKey(adjusted), adjusted)
  }
  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    if (cell !== regionIndex) return
    const x = (ORB_CENTER - ORB_RADIUS) + columnIndex * cellSize
    const y = (ORB_CENTER - ORB_RADIUS) + rowIndex * cellSize
    const top = rowIndex === 0 ? -1 : cells[rowIndex - 1][columnIndex]
    const right = columnIndex === GRID_SIZE - 1 ? -1 : row[columnIndex + 1]
    const bottom = rowIndex === GRID_SIZE - 1 ? -1 : cells[rowIndex + 1][columnIndex]
    const left = columnIndex === 0 ? -1 : row[columnIndex - 1]
    if (top !== regionIndex) { addPoint({ x, y }); addPoint({ x: x + cellSize, y }) }
    if (right !== regionIndex) { addPoint({ x: x + cellSize, y }); addPoint({ x: x + cellSize, y: y + cellSize }) }
    if (bottom !== regionIndex) { addPoint({ x: x + cellSize, y: y + cellSize }); addPoint({ x, y: y + cellSize }) }
    if (left !== regionIndex) { addPoint({ x, y: y + cellSize }); addPoint({ x, y }) }
  }))
  return [...points.values()]
}

const assignCells = (entries: readonly AggregatedEntry[], seeds: readonly Seed[]): number[][] => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  const proportions = entries.map((entry) => entry.weight / totalWeight)
  const cells = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => -1))
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const point = cellCenter(column, row)
      if (!isInsideDisc(point)) continue
      let selected = 0
      let selectedScore = Number.POSITIVE_INFINITY
      seeds.forEach((seed, index) => {
        const distance = Math.hypot(point.x - seed.x, point.y - seed.y)
        const affinity = Math.sqrt(Math.max(proportions[index], 0.01))
        const score = distance / (0.22 + affinity * 1.62) + stableHash(entries[index].key) * 0.00001
        if (score < selectedScore) {
          selectedScore = score
          selected = index
        }
      })
      cells[row][column] = selected
    }
  }
  entries.forEach((_, index) => {
    if (cells.some((row) => row.includes(index))) return
    let closest: { column: number; row: number; distance: number } | null = null
    for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < GRID_SIZE; columnIndex += 1) {
        if (cells[rowIndex][columnIndex] < 0) continue
        const point = cellCenter(columnIndex, rowIndex)
        const distance = Math.hypot(point.x - seeds[index].x, point.y - seeds[index].y)
        if (!closest || distance < closest.distance) closest = { column: columnIndex, row: rowIndex, distance }
      }
    }
    if (closest !== null) {
      const nearestCell = closest
      cells[nearestCell.row][nearestCell.column] = index
    }
  })
  return cells
}

const getCellCentroid = (regionIndex: number, cells: readonly number[][]): Point => {
  const points: Point[] = []
  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    if (cell === regionIndex) points.push(cellCenter(columnIndex, rowIndex))
  }))
  if (points.length === 0) return { x: ORB_CENTER, y: ORB_CENTER }
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 })
}

const getEdgeOpacity = (regionIndex: number, entries: readonly AggregatedEntry[], cells: readonly number[][]): number => {
  const neighbors = new Set<number>()
  cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    if (cell !== regionIndex) return
    const candidates = [rowIndex > 0 ? cells[rowIndex - 1][columnIndex] : -1, columnIndex < GRID_SIZE - 1 ? row[columnIndex + 1] : -1, rowIndex < GRID_SIZE - 1 ? cells[rowIndex + 1][columnIndex] : -1, columnIndex > 0 ? row[columnIndex - 1] : -1]
    candidates.forEach((candidate) => { if (candidate >= 0 && candidate !== regionIndex) neighbors.add(candidate) })
  }))
  if (neighbors.size === 0) return 0.34
  const nearestDistance = Math.min(...[...neighbors].map((index) => colorDistance(entries[regionIndex].color, entries[index].color)))
  return 0.2 + clamp((nearestDistance - 0.035) / 0.42, 0, 1) * 0.38
}

export const buildColorOrbRegionsFromColors = (entries: readonly ColorOrbEntry[]): OrbRegion[] => {
  const aggregated = orderByColorAffinity(aggregateEntries(entries))
  if (aggregated.length === 0) return []
  const totalWeight = aggregated.reduce((sum, entry) => sum + entry.weight, 0)
  if (aggregated.length === 1) {
    const entry = aggregated[0]
    return [{
      key: entry.key,
      color: entry.color,
      weight: entry.weight,
      percentage: 100,
      start: 0,
      end: 1,
      path: fullDiscPath(),
      labelX: ORB_CENTER,
      labelY: ORB_CENTER,
      labelColor: getLabelColor(entry.color),
      showLabel: true,
      edgeOpacity: 0.35,
      ...(entry.emotionId ? { emotionId: entry.emotionId } : {}),
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
      ...(entry.emoji ? { emoji: entry.emoji } : {}),
    }]
  }

  const seeds = makeSeeds(aggregated)
  const cells = assignCells(aggregated, seeds)
  const cellSize = (ORB_RADIUS * 2) / GRID_SIZE
  let cursor = 0
  return aggregated.map((entry, index) => {
    const percentage = (entry.weight / totalWeight) * 100
    const centroid = getCellCentroid(index, cells)
    const boundary = getBoundaryPoints(index, cells, entry, cellSize)
    const sortedBoundary = boundary.sort((left, right) => Math.atan2(left.y - centroid.y, left.x - centroid.x) - Math.atan2(right.y - centroid.y, right.x - centroid.x))
    const start = cursor
    cursor += entry.weight / totalWeight
    return {
      key: entry.key,
      color: entry.color,
      weight: entry.weight,
      percentage,
      start,
      end: index === aggregated.length - 1 ? 1 : cursor,
      path: roundedPolygonPath(sortedBoundary),
      labelX: clamp(centroid.x, 22, 178),
      labelY: clamp(centroid.y, 22, 178),
      labelColor: getLabelColor(entry.color),
      showLabel: percentage >= 7.5,
      edgeOpacity: getEdgeOpacity(index, aggregated, cells),
      ...(entry.emotionId ? { emotionId: entry.emotionId } : {}),
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
      ...(entry.emoji ? { emoji: entry.emoji } : {}),
    }
  })
}

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
