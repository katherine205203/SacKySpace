import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { buildColorHaloRing, type ColorOrbEntry, type ColorHaloSegment } from '../../checkin/utils/colorOrb'

type HomeOrbProps = {
  entries: readonly ColorOrbEntry[]
  size?: 'small' | 'medium' | 'large'
  label: string
  controlledActiveKey?: string | null
  onHoverKeyChange?: (key: string | null) => void
  onSelectKeyChange?: (key: string | null) => void
}

export function HomeOrb({ entries, size = 'large', label, controlledActiveKey, onHoverKeyChange, onSelectKeyChange }: HomeOrbProps) {
  const ring = useMemo(() => buildColorHaloRing(entries), [entries])
  const hasData = ring.segments.length > 0
  const id = useId().replaceAll(':', '')
  const tooltipId = `halo-tooltip-${id}`
  const shellRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const isKnownSegment = (key: string | null): key is string => Boolean(key && ring.segments.some((segment) => segment.key === key))
  const localActiveKey = (isKnownSegment(selectedKey) ? selectedKey : null) ?? (isKnownSegment(focusedKey) ? focusedKey : null) ?? (isKnownSegment(hoveredKey) ? hoveredKey : null)
  const activeKey = (isKnownSegment(controlledActiveKey ?? null) ? controlledActiveKey : null) ?? localActiveKey
  const activeSegment = ring.segments.find((segment) => segment.key === activeKey)

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
      {activeSegment && <div id={tooltipId} className="color-orb__tooltip" role="tooltip">
        <span className="color-orb__tooltip-accent" style={{ background: activeSegment.color }} />
        <strong>{activeSegment.emoji && <span aria-hidden="true">{activeSegment.emoji} </span>}{activeSegment.label ?? 'Cảm xúc'}</strong>
        {activeSegment.labelEn && <small>{activeSegment.labelEn}</small>}
        <span>{Math.round(activeSegment.percentage)}% hiện diện</span>
      </div>}
    </div>
  )
}
