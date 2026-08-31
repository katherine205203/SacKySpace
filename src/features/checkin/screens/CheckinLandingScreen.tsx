import { Link, useNavigate } from 'react-router-dom'
import { CheckinWorkspaceHeader, ColorOrb } from '../components/CheckinComponents'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { useCheckinFlow } from '../useCheckinFlow'

export function CheckinLandingScreen() {
  const navigate = useNavigate()
  const { draft, resetDraft } = useCheckinFlow()
  const { reference, error } = useReferenceData()

  const begin = (type: 'emotion' | 'unknown') => {
    resetDraft(type)
    navigate(type === 'emotion' ? '/checkin/emotion' : '/checkin/unknown')
  }
  const hasDraft = Boolean(draft.id || draft.primaryEmotionId || draft.unknownPromptId || draft.note.trim() || draft.secondaryEmotionIds.length || draft.needIds.length || draft.contextIds.length || draft.actions.length)
  const resume = () => navigate(draft.checkinType === 'unknown' ? '/checkin/unknown' : draft.id ? `/checkin/${draft.id}/secondary-emotions` : draft.primaryEmotionId ? '/checkin/review' : '/checkin/emotion')

  return (
    <div className="page-stack checkin-page checkin-landing">
      <CheckinWorkspaceHeader active="create" eyebrow="Sắc Ký" title="Check-in" copy="Dành vài phút lắng nghe và hiểu mình hơn mỗi ngày." />
      {error && <ReferenceState error={error} />}
      <div className="landing-layout">
        <main className="landing-main">
          <div className="checkin-choice-grid">
            <button className="choice-card choice-card--emotion" type="button" onClick={() => begin('emotion')}>
              <span className="choice-card__badge">★ Đề xuất</span><ColorOrb entries={(reference?.emotions.slice(0, 4) ?? []).map((emotion) => ({ color: emotion.color_hex, intensity: 2 }))} size="medium" label="Emotion Check-in" />
              <strong>Emotion Check-in</strong><span>Khi mình đã gọi tên được cảm xúc chính của mình.</span><span className="choice-card__divider" /><span className="choice-card__checklist"><span>✓</span> Chọn cảm xúc chính <span>✓</span> Chọn cường độ <span>✓</span> Có thể đi sâu hơn sau đó</span>
            </button>
            <button className="choice-card choice-card--unknown" type="button" onClick={() => begin('unknown')}>
              <span className="choice-card__icon" aria-hidden="true">▤</span><strong>Unknown Check-in</strong><span>Khi mình chưa rõ điều gì đang có mặt, hãy viết ra trước.</span><span className="choice-card__divider" /><span className="choice-card__checklist"><span>✓</span> Chọn prompt <span>✓</span> Viết ra <span>✓</span> Có thể chuyển sang Emotion Check-in</span>
            </button>
          </div>
          {hasDraft && <section className="draft-resume" aria-label="Tiếp tục bản nháp"><div className="draft-resume__icon" aria-hidden="true">▣</div><div><span className="section-label">Tiếp tục bản nháp</span><strong>{draft.checkinType === 'unknown' ? 'Một khoảng dừng còn đang mơ hồ' : 'Một cảm xúc đang chờ được gọi tên'}</strong><small>Những gì bạn đã viết vẫn được giữ lại trên thiết bị này.</small></div><div className="draft-resume__actions"><button className="button button--primary button--small" type="button" onClick={resume}>Tiếp tục</button><button className="button button--secondary button--small" type="button" onClick={() => resetDraft('emotion')}>Bỏ bản nháp</button></div></section>}
          <div className="landing-note"><span aria-hidden="true">ⓘ</span> Bạn luôn có thể chỉnh sửa check-in sau khi lưu.</div>
          <Link className="history-link button button--secondary" to="/checkin/history">◷ &nbsp; Xem lịch sử check-in</Link>
        </main>
      </div>
    </div>
  )
}
