import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionModal, CompletionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, IntensityDots, SummaryRail, TagList } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'

export function ReviewScreen() {
  const navigate = useNavigate()
  const { draft, updateDraft, saveDraft, completeCheckin, loadExistingDraft, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [modal, setModal] = useState<'save' | 'action' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { id: locationId } = useParams()
  useEffect(() => {
    if (locationId && draft.id !== locationId) void loadExistingDraft(locationId).catch(() => undefined)
  }, [draft.id, loadExistingDraft, locationId])
  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  const secondary = reference.emotions.filter((emotion) => draft.secondaryEmotionIds.includes(emotion.emotion_id))
  const needs = reference.needs.filter((need) => draft.needIds.includes(need.need_id))
  const contexts = reference.contexts.filter((context) => draft.contextIds.includes(context.context_id))
  const finish = async (nextDraft = draft) => { try { await completeCheckin(nextDraft); navigate('/') } catch { /* surfaced by context */ } }
  const openSave = async () => {
    const valid = draft.checkinType === 'unknown' ? Boolean(draft.unknownPromptId && draft.note.trim()) : Boolean(draft.primaryEmotionId && draft.intensity)
    if (!valid) { setFormError(draft.checkinType === 'unknown' ? 'Unknown Check-in cần prompt và ghi chú.' : 'Check-in cảm xúc cần cảm xúc chính và cường độ.'); return }
    await saveDraft()
    setFormError(null)
    setModal('save')
  }

  return (
    <div className="page-stack checkin-page review-page">
      <CheckinWorkspaceHeader active="create" eyebrow="Đào sâu hơn · 5/5" title="Xem lại check-in của mình" copy="Bạn có thể chỉnh lại từng phần trước khi hoàn tất." />
      <div className="review-layout"><main className="review-sections">
        <ReviewSection number="1" label="Cảm xúc chính" value={<><strong>{primary?.emoji} {primary?.emotion_name_vn ?? (draft.checkinType === 'unknown' ? 'Unknown Check-in' : 'Chưa chọn')}</strong>{primary && <span>{primary.emotion_name_en}</span>}</>} onEdit={() => navigate('/checkin/emotion', { state: { returnToReview: true } })} />
        <ReviewSection number="2" label="Cường độ" value={draft.intensity ? <><IntensityDots value={draft.intensity} /><strong>{['', 'Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh'][draft.intensity]}</strong></> : <span className="muted-text">Chưa chọn</span>} onEdit={() => navigate('/checkin/emotion', { state: { returnToReview: true } })} />
        <ReviewSection number="3" label="Cảm xúc phụ" value={secondary.length ? <TagList items={secondary.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /> : <span className="muted-text">Không có</span>} onEdit={() => navigate(draft.id ? `/checkin/${draft.id}/secondary-emotions` : '/checkin/secondary-emotions', { state: { returnToReview: true } })} />
        <ReviewSection number="4" label="Nhu cầu" value={needs.length ? <TagList items={needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /> : <span className="muted-text">Không có</span>} onEdit={() => navigate(draft.id ? `/checkin/${draft.id}/needs` : '/checkin/needs', { state: { returnToReview: true } })} />
        <ReviewSection number="5" label="Bối cảnh" value={contexts.length ? <TagList items={contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /> : <span className="muted-text">Không có</span>} onEdit={() => navigate(draft.id ? `/checkin/${draft.id}/contexts` : '/checkin/contexts', { state: { returnToReview: true } })} />
        <ReviewSection number="6" label="Ghi chú" value={<p className="review-note">{draft.note || 'Không có ghi chú.'}</p>} onEdit={() => navigate('/checkin/emotion', { state: { returnToReview: true } })} />
      </main><SummaryRail draft={draft} reference={reference} title="Tóm tắt check-in" showPrimaryDetails />
      </div>
      {(formError || error) && <p className="form-error" role="alert">{formError ?? error}</p>}
      <footer className="flow-footer"><button className="button button--secondary" type="button" onClick={() => navigate(draft.id ? `/checkin/${draft.id}/contexts` : '/checkin/contexts')}>← Quay lại</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void openSave()}>{isSaving ? 'Đang lưu…' : 'Lưu check-in'}</button></footer>
      {modal === 'save' && <CompletionModal title="Hoàn tất check-in" copy="Chọn một hướng cuối cùng cho khoảng dừng này." onClose={() => setModal(null)} onFinish={() => finish()} onAction={() => setModal('action')} />}
      {modal === 'action' && <ActionModal reference={reference} onClose={() => setModal('save')} onSaved={(actions) => { const nextDraft = { ...draft, actions }; updateDraft({ actions }); void finish(nextDraft) }} />}
    </div>
  )
}

function ReviewSection({ number, label, value, onEdit }: { number: string; label: string; value: ReactNode; onEdit: () => void }) {
  return <section className="review-section"><div className="review-section__icon" aria-hidden="true">{number}</div><div className="review-section__label"><span>{label}</span>{value}</div><button className="text-button" type="button" onClick={onEdit}>✎ &nbsp;Chỉnh sửa</button></section>
}
