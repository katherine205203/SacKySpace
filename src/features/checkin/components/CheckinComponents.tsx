import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { CheckinDraft, Context, Emotion, EmotionFamily, Need, NeedGroup, ReferenceData } from '../types'
import { buildColorOrbRegionsFromColors } from '../utils/colorOrb'

export function CheckinTabs({ active }: { active: 'create' | 'history' }) {
  return (
    <div className="checkin-tabs" role="tablist" aria-label="Check-in sections">
      <NavLink className={active === 'create' ? 'is-active' : undefined} to="/checkin" role="tab" aria-selected={active === 'create'}>Tạo check-in</NavLink>
      <NavLink className={active === 'history' ? 'is-active' : undefined} to="/checkin/history" role="tab" aria-selected={active === 'history'}>Lịch sử</NavLink>
    </div>
  )
}

export function CheckinPageIntro({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy: string }) {
  return (
    <div className="checkin-page-intro">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  )
}

export function CheckinWorkspaceHeader({ active, eyebrow, title, copy }: { active: 'create' | 'history'; eyebrow: string; title: string; copy: string }) {
  return (
    <header className="checkin-task-header">
      <div className="checkin-task-header__copy"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>
      <CheckinTabs active={active} />
    </header>
  )
}

export function ColorOrb({ entries, size = 'medium', label }: { entries: readonly { color: string; intensity: number }[]; size?: 'small' | 'medium' | 'large'; label?: string }) {
  const regions = buildColorOrbRegionsFromColors(entries)
  const clipId = `orb-clip-${useId().replaceAll(':', '')}`
  return (
    <svg className={`color-orb color-orb--${size}`} viewBox="0 0 200 200" role={label ? 'img' : undefined} aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>
      <circle className="color-orb__halo" cx="100" cy="100" r="99" />
      <circle className="color-orb__base" cx="100" cy="100" r="96" />
      <g clipPath={`url(#${clipId})`}>
        {regions.map((region) => <path key={`${region.color}-${region.start}`} d={region.path} fill={region.color} />)}
        <path className="color-orb__highlight" d="M 22 66 Q 78 30 150 42 Q 117 63 78 78 Q 45 89 22 66 Z" />
        <ellipse className="color-orb__sheen" cx="70" cy="57" rx="42" ry="18" transform="rotate(-18 70 57)" />
      </g>
      <circle className="color-orb__outline" cx="100" cy="100" r="96" />
    </svg>
  )
}

export function EmotionCard({ emotion, selected, disabled, onClick, multi = false }: { emotion: Emotion; selected: boolean; disabled?: boolean; onClick: () => void; multi?: boolean }) {
  const style = { '--semantic-color': emotion.color_hex } as CSSProperties
  return (
    <button className={`inventory-card ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} title={emotion.description_vn} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="inventory-card__emoji" aria-hidden="true">{emotion.emoji}</span>
      <strong>{emotion.emotion_name_vn}</strong>
      <span>{emotion.emotion_name_en}</span>
      {selected && <span className="selection-check" aria-label={multi ? 'Đã chọn' : 'Đã chọn'}>✓</span>}
    </button>
  )
}

export function NeedCard({ need, selected, disabled, onClick, onInfo }: { need: Need; selected: boolean; disabled?: boolean; onClick: () => void; onInfo?: () => void }) {
  const style = { '--semantic-color': need.color_hex } as CSSProperties
  return (
    <div className="inventory-card-wrap"><button className={`inventory-card inventory-card--descriptive ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} title={need.description_vn} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="inventory-card__emoji" aria-hidden="true">{need.emoji}</span><strong>{need.need_name_vn}</strong><span>{need.need_name_en}</span>{selected && <span className="selection-check" aria-label="Đã chọn">✓</span>}
    </button>{onInfo && <button className="inventory-info" type="button" aria-label={`Xem mô tả: ${need.need_name_vn}`} onClick={(event) => { event.stopPropagation(); onInfo() }}>ⓘ</button>}</div>
  )
}

export function ContextCard({ context, selected, disabled, onClick, onInfo }: { context: Context; selected: boolean; disabled?: boolean; onClick: () => void; onInfo?: () => void }) {
  const style = { '--semantic-color': context.color_hex } as CSSProperties
  return (
    <div className="inventory-card-wrap"><button className={`inventory-card inventory-card--descriptive ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} title={context.description_vn} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="inventory-card__emoji" aria-hidden="true">{context.emoji}</span><strong>{context.context_name_vn}</strong><span>{context.context_group}</span>{selected && <span className="selection-check" aria-label="Đã chọn">✓</span>}
    </button>{onInfo && <button className="inventory-info" type="button" aria-label={`Xem mô tả: ${context.context_name_vn}`} onClick={(event) => { event.stopPropagation(); onInfo() }}>ⓘ</button>}</div>
  )
}

export function EmotionFilters({ families, activeFamily, onFamilyChange }: { families: EmotionFamily[]; activeFamily: string; onFamilyChange: (id: string) => void }) {
  return (
    <>
      <button className={`filter-chip filter-chip--all ${activeFamily === 'all' ? 'is-active' : ''}`} type="button" onClick={() => onFamilyChange('all')}>Tất cả</button>
      {families.map((family) => <button key={family.emotion_family_id} className={`filter-chip ${activeFamily === family.emotion_family_id ? 'is-active' : ''}`} type="button" onClick={() => onFamilyChange(family.emotion_family_id)}><span className="filter-dot" style={{ background: family.color_hex }} />{family.family_name_vn}</button>)}
    </>
  )
}

export function GroupFilters<T extends EmotionFamily | NeedGroup>({ groups, activeGroup, onGroupChange }: { groups: T[]; activeGroup: string; onGroupChange: (id: string) => void }) {
  return (
    <>
      <button className={`filter-chip filter-chip--all ${activeGroup === 'all' ? 'is-active' : ''}`} type="button" onClick={() => onGroupChange('all')}>Tất cả</button>
      {groups.map((group) => {
        const id = 'emotion_family_id' in group ? group.emotion_family_id : group.need_group_id
        const name = 'emotion_family_id' in group ? group.family_name_vn : group.group_name_vn
        return <button key={id} className={`filter-chip ${activeGroup === id ? 'is-active' : ''}`} type="button" onClick={() => onGroupChange(id)}><span className="filter-dot" style={{ background: group.color_hex }} />{name}</button>
      })}
    </>
  )
}

export function PickerControlShelf({ query, onQueryChange, onClear, label, resultCount, resultLabel = 'cảm xúc', children, placeholder = 'Tìm theo tên, tên tiếng Anh hoặc mô tả...' }: { query: string; onQueryChange: (value: string) => void; onClear: () => void; label: string; resultCount: number; resultLabel?: string; children: ReactNode; placeholder?: string }) {
  return (
    <div className="discovery-toolbar">
      <label className="search-field search-field--wide"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />{query && <button className="search-clear" type="button" aria-label="Xoá tìm kiếm" onClick={onClear}>×</button>}</label>
      <div className="discovery-toolbar__header"><span className="discovery-label">{label}</span><span className="discovery-meta">{resultCount} {resultLabel}</span></div>
      <div className="filter-row">{children}</div>
    </div>
  )
}

export type ReferenceDetail = {
  emoji: string
  typeLabel: string
  nameVn: string
  nameEn?: string
  groupVn?: string
  groupEn?: string
  descriptionVn?: string
  descriptionEn?: string
  color?: string
}

export function ReferenceDetailModal({ detail, onClose }: { detail: ReferenceDetail; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const dialog = closeRef.current?.closest('[role="dialog"]')
      const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')) : []
      if (focusable.length < 2) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="reference-detail-modal" role="dialog" aria-modal="true" aria-labelledby="reference-detail-title" onClick={(event) => event.stopPropagation()}><button ref={closeRef} className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button><div className="reference-detail-modal__icon" style={{ background: detail.color ? `${detail.color}22` : undefined }}>{detail.emoji}</div><span className="eyebrow">{detail.typeLabel}</span><h2 id="reference-detail-title">{detail.nameVn}</h2>{detail.nameEn && <p className="reference-detail-modal__english">{detail.nameEn}</p>}{(detail.groupVn || detail.groupEn) && <div className="reference-detail-modal__group"><span className="section-label">Nhóm</span><strong>{detail.groupVn}{detail.groupEn ? ` · ${detail.groupEn}` : ''}</strong></div>}<div className="reference-detail-modal__description"><span className="section-label">Mô tả</span>{detail.descriptionVn && <p>{detail.descriptionVn}</p>}{detail.descriptionEn && <p className="reference-detail-modal__description--en">{detail.descriptionEn}</p>}</div></section></div>
}

export function NoteField({ value, onChange, maxLength = 1000 }: { value: string; onChange: (value: string) => void; maxLength?: number }) {
  return (
    <label className="note-field">
      <span>Ghi chú <small>(tuỳ chọn)</small></span>
      <textarea value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder="Điều gì đang hiện diện trong bạn?" />
      <small className="note-field__count">{value.length}/{maxLength}</small>
    </label>
  )
}

export function IntensityPicker({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const options = [
    ['Thoáng qua', 'Chỉ lướt qua'],
    ['Nhẹ nhàng', 'Nhẹ'],
    ['Vừa phải', 'Vừa phải'],
    ['Hiện diện rõ', 'Rõ'],
    ['Rất mạnh', 'Rất mạnh'],
  ]
  return (
    <div className="intensity-picker">
      <div className="section-label"><span>2. Cường độ</span><small>Chọn mức gần nhất với bạn</small></div>
      <div className="intensity-grid">
        {options.map(([label], index) => {
          const intensity = index + 1
          return <button key={label} className={`intensity-card ${value === intensity ? 'is-selected' : ''}`} type="button" aria-pressed={value === intensity} onClick={() => onChange(intensity)}><span className="intensity-dots">{Array.from({ length: intensity }, (_, dot) => <i key={dot} />)}</span><strong>{label}</strong><small>{intensity}/5</small></button>
        })}
      </div>
    </div>
  )
}

export function SummaryRail({ draft, reference, title = 'Tóm tắt hiện tại', showPrimaryDetails = false }: { draft: CheckinDraft; reference: ReferenceData; title?: string; showPrimaryDetails?: boolean }) {
  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  const family = primary ? reference.emotionFamilies.find((item) => item.emotion_family_id === primary.emotion_family_id) : null
  const secondary = reference.emotions.filter((emotion) => draft.secondaryEmotionIds.includes(emotion.emotion_id))
  const needs = reference.needs.filter((need) => draft.needIds.includes(need.need_id))
  const contexts = reference.contexts.filter((context) => draft.contextIds.includes(context.context_id))
  const entries = primary ? [{ color: primary.color_hex, intensity: draft.intensity ?? 1 }, ...secondary.map((emotion) => ({ color: emotion.color_hex, intensity: 1 }))] : []
  return (
    <aside className="summary-rail">
      <div className="summary-rail__heading"><span className="section-label">{title}</span></div>
      <ColorOrb entries={entries} size="medium" label="Color Orb tóm tắt" />
      {primary ? <div className="summary-primary"><span className="section-label">Cảm xúc chính</span><strong>{primary.emotion_name_vn}</strong><span>{primary.emotion_name_en}</span>{showPrimaryDetails && family && <span className="summary-family"><i style={{ background: family.color_hex }} />{family.family_name_vn}</span>}{showPrimaryDetails && <><p className="summary-description">{primary.description_vn}</p><p className="summary-description summary-description--en">{primary.description_en}</p></>}</div> : <div className="summary-empty">Chọn cảm xúc chính để bắt đầu.</div>}
      <SummarySection label="Cường độ">{draft.intensity ? <><IntensityDots value={draft.intensity} /><span>{['', 'Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh'][draft.intensity]}</span></> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      <SummarySection label={`Cảm xúc phụ (${secondary.length}/2)`}>{secondary.length ? <TagList items={secondary.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      <SummarySection label={`Nhu cầu (${needs.length}/3)`}>{needs.length ? <TagList items={needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      <SummarySection label={`Bối cảnh (${contexts.length}/2)`}>{contexts.length ? <TagList items={contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      <SummarySection label="Ghi chú">{draft.note ? <p>{draft.note}</p> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
    </aside>
  )
}

export function SummarySection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="summary-section"><span className="section-label">{label}</span><div>{children}</div></section>
}

export function SummaryRailWithDescription({ draft, reference }: { draft: CheckinDraft; reference: ReferenceData }) {
  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  return <SummaryRail draft={draft} reference={reference} title={primary ? primary.emotion_name_vn : 'Tóm tắt hiện tại'} />
}

export function IntensityDots({ value }: { value: number }) {
  return <span className="summary-dots" aria-label={`${value} trên 5`}>{Array.from({ length: 5 }, (_, index) => <i className={index < value ? 'is-filled' : ''} key={index} />)}</span>
}

export function TagList({ items }: { items: string[] }) {
  return <div className="tag-list">{items.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
}

export function FlowFooter({ onBack, onQuickSave, onContinue, continueLabel = 'Tiếp tục', isSaving = false }: { onBack: () => void; onQuickSave: () => void; onContinue: () => void; continueLabel?: string; isSaving?: boolean }) {
  return <footer className="flow-footer"><button className="button button--secondary" type="button" onClick={onBack}>← Quay lại</button><button className="button button--secondary" type="button" onClick={onQuickSave} disabled={isSaving}>▣ Lưu nhanh</button><button className="button button--primary" type="button" onClick={onContinue} disabled={isSaving}>{isSaving ? 'Đang lưu…' : continueLabel} →</button></footer>
}

export function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button><h2 id="modal-title">{title}</h2>{children}</section></div>
}
