import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_REFLECTION_OUTCOMES } from '../actionService'
import { ACTION_INDEPENDENT_COLOR } from '../actionPresentation'
import type { ActionRecord, ActionReflectionOutcome } from '../types'
import type { CheckinRecord } from '../../checkin/types'
import '../actionspace.css'

const getReflectionSource = (checkin: CheckinRecord | null | undefined) => {
  if (checkin?.primaryEmotion) return { emoji: checkin.primaryEmotion.emoji, nameVn: checkin.primaryEmotion.emotion_name_vn, nameEn: checkin.primaryEmotion.emotion_name_en, color: checkin.primaryEmotion.color_hex, sourceLabel: 'Từ Check-in' }
  if (checkin?.checkinType === 'unknown') return { emoji: checkin.unknownPrompt?.emoji ?? '◌', nameVn: 'Mình còn đang mơ hồ', nameEn: 'Unknown Check-in', color: '#7C9BEF', sourceLabel: 'Từ Check-in' }
  return { emoji: '✦', nameVn: 'Action Space', nameEn: 'Một bước nhỏ cho bạn', color: ACTION_INDEPENDENT_COLOR, sourceLabel: 'Action độc lập' }
}

const reflectionIcons: Record<string, string> = { better: '↗', lighter: '≈', same: '—', not_better: '↘', other: '✦' }
const reflectionDraftStorageKey = (actionId: string): string => `sacky:reflection-draft:v1:${actionId}`

export function ReflectionModal({ action, checkin, outcomes, onClose, onSave }: { action: ActionRecord; checkin?: CheckinRecord | null; outcomes: ActionReflectionOutcome[]; historyAvailable?: boolean; onClose: () => void; onSave: (outcome: ActionReflectionOutcome, note: string) => Promise<void> }) {
  const availableOutcomes = outcomes.length ? outcomes : DEFAULT_REFLECTION_OUTCOMES
  const [selected, setSelected] = useState<ActionReflectionOutcome | null>(availableOutcomes[0] ?? null)
  const [note, setNote] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(reflectionDraftStorageKey(action.id)) ?? 'null') as { note?: unknown } | null
      return typeof stored?.note === 'string' ? stored.note : ''
    } catch { return '' }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try { window.localStorage.setItem(reflectionDraftStorageKey(action.id), JSON.stringify({ note, outcomeId: selected?.id ?? null })) } catch { /* Device autosave is best effort. */ }
  }, [action.id, note, selected?.id])

  const submit = async () => {
    if (!selected) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave(selected, note)
      window.localStorage.removeItem(reflectionDraftStorageKey(action.id))
    } catch {
      setError('Chưa thể lưu lại lúc này. Thử lại nhé.')
    } finally {
      setIsSaving(false)
    }
  }

  const source = getReflectionSource(checkin)
  return <div className="action-modal-backdrop" role="presentation" onClick={onClose}><section className="reflection-modal" style={{ '--reflection-color': source.color } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="reflection-modal-title" onClick={(event) => event.stopPropagation()}><button className="action-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><div className="reflection-modal__layout"><aside className="reflection-modal__source"><div className="reflection-modal__source-orb" aria-hidden="true">{source.emoji}</div><span className="eyebrow">{source.sourceLabel}</span><strong>{source.nameVn}</strong><small>{source.nameEn}</small><div className="reflection-modal__source-action"><span>✓</span><p>{action.title}</p></div></aside><div className="reflection-modal__main"><p className="eyebrow">Một khoảng nhìn lại</p><h2 id="reflection-modal-title">Làm xong, bạn thấy thế nào rồi?</h2><p className="reflection-modal__prompt">Không cần câu trả lời hoàn hảo — chỉ cần điều đúng nhất với bạn lúc này.</p><div className="reflection-options" role="radiogroup" aria-label="Cảm nhận sau khi làm xong">{availableOutcomes.map((outcome) => <button key={outcome.id} className={`reflection-option reflection-option--${outcome.semanticGroup} ${selected?.id === outcome.id ? 'is-selected' : ''}`} type="button" role="radio" aria-checked={selected?.id === outcome.id} onClick={() => setSelected(outcome)}><span aria-hidden="true">{reflectionIcons[outcome.id] ?? '◌'}</span><span>{outcome.labelVn}</span>{selected?.id === outcome.id && <b aria-hidden="true">✓</b>}</button>)}</div><label className="reflection-note"><span>Ghi chú tùy chọn</span><textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Viết một dòng nếu bạn muốn…" /></label>{error && <p className="action-modal__error" role="alert">{error}</p>}<footer><button className="button button--secondary" type="button" onClick={onClose}>Bỏ qua</button><button className="button button--primary" type="button" disabled={!selected || isSaving} onClick={() => void submit()}>{isSaving ? 'Đang lưu…' : 'Lưu lại'}</button></footer></div></div></section></div>
}
