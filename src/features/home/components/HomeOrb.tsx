import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ColorOrb as BlendedColorOrb } from '../../checkin/components/BlendedColorOrb'
import { buildColorHaloRing, simplifyColorOrbEntries, type ColorOrbEntry, type ColorHaloSegment } from '../../checkin/utils/colorOrb'

export type HomeOrbRenderer = 'CHECKIN_BLEND_ORB' | 'HALO_RING'
export type HomeOrbDensity = 'full' | 'simplified'

export const HOME_ORB_RENDERER: HomeOrbRenderer = 'CHECKIN_BLEND_ORB'

type HomeOrbProps = {
  entries: readonly ColorOrbEntry[]
  size?: 'small' | 'medium' | 'large'
  label: string
  controlledActiveKey?: string | null
  onHoverKeyChange?: (key: string | null) => void
  onSelectKeyChange?: (key: string | null) => void
  renderer?: HomeOrbRenderer
  density?: HomeOrbDensity
}

export function HomeOrb(props: HomeOrbProps) {
  const { renderer = HOME_ORB_RENDERER, density = 'full', size = 'large', entries, ...orbProps } = props
  const visualEntries = useMemo(() => density === 'simplified' ? simplifyColorOrbEntries(entries) : entries, [density, entries])
  const sizedOrbProps = { ...orbProps, entries: visualEntries, size }
  return renderer === 'CHECKIN_BLEND_ORB' ? <BlendedColorOrb {...sizedOrbProps} /> : <HaloRingOrb {...sizedOrbProps} />
}

function HaloRingOrb({ entries, size = 'large', label, controlledActiveKey, onHoverKeyChange, onSelectKeyChange }: HomeOrbProps) {
  const ring = useMemo(() => buildColorHaloRing(entries), [entries])
  const hasData = ring.segments.length > 0
  const id = useId().replaceAll(':', '')
  const tooltipId = `halo-tooltip-${id}`
  const shellRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const isKnownSegment = (key: string | null): key is string => Boolean(key && ring.segments.some((segment) => segment.key === key))
  const localActiveKey = (isKnownSegment(selectedKey) ? selectedKey : null) ?? (isKnownSegment(focusedKey) ? focusedKey : null) ?? (isKnownSegment(hoveredKey) ? hoveredKey : null)
  const activeKey = (isKnownSegment(controlledActiveKey ?? null) ? controlledActiveKey : null) ?? localActiveKey
  const activeSegment = ring.segments.find((segment) => segment.key === activeKey)
  const [tooltipPosition, setTooltipPosition] = useState<CSSProperties | null>(null)

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
      if (event.key !== 'Escape') return
      setSelectedKey(null)
      onSelectKeyChange?.(null)
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
    if (!activeSegment || !tooltip || !shell) {
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
        const angle = activeSegment.labelAngle * Math.PI * 2
        const anchorX = shellBounds.left + (0.5 + Math.sin(angle) * 0.39) * shellBounds.width
        const anchorY = shellBounds.top + (0.5 - Math.cos(angle) * 0.39) * shellBounds.height
        const gap = 10
        const candidates = activeSegment.labelAngle < 0.5
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
        const left = Math.min(maxLeft, Math.max(minLeft, candidate.left)) - shellBounds.left
        const top = Math.min(maxTop, Math.max(minTop, candidate.top)) - shellBounds.top
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
  }, [activeSegment, activeSegment?.key, activeSegment?.labelAngle, activeSegment?.label, activeSegment?.labelEn, activeSegment?.percentage, size])

  const segmentAtPoint = (clientX: number, clientY: number): ColorHaloSegment | null => {
    const ringElement = ringRef.current
    if (!ringElement) return null
    const bounds = ringElement.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const distance = Math.hypot(clientX - centerX, clientY - centerY)
    const radius = bounds.width / 2
    if (!radius || distance < radius * 0.58 || distance > radius * 1.02) return null
    const angle = (Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI + 90 + 360) % 360 / 360
    return ring.segments.find((segment) => angle >= segment.start && angle < segment.end) ?? ring.segments.at(-1) ?? null
  }

  const selectSegment = (key: string) => {
    const nextKey = selectedKey === key || (selectedKey === null && controlledActiveKey === key) ? null : key
    setSelectedKey(nextKey)
    onSelectKeyChange?.(nextKey)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setSelectedKey(null)
      onSelectKeyChange?.(null)
      return
    }
    if (!hasData) return
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
      event.preventDefault()
      const currentIndex = Math.max(0, ring.segments.findIndex((segment) => segment.key === (focusedKey ?? activeKey)))
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      const nextKey = ring.segments[(currentIndex + step + ring.segments.length) % ring.segments.length].key
      setFocusedKey(nextKey)
      onHoverKeyChange?.(nextKey)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectSegment(focusedKey ?? activeKey ?? ring.segments[0].key)
    }
  }

  const positionForAngle = (angle: number): CSSProperties => {
    const radians = angle * Math.PI * 2
    return { left: `${50 + Math.sin(radians) * 39}%`, top: `${50 - Math.cos(radians) * 39}%` }
  }

  return (
    <div ref={shellRef} className={`color-orb-shell color-orb-shell--${size}`}>
      <div
        ref={ringRef}
        className={`color-orb color-orb--${size} color-halo-ring ${hasData ? 'is-vivid' : 'is-empty'}`}
        role="img"
        aria-label={label ?? 'Color Halo Ring'}
        aria-describedby={activeSegment ? tooltipId : undefined}
        tabIndex={hasData ? 0 : -1}
        style={{ background: ring.gradient, '--color-halo-gradient': ring.gradient } as CSSProperties}
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          const segment = segmentAtPoint(event.clientX, event.clientY)
          const nextKey = segment?.key ?? null
          if (hoveredKey !== nextKey) {
            setHoveredKey(nextKey)
            onHoverKeyChange?.(nextKey)
          }
        }}
        onPointerLeave={() => {
          setHoveredKey(null)
          onHoverKeyChange?.(null)
        }}
        onFocus={() => {
          const nextKey = isKnownSegment(focusedKey) ? focusedKey : ring.segments[0]?.key ?? null
          setFocusedKey(nextKey)
          onHoverKeyChange?.(nextKey)
        }}
        onBlur={() => {
          setFocusedKey(null)
          onHoverKeyChange?.(null)
        }}
        onClick={(event) => {
          const segment = segmentAtPoint(event.clientX, event.clientY)
          if (segment) selectSegment(segment.key)
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="color-halo-ring__inner" aria-hidden="true" />
        {activeSegment && <span className="color-halo-ring__active-arc" aria-hidden="true" style={{ '--halo-active-start': `${activeSegment.start * 360}deg`, '--halo-active-end': `${activeSegment.end * 360}deg` } as CSSProperties} />}
        {ring.segments.filter((segment) => segment.showLabel).map((segment) => <span className="color-halo-ring__label" key={segment.key} style={{ ...positionForAngle(segment.labelAngle), color: segment.labelColor }}>{Math.round(segment.percentage)}%</span>)}
        {!hasData && <span className="color-halo-ring__empty-label">Chưa có màu cảm xúc</span>}
      </div>
      {activeSegment && <div ref={tooltipRef} id={tooltipId} className="color-orb__tooltip" role="tooltip" style={tooltipPosition ?? { left: '50%', top: '50%' }}>
        <span className="color-orb__tooltip-accent" style={{ background: activeSegment.color }} />
        <strong>{activeSegment.emoji && <span aria-hidden="true">{activeSegment.emoji} </span>}{activeSegment.label ?? 'Cảm xúc'}</strong>
        {activeSegment.labelEn && <small>{activeSegment.labelEn}</small>}
        <span>{Math.round(activeSegment.percentage)}% hiện diện</span>
      </div>}
    </div>
  )
}
