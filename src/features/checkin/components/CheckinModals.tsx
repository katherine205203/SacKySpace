import { useMemo, useState, type CSSProperties } from 'react'
import type { ActionDraft, CareAction, CheckinDraft, ReferenceData } from '../types'
import { MAX_ACTIONS } from '../utils/selectionRules'
import { IntensityDots, ModalShell } from './CheckinComponents'

type DecisionModalProps = {
  draft: CheckinDraft
  reference: ReferenceData
  onClose: () => void
  onFinish: () => void | Promise<void>
  onDeepDive: () => void | Promise<void>
  onAction: () => void | Promise<void>
  isSaving?: boolean
}

export function DecisionModal({ draft, reference, onClose, onFinish, onDeepDive, onAction, isSaving = false }: DecisionModalProps) {
  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  return (
    <ModalShell title="Bạn muốn đi tiếp thế nào?" onClose={onClose}>
      <p className="modal-copy">Check-in sẽ chỉ được hoàn tất khi bạn chọn một hướng bên dưới.</p>
      <div className="modal-summary">
        <div><span className="eyebrow">Cảm xúc chính</span><strong>{primary?.emotion_name_vn ?? 'Unknown Check-in'}</strong></div>
        {draft.intensity && <div><span className="eyebrow">Cường độ</span><strong><IntensityDots value={draft.intensity} /></strong></div>}
      </div>
      <div className="modal-options">
        <button className="modal-option" type="button" disabled={isSaving} onClick={() => void onFinish()}><span className="option-icon option-icon--violet">✓</span><span><strong>Vậy là đủ</strong><small>Hoàn tất check-in và về Home</small></span><b>›</b></button>
        <button className="modal-option" type="button" disabled={isSaving} onClick={() => void onDeepDive()}><span className="option-icon option-icon--blue">▱</span><span><strong>Đào sâu hơn</strong><small>Thêm cảm xúc phụ, nhu cầu và bối cảnh</small></span><b>›</b></button>
        <button className="modal-option" type="button" disabled={isSaving} onClick={() => void onAction()}><span className="option-icon option-icon--green">⚑</span><span><strong>Chọn action</strong><small>Gắn một bước nhỏ tiếp theo</small></span><b>›</b></button>
      </div>
    </ModalShell>
  )
}

export function CompletionModal({ onClose, onFinish, onAction, isSaving = false, title = 'Hoàn tất check-in', copy = 'Chọn một hướng để hoàn tất khoảng dừng này.' }: { onClose: () => void; onFinish: () => void | Promise<void>; onAction: () => void | Promise<void>; isSaving?: boolean; title?: string; copy?: string }) {
  return <ModalShell title={title} onClose={onClose}><p className="modal-copy">{copy}</p><div className="modal-options"><button className="modal-option" type="button" disabled={isSaving} onClick={() => void onFinish()}><span className="option-icon option-icon--violet">✓</span><span><strong>Vậy là đủ</strong><small>Hoàn tất và về Home</small></span><b>›</b></button><button className="modal-option" type="button" disabled={isSaving} onClick={() => void onAction()}><span className="option-icon option-icon--green">⚑</span><span><strong>Chọn action</strong><small>Gắn một bước nhỏ tiếp theo</small></span><b>›</b></button></div></ModalShell>
}

const today = () => new Date().toISOString().slice(0, 10)

const toDraft = (action: CareAction): ActionDraft => ({ careActionId: action.care_action_id, title: action.title_vn, note: action.description_vn, plannedDate: '', dueTime: '' })

export type ActionModalContext = {
  emotion: ReferenceData['emotions'][number] | null | undefined
  checkinType: CheckinDraft['checkinType']
  unknownEmoji?: string
}

export function ActionModal({ reference, context, onClose, onSaved, initialActions = [], isSaving = false }: { reference: ReferenceData; context?: ActionModalContext; onClose: () => void; onSaved: (actions: ActionDraft[]) => void; initialActions?: ActionDraft[]; isSaving?: boolean }) {
  const [selected, setSelected] = useState<ActionDraft[]>(initialActions)
  const [showAll, setShowAll] = useState(false)
  const [seed, setSeed] = useState(0)
  const suggestions = useMemo(() => {
    const seeded = (value: number) => ((value * 9301 + 49297) % 233280) / 233280
    return reference.careActions.map((action, index) => ({ action, key: seeded(seed + index + 17) })).sort((left, right) => left.key - right.key).slice(0, 3).map(({ action }) => action)
  }, [reference.careActions, seed])
  const visible = showAll ? reference.careActions : suggestions
  const selectedIds = selected.map((action) => action.careActionId ?? `custom:${action.title}`)

  const toggleAction = (action: CareAction) => {
    const id = action.care_action_id
    if (selectedIds.includes(id)) {
      setSelected((current) => current.filter((item) => item.careActionId !== id))
      return
    }
    if (selected.length >= MAX_ACTIONS) return
    setSelected((current) => [...current, toDraft(action)])
  }

  const updateAction = (index: number, patch: Partial<ActionDraft>) => setSelected((current) => current.map((action, actionIndex) => actionIndex === index ? { ...action, ...patch } : action))
  const contextColor = context?.emotion?.color_hex ?? (context?.checkinType === 'unknown' ? '#7C9BEF' : '#8D78E8')
  const contextTitle = context?.emotion?.emotion_name_vn ?? (context?.checkinType === 'unknown' ? 'Mình còn đang mơ hồ' : 'Một bước nhỏ cho bạn')
  const contextSubtitle = context?.emotion?.emotion_name_en ?? (context?.checkinType === 'unknown' ? 'Unknown Check-in' : 'Action Space')
  const contextEmoji = context?.emotion?.emoji ?? (context?.checkinType === 'unknown' ? context.unknownEmoji ?? '◌' : '✦')
  const contextSource = context?.emotion ? 'Đến từ Check-in' : context?.checkinType === 'unknown' ? 'Đến từ Unknown Check-in' : 'Action Space'

  return <div className="checkin-action-modal-backdrop" role="presentation" onClick={onClose}><section className="checkin-action-modal" style={{ '--checkin-action-color': contextColor } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="checkin-action-modal-title" onClick={(event) => event.stopPropagation()}>
    <button className="checkin-action-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button>
    <header className="checkin-action-modal__header"><p className="eyebrow">Một bước nhỏ cho hôm nay</p><h2 id="checkin-action-modal-title">Chọn action</h2><p>Chọn tối đa 2 action cho check-in này, hoặc bỏ qua nếu chưa cần.</p></header>
    <div className="checkin-action-modal__selected"><div><span className="section-label">Đã chọn</span><strong>{selected.length}/{MAX_ACTIONS}</strong></div><div className="checkin-action-modal__selected-list">{selected.length ? selected.map((action, index) => <button key={`${action.careActionId ?? 'custom'}-${index}`} type="button" onClick={() => setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index))}><span>{action.title || 'Action mới'}</span><b aria-hidden="true">×</b></button>) : <span className="checkin-action-modal__selected-empty">Chưa chọn action</span>}</div></div>
    <div className="checkin-action-modal__body">
      <aside className="checkin-action-modal__context-rail"><div className="checkin-action-modal__context-orb" aria-hidden="true">{contextEmoji}</div><span className="eyebrow">{contextSource}</span><strong>{contextTitle}</strong><small>{contextSubtitle}</small><span className="checkin-action-modal__context-limit">Tối đa {MAX_ACTIONS} action</span></aside>
      <div className="checkin-action-modal__suggestions"><div className="action-toolbar"><strong>{showAll ? 'Tất cả action' : 'Gợi ý cho bạn'}</strong><div><button className="text-button" type="button" onClick={() => setSeed((current) => current + 1)}>↻ Làm mới gợi ý</button><button className="text-button" type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? 'Gợi ý' : 'Xem tất cả'}</button><button className="button button--secondary button--small" type="button" onClick={() => { if (selected.length < MAX_ACTIONS) setSelected((current) => [...current, { careActionId: null, title: '', note: '', plannedDate: today(), dueTime: '' }]) }}>＋ Tự viết action</button></div></div>
        <div className="checkin-action-modal__list"><div className={`checkin-action-grid ${showAll ? 'checkin-action-grid--all' : ''}`}>{visible.map((action) => <button key={action.care_action_id} className={`checkin-action-card ${selectedIds.includes(action.care_action_id) ? 'is-selected' : ''}`} type="button" disabled={!selectedIds.includes(action.care_action_id) && selected.length >= MAX_ACTIONS} onClick={() => toggleAction(action)}><span className="checkin-action-card__emoji" aria-hidden="true">{action.emoji}</span><span className="checkin-action-card__body"><strong>{action.title_vn}</strong><span>{action.description_vn}</span><small>{action.duration_min ? `${action.duration_min} phút` : 'Linh hoạt'}</small></span>{selectedIds.includes(action.care_action_id) && <b className="checkin-action-card__selected">✓</b>}</button>)}</div></div>
        {selected.length > 0 && <div className="checkin-action-config"><span className="section-label">Tinh chỉnh action</span>{selected.map((action, index) => <div className="checkin-action-config__item" key={`${action.careActionId ?? 'custom'}-${index}`}><input aria-label="Tên action" placeholder="Tên action" value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} /><div className="checkin-action-config__row"><input aria-label="Ngày dự kiến" type="date" value={action.plannedDate} onChange={(event) => updateAction(index, { plannedDate: event.target.value })} /><input aria-label="Giờ đến hạn" type="time" value={action.dueTime} onChange={(event) => updateAction(index, { dueTime: event.target.value })} /></div><textarea aria-label="Ghi chú action" placeholder="Ghi chú (tuỳ chọn)" value={action.note} onChange={(event) => updateAction(index, { note: event.target.value })} /></div>)}</div>}
      </div>
    </div>
    <footer className="checkin-action-modal__footer"><button className="button button--secondary" type="button" disabled={isSaving} onClick={onClose}>Thôi không chọn</button><button className="button button--primary" type="button" disabled={isSaving || selected.some((action) => !action.title.trim())} onClick={() => onSaved(selected)}>{isSaving ? 'Đang lưu…' : 'Lưu action ✓'}</button></footer>
  </section></div>
}
