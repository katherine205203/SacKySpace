import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { buildColorOrbField, oklabToRgb, ORB_RADIUS, ORB_VIEW_SIZE, sampleColorOrbField, type ColorOrbEntry, type OrbField, type OrbRegion } from '../utils/colorOrb'

type OrbCanvasCache = {
  baseImage: ImageData
  hitMap: Uint8Array
  mapSize: number
}

const clampCanvasChannel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)))
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const drawOrbCanvas = (canvas: HTMLCanvasElement, field: OrbField): OrbCanvasCache | null => {
  const visibleSize = canvas.getBoundingClientRect().width || canvas.clientWidth || 200
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const displaySize = Math.max(1, Math.round(visibleSize * devicePixelRatio))
  const internalSize = Math.min(1440, Math.max(360, Math.round(visibleSize * 3)))
  const highResolutionCanvas = document.createElement('canvas')
  highResolutionCanvas.width = internalSize
  highResolutionCanvas.height = internalSize
  const highResolutionContext = highResolutionCanvas.getContext('2d')
  const displayContext = canvas.getContext('2d')
  if (!highResolutionContext || !displayContext) return null

  const image = highResolutionContext.createImageData(internalSize, internalSize)
  const pixels = image.data
  for (let row = 0; row < internalSize; row += 1) {
    for (let column = 0; column < internalSize; column += 1) {
      const x = ((column + 0.5) / internalSize) * ORB_VIEW_SIZE
      const y = ((row + 0.5) / internalSize) * ORB_VIEW_SIZE
      const distance = Math.hypot(x - ORB_VIEW_SIZE / 2, y - ORB_VIEW_SIZE / 2)
      if (distance > ORB_RADIUS) continue
      const pixelOffset = (row * internalSize + column) * 4
      if (!field.regions.length) {
        const highlight = Math.max(0, 1 - Math.hypot(x - 70, y - 58) / 150)
        pixels[pixelOffset] = clampCanvasChannel(236 + highlight * 10)
        pixels[pixelOffset + 1] = clampCanvasChannel(230 + highlight * 11)
        pixels[pixelOffset + 2] = clampCanvasChannel(247 + highlight * 8)
      } else {
        const sample = sampleColorOrbField(field, x, y)
        if (sample.primaryIndex < 0) continue
        const primary = field.regions[sample.primaryIndex]
        const secondary = sample.secondaryIndex >= 0 ? field.regions[sample.secondaryIndex] : null
        const color = secondary && sample.blend > 0
          ? {
              l: primary.colorLab.l + (secondary.colorLab.l - primary.colorLab.l) * sample.blend,
              a: primary.colorLab.a + (secondary.colorLab.a - primary.colorLab.a) * sample.blend,
              b: primary.colorLab.b + (secondary.colorLab.b - primary.colorLab.b) * sample.blend,
            }
          : primary.colorLab
        const sheen = Math.max(0, Math.min(1, 0.55 - ((x - 100) / ORB_RADIUS) * 0.22 - ((y - 100) / ORB_RADIUS) * 0.34))
        const rgb = oklabToRgb({ ...color, l: Math.min(1, Math.max(0, color.l + (sheen - 0.5) * 0.024)) })
        const edgeAlpha = distance > ORB_RADIUS - 1.4 ? Math.min(1, Math.max(0, (ORB_RADIUS - distance) / 1.4)) : 1
        pixels[pixelOffset] = rgb[0]
        pixels[pixelOffset + 1] = rgb[1]
        pixels[pixelOffset + 2] = rgb[2]
        pixels[pixelOffset + 3] = Math.round(edgeAlpha * 255)
      }
      if (!field.regions.length) pixels[pixelOffset + 3] = distance > ORB_RADIUS - 1.4 ? Math.round(Math.min(1, Math.max(0, (ORB_RADIUS - distance) / 1.4)) * 255) : 255
    }
  }
  highResolutionContext.putImageData(image, 0, 0)

  if (field.regions.length) {
    const fontFamily = getComputedStyle(canvas).fontFamily || 'sans-serif'
    highResolutionContext.font = `850 ${internalSize * 0.04}px ${fontFamily}`
    highResolutionContext.textAlign = 'center'
    highResolutionContext.textBaseline = 'middle'
    field.regions.filter((region) => region.showLabel).forEach((region) => {
      highResolutionContext.fillStyle = region.labelColor
      highResolutionContext.fillText(`${Math.round(region.percentage)}%`, (region.labelX / ORB_VIEW_SIZE) * internalSize, (region.labelY / ORB_VIEW_SIZE) * internalSize)
    })
  }

  highResolutionContext.beginPath()
  highResolutionContext.arc(internalSize / 2, internalSize / 2, (ORB_RADIUS / ORB_VIEW_SIZE) * internalSize - internalSize / 200, 0, Math.PI * 2)
  highResolutionContext.strokeStyle = 'rgba(255,255,255,.82)'
  highResolutionContext.lineWidth = internalSize / ORB_VIEW_SIZE * 1.05
  highResolutionContext.stroke()

  canvas.width = displaySize
  canvas.height = displaySize
  displayContext.imageSmoothingEnabled = true
  displayContext.clearRect(0, 0, displaySize, displaySize)
  displayContext.drawImage(highResolutionCanvas, 0, 0, internalSize, internalSize, 0, 0, displaySize, displaySize)
  const baseImage = displayContext.getImageData(0, 0, displaySize, displaySize)
  const hitMap = new Uint8Array(displaySize * displaySize)
  for (let row = 0; row < displaySize; row += 1) {
    for (let column = 0; column < displaySize; column += 1) {
      const sample = sampleColorOrbField(field, ((column + 0.5) / displaySize) * ORB_VIEW_SIZE, ((row + 0.5) / displaySize) * ORB_VIEW_SIZE)
      hitMap[row * displaySize + column] = sample.primaryIndex >= 0 ? sample.primaryIndex + 1 : 0
    }
  }
  return { baseImage, hitMap, mapSize: displaySize }
}

const paintOrbPresentation = (canvas: HTMLCanvasElement, cache: OrbCanvasCache, activeIndex: number): void => {
  const context = canvas.getContext('2d')
  if (!context) return
  if (activeIndex < 0) {
    context.putImageData(cache.baseImage, 0, 0)
    return
  }
  const image = context.createImageData(cache.baseImage.width, cache.baseImage.height)
  image.data.set(cache.baseImage.data)
  for (let index = 0; index < cache.hitMap.length; index += 1) {
    const regionSlot = cache.hitMap[index]
    if (!regionSlot) continue
    const pixelOffset = index * 4
    if (regionSlot === activeIndex + 1) {
      const average = (image.data[pixelOffset] + image.data[pixelOffset + 1] + image.data[pixelOffset + 2]) / 3
      image.data[pixelOffset] = clampCanvasChannel(average + (image.data[pixelOffset] - average) * 1.08 + 3)
      image.data[pixelOffset + 1] = clampCanvasChannel(average + (image.data[pixelOffset + 1] - average) * 1.08 + 3)
      image.data[pixelOffset + 2] = clampCanvasChannel(average + (image.data[pixelOffset + 2] - average) * 1.08 + 3)
    } else {
      image.data[pixelOffset] = clampCanvasChannel(image.data[pixelOffset] * 0.9)
      image.data[pixelOffset + 1] = clampCanvasChannel(image.data[pixelOffset + 1] * 0.9)
      image.data[pixelOffset + 2] = clampCanvasChannel(image.data[pixelOffset + 2] * 0.9)
    }
  }
  context.putImageData(image, 0, 0)
}

type TooltipPosition = CSSProperties

type ColorOrbProps = {
  entries: readonly ColorOrbEntry[]
  size?: 'small' | 'medium' | 'large'
  label?: string
  controlledActiveKey?: string | null
  onHoverKeyChange?: (key: string | null) => void
  onSelectKeyChange?: (key: string | null) => void
}

export function ColorOrb({ entries, size = 'medium', label, controlledActiveKey, onHoverKeyChange, onSelectKeyChange }: ColorOrbProps) {
  const field = useMemo(() => buildColorOrbField(entries), [entries])
  const hasData = field.regions.length > 0
  const id = useId().replaceAll(':', '')
  const tooltipId = `orb-tooltip-${id}`
  const shellRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<OrbCanvasCache | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const isKnownRegion = (key: string | null): key is string => Boolean(key && field.regions.some((region) => region.key === key))
  const localActiveKey = (isKnownRegion(selectedKey) ? selectedKey : null) ?? (isKnownRegion(focusedKey) ? focusedKey : null) ?? (isKnownRegion(hoveredKey) ? hoveredKey : null)
  const resolvedControlledKey = controlledActiveKey ?? null
  const activeKey = (isKnownRegion(resolvedControlledKey) ? resolvedControlledKey : null) ?? localActiveKey
  const activeKeyRef = useRef<string | null>(null)
  const activeRegion = field.regions.find((region) => region.key === activeKey)

  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const render = () => {
      cacheRef.current = drawOrbCanvas(canvas, field)
      if (cacheRef.current) {
        const activeIndex = activeKeyRef.current ? field.regions.findIndex((region) => region.key === activeKeyRef.current) : -1
        paintOrbPresentation(canvas, cacheRef.current, activeIndex)
      }
    }
    render()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(render)
    resizeObserver?.observe(canvas)
    window.addEventListener('resize', render)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', render)
    }
  }, [field, size])

  useEffect(() => {
    const canvas = canvasRef.current
    const cache = cacheRef.current
    if (!canvas || !cache) return
    const activeIndex = activeKey ? field.regions.findIndex((region) => region.key === activeKey) : -1
    paintOrbPresentation(canvas, cache, activeIndex)
  }, [activeKey, field])

  useEffect(() => {
    if (!selectedKey && !controlledActiveKey) return undefined
    const clearSelection = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setSelectedKey(null)
        onSelectKeyChange?.(null)
        onHoverKeyChange?.(null)
      }
    }
    const clearWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedKey(null)
        onSelectKeyChange?.(null)
      }
    }
    document.addEventListener('pointerdown', clearSelection)
    document.addEventListener('keydown', clearWithEscape)
    return () => {
      document.removeEventListener('pointerdown', clearSelection)
      document.removeEventListener('keydown', clearWithEscape)
    }
  }, [controlledActiveKey, onHoverKeyChange, onSelectKeyChange, selectedKey])

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const shell = shellRef.current
    if (!activeRegion || !tooltip || !shell) {
      setTooltipPosition(null)
      return undefined
    }

    let frame = 0
    const positionTooltip = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const shellBounds = shell.getBoundingClientRect()
        const tooltipBounds = tooltip.getBoundingClientRect()
        if (!shellBounds.width || !shellBounds.height || !tooltipBounds.width || !tooltipBounds.height) return
        const container = shell.closest<HTMLElement>('.home-v2__card, .summary-rail')
        const containerBounds = container?.getBoundingClientRect()
        const padding = 8
        const minLeft = Math.max(padding, containerBounds?.left ?? 0, 0)
        const minTop = Math.max(padding, containerBounds?.top ?? 0, 0)
        const maxRight = Math.min(window.innerWidth - padding, containerBounds?.right ?? window.innerWidth - padding)
        const maxBottom = Math.min(window.innerHeight - padding, containerBounds?.bottom ?? window.innerHeight - padding)
        const anchorX = shellBounds.left + clamp(activeRegion.labelX / ORB_VIEW_SIZE, 0.1, 0.9) * shellBounds.width
        const anchorY = shellBounds.top + clamp(activeRegion.labelY / ORB_VIEW_SIZE, 0.1, 0.9) * shellBounds.height
        const gap = 10
        const candidates = activeRegion.labelY < ORB_VIEW_SIZE / 2
          ? [
              { left: anchorX - tooltipBounds.width / 2, top: anchorY - tooltipBounds.height - gap },
              { left: anchorX - tooltipBounds.width / 2, top: anchorY + gap },
              { left: anchorX + gap, top: anchorY - tooltipBounds.height / 2 },
              { left: anchorX - tooltipBounds.width - gap, top: anchorY - tooltipBounds.height / 2 },
            ]
          : [
              { left: anchorX - tooltipBounds.width / 2, top: anchorY + gap },
              { left: anchorX - tooltipBounds.width / 2, top: anchorY - tooltipBounds.height - gap },
              { left: anchorX + gap, top: anchorY - tooltipBounds.height / 2 },
              { left: anchorX - tooltipBounds.width - gap, top: anchorY - tooltipBounds.height / 2 },
            ]
        const fits = (candidate: { left: number; top: number }) => candidate.left >= minLeft && candidate.top >= minTop && candidate.left + tooltipBounds.width <= maxRight && candidate.top + tooltipBounds.height <= maxBottom
        const candidate = candidates.find(fits) ?? candidates[0]
        const maxLeft = Math.max(minLeft, maxRight - tooltipBounds.width)
        const maxTop = Math.max(minTop, maxBottom - tooltipBounds.height)
        const left = clamp(candidate.left, minLeft, maxLeft) - shellBounds.left
        const top = clamp(candidate.top, minTop, maxTop) - shellBounds.top
        setTooltipPosition({ left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, transform: 'none' })
      })
    }
    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(positionTooltip)
    resizeObserver?.observe(shell)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', positionTooltip)
      resizeObserver?.disconnect()
    }
  }, [activeRegion, activeRegion?.key, activeRegion?.labelX, activeRegion?.labelY, activeRegion?.label, activeRegion?.labelEn, activeRegion?.percentage, size])

  const selectTerritory = (key: string) => {
    const nextKey = selectedKey === key || (selectedKey === null && controlledActiveKey === key) ? null : key
    setSelectedKey(nextKey)
    onSelectKeyChange?.(nextKey)
  }
  const regionAtPoint = (clientX: number, clientY: number): OrbRegion | null => {
    const canvas = canvasRef.current
    const cache = cacheRef.current
    if (!canvas || !cache) return null
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    const column = Math.floor(((clientX - bounds.left) / bounds.width) * cache.mapSize)
    const row = Math.floor(((clientY - bounds.top) / bounds.height) * cache.mapSize)
    if (column < 0 || row < 0 || column >= cache.mapSize || row >= cache.mapSize) return null
    const slot = cache.hitMap[row * cache.mapSize + column]
    return slot ? field.regions[slot - 1] ?? null : null
  }
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const region = regionAtPoint(event.clientX, event.clientY)
    const nextKey = region?.key ?? null
    if (hoveredKey !== nextKey) {
      setHoveredKey(nextKey)
      onHoverKeyChange?.(nextKey)
    }
  }
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Escape') {
      setSelectedKey(null)
      return
    }
    if (!field.regions.length) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const currentIndex = Math.max(0, field.regions.findIndex((region) => region.key === (focusedKey ?? activeKey)))
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + step + field.regions.length) % field.regions.length
      setFocusedKey(field.regions[nextIndex].key)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const region = field.regions.find((item) => item.key === (focusedKey ?? activeKey)) ?? field.regions[0]
      selectTerritory(region.key)
    }
  }

  return <div ref={shellRef} className={`color-orb-shell color-orb-shell--${size}`}>
    <canvas
      ref={canvasRef}
      className={`color-orb color-orb--${size} ${hasData ? 'is-vivid' : 'is-empty'}`}
      role="img"
      aria-label={label ?? 'Color Orb'}
      aria-describedby={activeRegion ? tooltipId : undefined}
      tabIndex={hasData ? 0 : -1}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => { setHoveredKey(null); onHoverKeyChange?.(null) }}
      onFocus={() => {
        const nextKey = isKnownRegion(focusedKey) ? focusedKey : field.regions[0]?.key ?? null
        setFocusedKey(nextKey)
        onHoverKeyChange?.(nextKey)
      }}
      onBlur={() => { setFocusedKey(null); onHoverKeyChange?.(null) }}
      onClick={(event) => {
        const region = regionAtPoint(event.clientX, event.clientY)
        if (region) selectTerritory(region.key)
      }}
      onKeyDown={handleKeyDown}
    />
    {activeRegion && <div ref={tooltipRef} id={tooltipId} className="color-orb__tooltip" role="tooltip" style={tooltipPosition ?? { left: `${clamp(activeRegion.labelX / 2, 28, 72)}%`, top: `${clamp(activeRegion.labelY / 2, 28, 72)}%` }}>
      <span className="color-orb__tooltip-accent" style={{ background: activeRegion.color }} />
      <strong>{activeRegion.emoji && <span aria-hidden="true">{activeRegion.emoji} </span>}{activeRegion.label ?? 'Cảm xúc'}</strong>
      {activeRegion.labelEn && <small>{activeRegion.labelEn}</small>}
      <span>{Math.round(activeRegion.percentage)}% hiện diện hôm nay</span>
    </div>}
  </div>
}
