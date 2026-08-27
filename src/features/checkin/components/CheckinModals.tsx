import { useMemo, useState } from 'react'
import type { ActionDraft, CareAction, CheckinDraft, ReferenceData } from '../types'
import { MAX_ACTIONS } from '../utils/selectionRules'
import { IntensityDots, ModalShell } from './CheckinComponents'

type DecisionModalProps = {
  draft: CheckinDraft
  reference: ReferenceData
  onClose: () => void
  onFinish: () => void
  onDeepDive: () => void
  onAction: () => void
}

export function DecisionModal({ draft, reference, onClose, onFinish, onDeepDive, onAction }: DecisionModalProps) {
  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  return (
    <ModalShell title={draft.checkinType === 'unknown' ? 'Đã lưu Unknown Check-in' : 'Đã lưu check-in cơ bản'} onClose={onClose}>
      <p className="modal-copy">Bạn muốn dừng tại đây hay đi sâu hơn một chút?</p>
      <div className="modal-summary">
        <div><span className="eyebrow">Cảm xúc chính</span><strong>{primary?.emotion_name_vn ?? 'Unknown Check-in'}</strong></div>
        {draft.intensity && <div><span className="eyebrow">Cường độ</span><strong><IntensityDots value={draft.intensity} /></strong></div>}
      </div>
      <div className="modal-options">
        <button className="modal-option" type="button" onClick={onFinish}><span className="option-icon option-icon--violet">✓</span><span><strong>Vậy là đủ</strong><small>Hoàn tất và về Home</small></span><b>›</b></button>
        <button className="modal-option" type="button" onClick={onDeepDive}><span className="option-icon option-icon--blue">▱</span><span><strong>Đào sâu hơn</strong><small>Thêm cảm xúc phụ, nhu cầu và bối cảnh</small></span><b>›</b></button>
        <button className="modal-option" type="button" onClick={onAction}><span className="option-icon option-icon--green">⚑</span><span><strong>Chọn action</strong><small>Gắn một bước nhỏ tiếp theo</small></span><b>›</b></button>
      </div>
    </ModalShell>
  )
}

export function CompletionModal({ onClose, onFinish, onAction }: { onClose: () => void; onFinish: () => void; onAction: () => void }) {
  return <ModalShell title="Đã lưu nhanh" onClose={onClose}><p className="modal-copy">Check-in hiện tại đã được lưu lại.</p><div className="modal-options"><button className="modal-option" type="button" onClick={onFinish}><span className="option-icon option-icon--violet">✓</span><span><strong>Vậy là đủ</strong><small>Hoàn tất và về Home</small></span><b>›</b></button><button className="modal-option" type="button" onClick={onAction}><span className="option-icon option-icon--green">⚑</span><span><strong>Chọn action</strong><small>Gắn một bước nhỏ tiếp theo</small></span><b>›</b></button></div></ModalShell>
}

const today = () => new Date().toISOString().slice(0, 10)

const toDraft = (action: CareAction): ActionDraft => ({ careActionId: action.care_action_id, title: action.title_vn, note: '', plannedDate: '', dueTime: '' })

export function ActionModal({ reference, onClose, onSaved }: { reference: ReferenceData; onClose: () => void; onSaved: (actions: ActionDraft[]) => void }) {
  const [selected, setSelected] = useState<ActionDraft[]>([])
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

  return <ModalShell title="Chọn action" onClose={onClose}>
    <p className="modal-copy">Chọn tối đa 2 action cho check-in này.</p>
    <div className="action-toolbar"><strong>Gợi ý cho bạn</strong><div><button className="text-button" type="button" onClick={() => setSeed((current) => current + 1)}>↻ Làm mới gợi ý</button><button className="text-button" type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? 'Gợi ý' : 'Xem tất cả'}</button><button className="button button--secondary button--small" type="button" onClick={() => { if (selected.length < MAX_ACTIONS) setSelected((current) => [...current, { careActionId: null, title: '', note: '', plannedDate: today(), dueTime: '' }]) }}>＋ Tự viết action</button></div></div>
    <div className="action-grid">{visible.map((action) => <button key={action.care_action_id} className={`action-card ${selectedIds.includes(action.care_action_id) ? 'is-selected' : ''}`} type="button" onClick={() => toggleAction(action)}><span className="action-card__emoji">{action.emoji}</span><strong>{action.title_vn}</strong><span>{action.description_vn}</span><small>{action.duration_min ? `${action.duration_min} phút` : 'Linh hoạt'}</small>{selectedIds.includes(action.care_action_id) && <b>✓ Đã chọn</b>}</button>)}</div>
    {selected.length > 0 && <div className="action-config"><span className="section-label">Cấu hình action đã chọn ({selected.length}/2)</span>{selected.map((action, index) => <div className="action-config__item" key={`${action.careActionId ?? 'custom'}-${index}`}><input aria-label="Tên action" placeholder="Tên action" value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} /><div className="action-config__row"><input aria-label="Ngày dự kiến" type="date" value={action.plannedDate} onChange={(event) => updateAction(index, { plannedDate: event.target.value })} /><input aria-label="Giờ đến hạn" type="time" value={action.dueTime} onChange={(event) => updateAction(index, { dueTime: event.target.value })} /></div><textarea aria-label="Ghi chú action" placeholder="Ghi chú (tuỳ chọn)" value={action.note} onChange={(event) => updateAction(index, { note: event.target.value })} /></div>)}</div>}
    <div className="modal-footer"><button className="button button--secondary" type="button" onClick={onClose}>Thôi không chọn</button><button className="button button--primary" type="button" disabled={selected.some((action) => !action.title.trim())} onClick={() => onSaved(selected)}>Lưu action ✓</button></div>
  </ModalShell>
}
