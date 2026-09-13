import { createPortal } from 'react-dom'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { CheckinDraft, Context, Emotion, EmotionFamily, Need, NeedGroup, ReferenceData } from '../types'
import { ColorOrb } from './BlendedColorOrb'
import { PageHeading } from '../../../components/PageHeading'
import { isRichTextEmpty, richTextWordCount, RichTextEditor, RichTextRenderer } from '../../../components/richText'
import { getCheckinEmotionShares, intensityToPresenceWeight } from '../utils/colorOrb'
import { MAX_SECONDARY_EMOTIONS } from '../utils/selectionRules'

export { ColorOrb } from './BlendedColorOrb'

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

export function EmotionCard({ emotion, selected, disabled, onClick, multi = false, showTooltip = false }: { emotion: Emotion; selected: boolean; disabled?: boolean; onClick: () => void; multi?: boolean; showTooltip?: boolean }) {
  const style = { '--semantic-color': emotion.color_hex } as CSSProperties
  const infoRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isInfoHovered, setIsInfoHovered] = useState(false)
  const [isInfoFocused, setIsInfoFocused] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})
  const tooltipVisible = showTooltip && (isInfoHovered || isInfoFocused)
  const tooltipId = `emotion-card-tooltip-${emotion.emotion_id}`

  useEffect(() => {
    if (!tooltipVisible) return

    const reposition = () => {
      const info = infoRef.current
      const tooltip = tooltipRef.current
      if (!info || !tooltip) return

      const infoRect = info.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const edgeGap = 12
      const gap = 10
      const left = Math.max(edgeGap, Math.min(infoRect.left + (infoRect.width - tooltipRect.width) / 2, window.innerWidth - tooltipRect.width - edgeGap))
      const fitsBelow = infoRect.bottom + gap + tooltipRect.height <= window.innerHeight - edgeGap
      const top = fitsBelow ? infoRect.bottom + gap : Math.max(edgeGap, infoRect.top - tooltipRect.height - gap)

      setTooltipStyle({ left, top })
    }

    reposition()
    const frame = window.requestAnimationFrame(reposition)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [emotion.emotion_id, tooltipVisible])

  const card = <button className={`inventory-card selection-tile ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} title={showTooltip ? undefined : emotion.description_vn} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}><span className="inventory-card__emoji" aria-hidden="true">{emotion.emoji}</span><strong>{emotion.emotion_name_vn}</strong><span>{emotion.emotion_name_en}</span>{selected && <span className="selection-check" aria-label={multi ? 'Đã chọn cảm xúc phụ' : 'Đã chọn cảm xúc chính'}>✓</span>}</button>

  if (!showTooltip) return card
  return <div className="inventory-card-wrap emotion-card-wrap">{card}<button ref={infoRef} className="inventory-info emotion-card-info" type="button" aria-label={`Xem mô tả: ${emotion.emotion_name_vn}`} aria-describedby={tooltipVisible ? tooltipId : undefined} onMouseEnter={() => setIsInfoHovered(true)} onMouseLeave={() => { setIsInfoHovered(false); if (!isInfoFocused) setTooltipStyle({}) }} onFocus={() => setIsInfoFocused(true)} onBlur={() => { setIsInfoFocused(false); if (!isInfoHovered) setTooltipStyle({}) }} onClick={(event) => event.preventDefault()}>ⓘ</button>{tooltipVisible && typeof document !== 'undefined' && createPortal(<div ref={tooltipRef} id={tooltipId} className="emotion-card-tooltip" style={tooltipStyle} data-positioned={tooltipStyle.left !== undefined ? 'true' : undefined} role="tooltip"><span className="emotion-card-tooltip__emoji" style={{ background: `color-mix(in srgb, ${emotion.color_hex} 18%, white)` }} aria-hidden="true">{emotion.emoji}</span><div><strong>{emotion.emotion_name_vn}</strong><small>{emotion.emotion_name_en}</small><p>{emotion.description_vn}</p>{emotion.description_en && <p lang="en">{emotion.description_en}</p>}</div></div>, document.body)}</div>
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

export function NoteField({ value, onChange, maxLength, required = false }: { value: string; onChange: (value: string) => void; maxLength?: number; required?: boolean }) {
  const effectiveMaxLength = required ? maxLength ?? 2000 : maxLength
  return <div className={`note-field ${required ? 'note-field--required' : 'note-field--optional'}`}><span>Ghi chú <small>({required ? 'bắt buộc' : 'tuỳ chọn'})</small></span><RichTextEditor value={value} onChange={onChange} maxLength={effectiveMaxLength} ariaLabel="Ghi chú check-in" placeholder={required ? 'Viết ra điều đang có mặt, dù chưa gọi tên được.' : 'Điều gì đang hiện diện trong bạn?'} minHeight={required ? 150 : 225} /><small className="note-field__count">{richTextWordCount(value)} từ{effectiveMaxLength ? ` · tối đa ${effectiveMaxLength} ký tự` : ''}</small></div>
}

const MemoizedColorOrb = memo(ColorOrb)

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
  const entries = useMemo(() => {
    const selectedPrimary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
    const selectedSecondary = reference.emotions.filter((emotion) => draft.secondaryEmotionIds.includes(emotion.emotion_id))
    if (!selectedPrimary) return []
    const totalWeight = intensityToPresenceWeight(draft.intensity ?? 1)
    const shares = getCheckinEmotionShares(selectedSecondary.length)
    return [selectedPrimary, ...selectedSecondary].map((emotion, index) => ({
      color: emotion.color_hex,
      intensity: draft.intensity ?? 1,
      presenceWeight: totalWeight * (shares[index] ?? 0),
      emotionId: emotion.emotion_id,
    }))
  }, [draft.intensity, draft.primaryEmotionId, draft.secondaryEmotionIds, reference.emotions])
  return <aside className="summary-rail"><div className="summary-rail__heading"><strong>{title}</strong></div><MemoizedColorOrb entries={entries} size="medium" label="Color Orb tóm tắt" />{primary ? <div className="summary-primary"><span className="section-label">Cảm xúc chính</span><strong>{primary.emoji} {primary.emotion_name_vn}</strong><span>{primary.emotion_name_en}</span>{showPrimaryDetails && <><p className="summary-description">{primary.description_vn}</p><p className="summary-description summary-description--en">{primary.description_en}</p></>}</div> : unknownPrompt ? <div className="summary-primary"><span className="section-label">Prompt đang giữ</span><strong>{unknownPrompt.emoji} Mình còn đang mơ hồ</strong><span>{unknownPrompt.prompt_text_vn}</span></div> : <div className="summary-empty">Chọn cảm xúc chính để bắt đầu.</div>}{draft.checkinType === 'emotion' && <SummarySection label="Cường độ">{draft.intensity ? <><IntensityDots value={draft.intensity} /><span>{['', 'Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh'][draft.intensity]}</span></> : <span className="muted-text">Chưa chọn</span>}</SummarySection>}<SummarySection label={`Cảm xúc phụ (${secondary.length}/${MAX_SECONDARY_EMOTIONS})`}>{secondary.length ? <TagList items={secondary.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label={`Nhu cầu (${needs.length}/3)`}>{needs.length ? <TagList items={needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label={`Bối cảnh (${contexts.length}/2)`}>{contexts.length ? <TagList items={contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label="Ghi chú">{isRichTextEmpty(draft.note) ? <span className="muted-text">Chưa chọn</span> : <RichTextRenderer value={draft.note} />}</SummarySection></aside>
}

export function SummarySection({ label, children }: { label: string; children: ReactNode }) { return <section className="summary-section"><span className="section-label">{label}</span><div>{children}</div></section> }
export function SummaryRailWithDescription({ draft, reference }: { draft: CheckinDraft; reference: ReferenceData }) { const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId); return <SummaryRail draft={draft} reference={reference} title={primary ? primary.emotion_name_vn : 'Tóm tắt hiện tại'} showPrimaryDetails /> }
export function IntensityDots({ value }: { value: number }) { return <span className="summary-dots" aria-label={`${value} trên 5`}>{Array.from({ length: 5 }, (_, index) => <i className={index < value ? 'is-filled' : ''} key={index} />)}</span> }
export function TagList({ items }: { items: string[] }) { return <div className="tag-list">{items.map((item) => <span className="tag" key={item}>{item}</span>)}</div> }
export function FlowFooter({ onBack, onQuickSave, onContinue, continueLabel = 'Tiếp tục', isSaving = false }: { onBack: () => void; onQuickSave: () => void; onContinue: () => void; continueLabel?: string; isSaving?: boolean }) { return <footer className="flow-footer"><button className="button button--secondary" type="button" onClick={onBack}>← Quay lại</button><div className="flow-footer__actions"><button className="button button--secondary" type="button" onClick={onQuickSave} disabled={isSaving}>▣ Lưu nhanh</button><button className="button button--primary" type="button" onClick={onContinue} disabled={isSaving}>{isSaving ? 'Đang lưu…' : continueLabel} <span aria-hidden="true">→</span></button></div></footer> }
export function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button><div className="modal-card__body"><h2 id="modal-title">{title}</h2>{children}</div></section></div> }
