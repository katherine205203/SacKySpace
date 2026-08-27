import { Link, useNavigate } from 'react-router-dom'
import { CheckinPageIntro, CheckinTabs, ColorOrb } from '../components/CheckinComponents'
import { ReferenceState, useReferenceData } from '../hooks/useReferenceData'
import { useCheckinFlow } from '../CheckinFlowContext'

export function CheckinLandingScreen() {
  const navigate = useNavigate()
  const { resetDraft } = useCheckinFlow()
  const { reference, error } = useReferenceData()

  const begin = (type: 'emotion' | 'unknown') => {
    resetDraft(type)
    navigate(type === 'emotion' ? '/checkin/emotion' : '/checkin/unknown')
  }

  return (
    <div className="page-stack checkin-page">
      <CheckinTabs active="create" />
      <CheckinPageIntro eyebrow="Một khoảng dừng nhỏ" title="Hôm nay bạn đang thế nào?" copy="Không cần gọi tên mọi thứ thật hoàn hảo. Chỉ cần bắt đầu từ điều đang hiện diện." />
      {error && <ReferenceState error={error} />}
      <div className="checkin-choice-grid">
        <button className="choice-card choice-card--violet" type="button" onClick={() => begin('emotion')}>
          <span className="choice-card__number">01</span>
          <span className="choice-card__icon" aria-hidden="true">◉</span>
          <strong>Tôi biết mình đang cảm thấy gì</strong>
          <span>Chọn một cảm xúc chính, cường độ và những điều liên quan.</span>
          <b>Bắt đầu →</b>
        </button>
        <button className="choice-card choice-card--soft" type="button" onClick={() => begin('unknown')}>
          <span className="choice-card__number">02</span>
          <span className="choice-card__icon" aria-hidden="true">?</span>
          <strong>Tôi chưa biết mình đang cảm thấy gì</strong>
          <span>Bắt đầu bằng một câu hỏi mở, không cần ép mình phải có câu trả lời.</span>
          <b>Bắt đầu →</b>
        </button>
      </div>
      <section className="landing-support-card">
        <div>
          <p className="eyebrow">Không gian của bạn</p>
          <h3>Mỗi check-in là một mảnh màu nhỏ.</h3>
          <p>Những mảnh màu này sẽ dần tạo thành một bức tranh trung thực hơn về bạn.</p>
          <Link className="text-link" to="/checkin/history">Xem lịch sử check-in →</Link>
        </div>
        <ColorOrb entries={(reference?.emotions.slice(0, 5) ?? []).map((emotion) => ({ color: emotion.color_hex, intensity: 2 }))} size="large" label="Color Orb minh hoạ" />
      </section>
    </div>
  )
}
