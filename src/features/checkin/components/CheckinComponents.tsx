import type { CSSProperties, ReactNode } from 'react'
import type { CheckinDraft, Context, Emotion, EmotionFamily, Need, NeedGroup, ReferenceData } from '../types'
import { buildColorOrbRegionsFromColors } from '../utils/colorOrb'

export function CheckinTabs({ active }: { active: 'create' | 'history' }) {
  return (
    <div className="checkin-tabs" role="tablist" aria-label="Check-in sections">
      <a className={active === 'create' ? 'is-active' : undefined} href="/checkin" role="tab" aria-selected={active === 'create'}>Tạo check-in</a>
      <a className={active === 'history' ? 'is-active' : undefined} href="/checkin/history" role="tab" aria-selected={active === 'history'}>Lịch sử</a>
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

export function ColorOrb({ entries, size = 'medium', label }: { entries: readonly { color: string; intensity: number }[]; size?: 'small' | 'medium' | 'large'; label?: string }) {
  const regions = buildColorOrbRegionsFromColors(entries)
  return (
    <svg className={`color-orb color-orb--${size}`} viewBox="0 0 200 200" role={label ? 'img' : undefined} aria-label={label}>
      <defs>
        <clipPath id={`orb-clip-${size}`}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>
      <circle className="color-orb__base" cx="100" cy="100" r="96" />
      <g clipPath={`url(#orb-clip-${size})`}>
        {regions.map((region) => <path key={`${region.color}-${region.start}`} d={region.path} fill={region.color} />)}
      </g>
      <circle className="color-orb__outline" cx="100" cy="100" r="96" />
    </svg>
  )
}

export function EmotionCard({ emotion, selected, disabled, onClick, multi = false }: { emotion: Emotion; selected: boolean; disabled?: boolean; onClick: () => void; multi?: boolean }) {
  const style = { '--semantic-color': emotion.color_hex } as CSSProperties
  return (
    <button className={`inventory-card ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="inventory-card__emoji" aria-hidden="true">{emotion.emoji}</span>
      <strong>{emotion.emotion_name_vn}</strong>
      <span>{emotion.emotion_name_en}</span>
      {selected && <span className="selection-check" aria-label={multi ? 'Đã chọn' : 'Đã chọn'}>✓</span>}
    </button>
  )
}

export function NeedCard({ need, selected, disabled, onClick }: { need: Need; selected: boolean; disabled?: boolean; onClick: () => void }) {
  const style = { '--semantic-color': need.color_hex } as CSSProperties
  return (
    <button className={`inventory-card inventory-card--descriptive ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="inventory-card__emoji" aria-hidden="true">{need.emoji}</span>
      <strong>{need.need_name_vn}</strong>
      <span>{need.need_name_en}</span>
      {selected && <span className="selection-check" aria-label="Đã chọn">✓</span>}
    </button>
  )
}

export function ContextCard({ context, selected, disabled, onClick }: { context: Context; selected: boolean; disabled?: boolean; onClick: () => void }) {
  const style = { '--semantic-color': context.color_hex } as CSSProperties
  return (
    <button className={`inventory-card inventory-card--descriptive ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} style={style} type="button" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="inventory-card__emoji" aria-hidden="true">{context.emoji}</span>
      <strong>{context.context_name_vn}</strong>
      <span>{context.context_group}</span>
      {selected && <span className="selection-check" aria-label="Đã chọn">✓</span>}
    </button>
  )
}

export function EmotionFilters({ families, activeFamily, onFamilyChange }: { families: EmotionFamily[]; activeFamily: string; onFamilyChange: (id: string) => void }) {
  return (
    <div className="filter-row" aria-label="Emotion family filters">
      <button className={`filter-chip filter-chip--all ${activeFamily === 'all' ? 'is-active' : ''}`} type="button" onClick={() => onFamilyChange('all')}>Tất cả</button>
      {families.map((family) => <button key={family.emotion_family_id} className={`filter-chip ${activeFamily === family.emotion_family_id ? 'is-active' : ''}`} type="button" onClick={() => onFamilyChange(family.emotion_family_id)}><span className="filter-dot" style={{ background: family.color_hex }} />{family.family_name_vn}</button>)}
    </div>
  )
}

export function GroupFilters<T extends EmotionFamily | NeedGroup>({ groups, activeGroup, onGroupChange }: { groups: T[]; activeGroup: string; onGroupChange: (id: string) => void }) {
  return (
    <div className="filter-row" aria-label="Group filters">
      <button className={`filter-chip filter-chip--all ${activeGroup === 'all' ? 'is-active' : ''}`} type="button" onClick={() => onGroupChange('all')}>Tất cả</button>
      {groups.map((group) => {
        const id = 'emotion_family_id' in group ? group.emotion_family_id : group.need_group_id
        const name = 'emotion_family_id' in group ? group.family_name_vn : group.group_name_vn
        return <button key={id} className={`filter-chip ${activeGroup === id ? 'is-active' : ''}`} type="button" onClick={() => onGroupChange(id)}><span className="filter-dot" style={{ background: group.color_hex }} />{name}</button>
      })}
    </div>
  )
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

export function SummaryRail({ draft, reference, title = 'Tóm tắt hiện tại' }: { draft: CheckinDraft; reference: ReferenceData; title?: string }) {
  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  const secondary = reference.emotions.filter((emotion) => draft.secondaryEmotionIds.includes(emotion.emotion_id))
  const needs = reference.needs.filter((need) => draft.needIds.includes(need.need_id))
  const contexts = reference.contexts.filter((context) => draft.contextIds.includes(context.context_id))
  const entries = primary ? [{ color: primary.color_hex, intensity: draft.intensity ?? 1 }, ...secondary.map((emotion) => ({ color: emotion.color_hex, intensity: 1 }))] : []
  return (
    <aside className="summary-rail">
      <h3>{title}</h3>
      <ColorOrb entries={entries} size="medium" label="Color Orb tóm tắt" />
      {primary ? <div className="summary-primary"><span className="eyebrow">Cảm xúc chính</span><strong>{primary.emotion_name_vn}</strong><span>{primary.emotion_name_en}</span></div> : <div className="summary-empty">Chọn cảm xúc chính để bắt đầu.</div>}
      {draft.intensity && <SummarySection label="Cường độ"><IntensityDots value={draft.intensity} /><span>{['', 'Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh'][draft.intensity]}</span></SummarySection>}
      <SummarySection label={`Cảm xúc phụ (${secondary.length}/2)`}>{secondary.length ? <TagList items={secondary.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      <SummarySection label={`Nhu cầu (${needs.length}/3)`}>{needs.length ? <TagList items={needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      <SummarySection label={`Bối cảnh (${contexts.length}/2)`}>{contexts.length ? <TagList items={contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /> : <span className="muted-text">Chưa chọn</span>}</SummarySection>
      {draft.note && <SummarySection label="Ghi chú"><p>{draft.note}</p></SummarySection>}
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
