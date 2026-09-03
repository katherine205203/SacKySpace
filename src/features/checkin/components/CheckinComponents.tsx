import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { CheckinDraft, Context, Emotion, EmotionFamily, Need, NeedGroup, ReferenceData } from '../types'
import { buildColorOrbField, oklabToRgb, ORB_RADIUS, ORB_VIEW_SIZE, sampleColorOrbField, type ColorOrbEntry, type OrbField, type OrbRegion } from '../utils/colorOrb'
import { PageHeading } from '../../../components/PageHeading'

export function CheckinTabs({ active }: { active: 'create' | 'history' }) {
  return <nav className="checkin-tabs" aria-label="Check-in sections"><NavLink className={active === 'create' ? 'is-active' : undefined} to="/checkin">Tạo check-in</NavLink><NavLink className={active === 'history' ? 'is-active' : undefined} to="/checkin/history">Lịch sử</NavLink></nav>
}

export function CheckinPageIntro({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy: string }) {
  return <div className="checkin-page-intro">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2><p>{copy}</p></div>
}

export function CheckinWorkspaceHeader({ active, eyebrow, title, copy, showTabs = false, action }: { active: 'create' | 'history'; eyebrow: string; title: string; copy: string; showTabs?: boolean; action?: ReactNode }) {
  return <PageHeading className="checkin-task-header" eyebrow={eyebrow} title={title} description={copy} actions={showTabs ? <CheckinTabs active={active} /> : action} />
}

export function StepProgress({ active }: { active: 'emotion' | 'secondary' | 'needs' | 'contexts' | 'review' | 'unknown' }) {
  const steps = [{ id: 'emotion', label: 'Cảm xúc chính' }, { id: 'secondary', label: 'Cảm xúc phụ' }, { id: 'needs', label: 'Nhu cầu' }, { id: 'contexts', label: 'Bối cảnh' }, { id: 'review', label: 'Xem lại' }] as const
  const activeIndex = active === 'unknown' ? -1 : steps.findIndex((step) => step.id === active)
  return <nav className="checkin-step-progress" aria-label="Tiến trình Check-in">{steps.map((step, index) => <span className={`checkin-step-progress__item ${step.id === active ? 'is-current' : ''} ${activeIndex >= 0 && index < activeIndex ? 'is-complete' : ''}`} key={step.id}><span className="checkin-step-progress__marker" aria-hidden="true">{activeIndex >= 0 && index < activeIndex ? '✓' : index + 1}</span><span>{step.label}</span></span>)}</nav>
}

type OrbCanvasCache = {
  baseImage: ImageData
  hitMap: Uint8Array
  mapSize: number
}

const clampCanvasChannel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)))

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
  const cacheRef = useRef<OrbCanvasCache | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
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
    {activeRegion && <div id={tooltipId} className="color-orb__tooltip" role="tooltip" style={{ left: `${Math.min(78, Math.max(22, activeRegion.labelX / 2))}%`, top: `${Math.min(72, Math.max(18, activeRegion.labelY / 2))}%` }}>
      <span className="color-orb__tooltip-accent" style={{ background: activeRegion.color }} />
      <strong>{activeRegion.emoji && <span aria-hidden="true">{activeRegion.emoji} </span>}{activeRegion.label ?? 'Cảm xúc'}</strong>
      {activeRegion.labelEn && <small>{activeRegion.labelEn}</small>}
      <span>{Math.round(activeRegion.percentage)}% hiện diện hôm nay</span>
    </div>}
  </div>
}

export function EmotionCard({ emotion, selected, disabled, onClick, multi = false }: { emotion: Emotion; selected: boolean; disabled?: boolean; onClick: () => void; multi?: boolean }) {
  const style = { '--semantic-color': emotion.color_hex } as CSSProperties
  return <button className={`inventory-card selection-tile ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} title={emotion.description_vn} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}><span className="inventory-card__emoji" aria-hidden="true">{emotion.emoji}</span><strong>{emotion.emotion_name_vn}</strong><span>{emotion.emotion_name_en}</span>{selected && <span className="selection-check" aria-label={multi ? 'Đã chọn cảm xúc phụ' : 'Đã chọn cảm xúc chính'}>✓</span>}</button>
}

export function NeedCard({ need, selected, disabled, onClick, onInfo }: { need: Need; selected: boolean; disabled?: boolean; onClick: () => void; onInfo?: () => void }) {
  const style = { '--semantic-color': need.color_hex } as CSSProperties
  return <div className="inventory-card-wrap"><button className={`inventory-card selection-tile inventory-card--descriptive ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}><span className="inventory-card__emoji" aria-hidden="true">{need.emoji}</span><strong>{need.need_name_vn}</strong>{selected && <span className="selection-check" aria-label="Đã chọn">✓</span>}</button>{onInfo && <button className="inventory-info" type="button" aria-haspopup="dialog" aria-label={`Xem mô tả: ${need.need_name_vn}`} onClick={(event) => { event.stopPropagation(); onInfo() }}>ⓘ</button>}</div>
}

export function ContextCard({ context, selected, disabled, onClick, onInfo }: { context: Context; selected: boolean; disabled?: boolean; onClick: () => void; onInfo?: () => void }) {
  const style = { '--semantic-color': context.color_hex } as CSSProperties
  return <div className="inventory-card-wrap"><button className={`inventory-card selection-tile inventory-card--descriptive ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}><span className="inventory-card__emoji" aria-hidden="true">{context.emoji}</span><strong>{context.context_name_vn}</strong>{selected && <span className="selection-check" aria-label="Đã chọn">✓</span>}</button>{onInfo && <button className="inventory-info" type="button" aria-haspopup="dialog" aria-label={`Xem mô tả: ${context.context_name_vn}`} onClick={(event) => { event.stopPropagation(); onInfo() }}>ⓘ</button>}</div>
}

export function EmotionFilters({ families, activeFamily, onFamilyChange }: { families: EmotionFamily[]; activeFamily: string; onFamilyChange: (id: string) => void }) {
  return <><button className={`filter-chip filter-chip--all ${activeFamily === 'all' ? 'is-active' : ''}`} type="button" onClick={() => onFamilyChange('all')}>Tất cả</button>{families.map((family) => <button key={family.emotion_family_id} className={`filter-chip ${activeFamily === family.emotion_family_id ? 'is-active' : ''}`} type="button" onClick={() => onFamilyChange(family.emotion_family_id)}><span className="filter-dot" style={{ background: family.color_hex }} />{family.family_name_vn}</button>)}</>
}

export function GroupFilters<T extends EmotionFamily | NeedGroup>({ groups, activeGroup, onGroupChange }: { groups: T[]; activeGroup: string; onGroupChange: (id: string) => void }) {
  return <><button className={`filter-chip filter-chip--all ${activeGroup === 'all' ? 'is-active' : ''}`} type="button" onClick={() => onGroupChange('all')}>Tất cả</button>{groups.map((group) => { const id = 'emotion_family_id' in group ? group.emotion_family_id : group.need_group_id; const name = 'emotion_family_id' in group ? group.family_name_vn : group.group_name_vn; return <button key={id} className={`filter-chip ${activeGroup === id ? 'is-active' : ''}`} type="button" onClick={() => onGroupChange(id)}><span className="filter-dot" style={{ background: group.color_hex }} />{name}</button> })}</>
}

export function PickerControlShelf({ query, onQueryChange, onClear, label, resultCount, resultLabel = 'cảm xúc', children, placeholder = 'Tìm theo tên, tên tiếng Anh hoặc mô tả...' }: { query: string; onQueryChange: (value: string) => void; onClear: () => void; label: string; resultCount: number; resultLabel?: string; children: ReactNode; placeholder?: string }) {
  return <div className="discovery-toolbar" role="toolbar" aria-label={`${label}: ${resultCount} ${resultLabel}`}><label className="search-field search-field--wide"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />{query && <button className="search-clear" type="button" aria-label="Xoá tìm kiếm" onClick={onClear}>×</button>}</label>{children}</div>
}

export type ReferenceDetail = { emoji: string; typeLabel: string; nameVn: string; nameEn?: string; groupVn?: string; groupEn?: string; descriptionVn?: string; descriptionEn?: string; color?: string }

export function ReferenceDetailModal({ detail, onClose }: { detail: ReferenceDetail; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus(); const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); if (event.key !== 'Tab') return; const dialog = closeRef.current?.closest('[role="dialog"]'); const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')) : []; if (focusable.length < 2) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } }; document.addEventListener('keydown', handleKeyDown); return () => document.removeEventListener('keydown', handleKeyDown) }, [onClose])
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="reference-detail-modal" role="dialog" aria-modal="true" aria-labelledby="reference-detail-title" onClick={(event) => event.stopPropagation()}><button ref={closeRef} className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button><div className="reference-detail-modal__icon" style={{ background: detail.color ? `${detail.color}22` : undefined }}>{detail.emoji}</div><span className="eyebrow">{detail.typeLabel}</span><h2 id="reference-detail-title">{detail.nameVn}</h2>{detail.nameEn && <p className="reference-detail-modal__english">{detail.nameEn}</p>}{(detail.groupVn || detail.groupEn) && <div className="reference-detail-modal__group"><span className="section-label">Nhóm</span><strong>{detail.groupVn}{detail.groupEn ? ` · ${detail.groupEn}` : ''}</strong></div>}<div className="reference-detail-modal__description"><span className="section-label">Mô tả</span>{detail.descriptionVn && <p>{detail.descriptionVn}</p>}{detail.descriptionEn && <p className="reference-detail-modal__description--en">{detail.descriptionEn}</p>}</div></section></div>
}

export function NoteField({ value, onChange, maxLength = 2000, required = false }: { value: string; onChange: (value: string) => void; maxLength?: number; required?: boolean }) {
  return <label className={`note-field ${required ? 'note-field--required' : 'note-field--optional'}`}><span>Ghi chú <small>({required ? 'bắt buộc' : 'tuỳ chọn'})</small></span><textarea value={value} required={required} aria-required={required} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={required ? 'Viết ra điều đang có mặt, dù chưa gọi tên được.' : 'Điều gì đang hiện diện trong bạn?'} /><small className="note-field__count">{value.length}/{maxLength}</small></label>
}

export function SelectionStatus({ selected, limit, label }: { selected: number; limit: number; label: string }) {
  return <p className={`selection-status ${selected >= limit ? 'is-at-limit' : ''}`} role="status"><strong>{selected}/{limit}</strong> {label} đã chọn</p>
}

export function IntensityPicker({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const options = ['Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh']
  return <div className="intensity-picker"><div className="section-heading"><span className="section-label">2. Cường độ</span><small>Chọn mức gần nhất với bạn</small></div><div className="intensity-grid">{options.map((label, index) => { const intensity = index + 1; return <button key={label} className={`intensity-card ${value === intensity ? 'is-selected' : ''}`} type="button" aria-pressed={value === intensity} onClick={() => onChange(intensity)}><span className="intensity-dots">{Array.from({ length: intensity }, (_, dot) => <i key={dot} />)}</span><strong>{label}</strong><small>{intensity}/5</small></button> })}</div></div>
}

export function SummaryRail({ draft, reference, title = 'Tóm tắt hiện tại', showPrimaryDetails = false }: { draft: CheckinDraft; reference: ReferenceData; title?: string; showPrimaryDetails?: boolean }) {
  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  const secondary = reference.emotions.filter((emotion) => draft.secondaryEmotionIds.includes(emotion.emotion_id))
  const needs = reference.needs.filter((need) => draft.needIds.includes(need.need_id))
  const contexts = reference.contexts.filter((context) => draft.contextIds.includes(context.context_id))
  const unknownPrompt = reference.unknownPrompts.find((prompt) => prompt.prompt_id === draft.unknownPromptId)
  const entries = primary ? [{ color: primary.color_hex, intensity: draft.intensity ?? 1 }, ...secondary.map((emotion) => ({ color: emotion.color_hex, intensity: 1 }))] : []
  return <aside className="summary-rail"><div className="summary-rail__heading"><strong>{title}</strong></div><ColorOrb entries={entries} size="medium" label="Color Orb tóm tắt" />{primary ? <div className="summary-primary"><span className="section-label">Cảm xúc chính</span><strong>{primary.emoji} {primary.emotion_name_vn}</strong><span>{primary.emotion_name_en}</span>{showPrimaryDetails && <><p className="summary-description">{primary.description_vn}</p><p className="summary-description summary-description--en">{primary.description_en}</p></>}</div> : unknownPrompt ? <div className="summary-primary"><span className="section-label">Prompt đang giữ</span><strong>{unknownPrompt.emoji} Mình còn đang mơ hồ</strong><span>{unknownPrompt.prompt_text_vn}</span></div> : <div className="summary-empty">Chọn cảm xúc chính để bắt đầu.</div>}{draft.checkinType === 'emotion' && <SummarySection label="Cường độ">{draft.intensity ? <><IntensityDots value={draft.intensity} /><span>{['', 'Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh'][draft.intensity]}</span></> : <span className="muted-text">Chưa chọn</span>}</SummarySection>}<SummarySection label={`Cảm xúc phụ (${secondary.length}/2)`}>{secondary.length ? <TagList items={secondary.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label={`Nhu cầu (${needs.length}/3)`}>{needs.length ? <TagList items={needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label={`Bối cảnh (${contexts.length}/2)`}>{contexts.length ? <TagList items={contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label="Ghi chú">{draft.note ? <p>{draft.note}</p> : <span className="muted-text">Chưa chọn</span>}</SummarySection></aside>
}

export function SummarySection({ label, children }: { label: string; children: ReactNode }) { return <section className="summary-section"><span className="section-label">{label}</span><div>{children}</div></section> }
export function SummaryRailWithDescription({ draft, reference }: { draft: CheckinDraft; reference: ReferenceData }) { const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId); return <SummaryRail draft={draft} reference={reference} title={primary ? primary.emotion_name_vn : 'Tóm tắt hiện tại'} showPrimaryDetails /> }
export function IntensityDots({ value }: { value: number }) { return <span className="summary-dots" aria-label={`${value} trên 5`}>{Array.from({ length: 5 }, (_, index) => <i className={index < value ? 'is-filled' : ''} key={index} />)}</span> }
export function TagList({ items }: { items: string[] }) { return <div className="tag-list">{items.map((item) => <span className="tag" key={item}>{item}</span>)}</div> }
export function FlowFooter({ onBack, onQuickSave, onContinue, continueLabel = 'Tiếp tục', isSaving = false }: { onBack: () => void; onQuickSave: () => void; onContinue: () => void; continueLabel?: string; isSaving?: boolean }) { return <footer className="flow-footer"><button className="button button--secondary" type="button" onClick={onBack}>← Quay lại</button><div className="flow-footer__actions"><button className="button button--secondary" type="button" onClick={onQuickSave} disabled={isSaving}>▣ Lưu nhanh</button><button className="button button--primary" type="button" onClick={onContinue} disabled={isSaving}>{isSaving ? 'Đang lưu…' : continueLabel} <span aria-hidden="true">→</span></button></div></footer> }
export function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button><div className="modal-card__body"><h2 id="modal-title">{title}</h2>{children}</div></section></div> }
