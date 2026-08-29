import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, ColorOrb, IntensityDots, SummarySection, TagList } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'

export function ReviewScreen() {
  const navigate = useNavigate()
  const { draft, updateDraft, saveDraft, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [modal, setModal] = useState<'action' | null>(null)
  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  const secondary = reference.emotions.filter((emotion) => draft.secondaryEmotionIds.includes(emotion.emotion_id))
  const needs = reference.needs.filter((need) => draft.needIds.includes(need.need_id))
  const contexts = reference.contexts.filter((context) => draft.contextIds.includes(context.context_id))
  const finish = () => navigate('/')
  const finishWithoutAction = async () => { try { await saveDraft(); finish() } catch { /* surfaced by context */ } }
  const saveBeforeAction = async () => { try { await saveDraft(); setModal('action') } catch { /* surfaced by context */ } }

  return (
    <div className="page-stack checkin-page review-page">
      <CheckinWorkspaceHeader active="create" eyebrow="Check-in · Xem lại" title="Bạn đã nhìn thấy mình rõ hơn một chút" copy="Xem lại những gì đã chọn trước khi hoàn tất." />
      <div className="review-layout">
        <section className="review-card review-card--hero"><div><span className="eyebrow">Cảm xúc chính</span><h3>{primary?.emoji} {primary?.emotion_name_vn ?? (draft.checkinType === 'unknown' ? 'Unknown Check-in' : 'Chưa chọn')}</h3>{primary && <><p>{primary.emotion_name_en}</p><p>{primary.description_vn}</p><p className="review-card__description--en">{primary.description_en}</p></>}{draft.checkinType === 'unknown' && <p>{draft.note || 'Chưa có ghi chú.'}</p>}</div><ColorOrb entries={primary ? [{ color: primary.color_hex, intensity: draft.intensity ?? 1 }, ...secondary.map((emotion) => ({ color: emotion.color_hex, intensity: 1 }))] : []} size="medium" label="Color Orb check-in" /></section>
        <section className="review-card"><div className="review-card__header"><h3>Cảm xúc & cường độ</h3><button className="text-button" type="button" onClick={() => navigate('/checkin/emotion', { state: { returnToReview: true } })}>Chỉnh sửa</button></div><SummarySection label="Cường độ">{draft.intensity ? <><IntensityDots value={draft.intensity} /><span>{['', 'Thoáng qua', 'Nhẹ nhàng', 'Vừa phải', 'Hiện diện rõ', 'Rất mạnh'][draft.intensity]}</span></> : <span className="muted-text">Chưa chọn</span>}</SummarySection><SummarySection label="Cảm xúc phụ">{secondary.length ? <TagList items={secondary.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /> : <span className="muted-text">Không có</span>}</SummarySection></section>
        <section className="review-card"><div className="review-card__header"><h3>Nhu cầu & bối cảnh</h3><div className="review-card__edit-actions"><button className="text-button" type="button" onClick={() => draft.id && navigate(`/checkin/${draft.id}/needs`, { state: { returnToReview: true } })}>Nhu cầu</button><button className="text-button" type="button" onClick={() => draft.id && navigate(`/checkin/${draft.id}/contexts`, { state: { returnToReview: true } })}>Bối cảnh</button></div></div><SummarySection label="Nhu cầu">{needs.length ? <TagList items={needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /> : <span className="muted-text">Không có</span>}</SummarySection><SummarySection label="Bối cảnh">{contexts.length ? <TagList items={contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /> : <span className="muted-text">Không có</span>}</SummarySection></section>
        <section className="review-card"><div className="review-card__header"><h3>Ghi chú</h3><button className="text-button" type="button" onClick={() => navigate('/checkin/emotion', { state: { returnToReview: true } })}>Chỉnh sửa</button></div><p className="review-note">{draft.note || 'Không có ghi chú.'}</p></section>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="flow-footer"><button className="button button--secondary" type="button" onClick={() => navigate(`/checkin/${draft.id}/contexts`)}>← Quay lại</button><div className="flow-footer__actions"><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void finishWithoutAction()}>{isSaving ? 'Đang lưu…' : 'Vậy là đủ'}</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void saveBeforeAction()}>Chọn action</button></div></footer>
      {modal === 'action' && <ActionModal reference={reference} onClose={() => setModal(null)} onSaved={(actions) => { const nextDraft = { ...draft, actions }; updateDraft({ actions }); void saveDraft(nextDraft).then(finish).catch(() => undefined) }} />}
    </div>
  )
}
