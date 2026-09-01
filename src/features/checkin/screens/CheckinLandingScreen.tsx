import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckinWorkspaceHeader, ColorOrb } from '../components/CheckinComponents'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { getCheckinLandingSummary, type CheckinLandingSummary } from '../services/checkinRepository'
import { useCheckinFlow } from '../useCheckinFlow'
import { getLocalDateKey } from '../utils/history'

const LANDING_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const NEUTRAL_ORB_ENTRIES = [
  { color: '#8D78E8', intensity: 1 },
  { color: '#BDA9F4', intensity: 0.8 },
  { color: '#D9D0EA', intensity: 0.55 },
]

export function CheckinLandingScreen() {
  const navigate = useNavigate()
  const { draft, resetDraft } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [summary, setSummary] = useState<CheckinLandingSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!reference) return

    let active = true

    void getCheckinLandingSummary(reference)
      .then((nextSummary) => {
        if (active) setSummary(nextSummary)
      })
      .catch((error: unknown) => {
        if (active) setSummaryError(error instanceof Error ? error.message : 'Không thể tải hoạt động check-in lúc này.')
      })

    return () => {
      active = false
    }
  }, [reference, reloadKey])

  const begin = (type: 'emotion' | 'unknown') => {
    resetDraft(type)
    navigate(type === 'emotion' ? '/checkin/emotion' : '/checkin/unknown')
  }

  const hasDraft = Boolean(
    draft.id ||
      draft.primaryEmotionId ||
      draft.unknownPromptId ||
      draft.note.trim() ||
      draft.secondaryEmotionIds.length ||
      draft.needIds.length ||
      draft.contextIds.length ||
      draft.actions.length,
  )
  const resume = () =>
    navigate(
      draft.checkinType === 'unknown'
        ? '/checkin/unknown'
        : draft.id
          ? `/checkin/${draft.id}/secondary-emotions`
          : draft.primaryEmotionId
            ? '/checkin/review'
            : '/checkin/emotion',
    )
  const retrySummary = () => {
    setSummary(null)
    setSummaryError(null)
    setReloadKey((key) => key + 1)
  }
  const emotionOrbEntries = reference?.emotions.slice(0, 4).map((emotion) => ({ color: emotion.color_hex, intensity: 2 })) ?? []
  const landingError = referenceError ?? summaryError

  return (
    <div className="page-stack checkin-page checkin-landing">
      <CheckinWorkspaceHeader
        active="create"
        eyebrow="Sắc Ký"
        title="Check-in"
        copy="Dành vài phút lắng nghe và hiểu mình hơn mỗi ngày."
        action={
          <Link className="button button--secondary landing-history-link" to="/checkin/history">
            Lịch sử check-in <span aria-hidden="true">→</span>
          </Link>
        }
      />
      {referenceError && <ReferenceState error={referenceError} />}
      {summaryError && !referenceError && (
        <p className="landing-error" role="alert">
          {summaryError}{' '}
          <button className="text-button" type="button" onClick={retrySummary}>
            Thử lại
          </button>
        </p>
      )}
      <div className="landing-layout">
        {summary && (
          <main className="landing-main">
            <LandingHero summary={summary} entries={NEUTRAL_ORB_ENTRIES} />
            <section className="landing-mode-grid" aria-label="Chọn cách check-in">
              <ModeCard
                className="landing-mode-card--emotion"
                eyebrow="Hiểu cảm xúc"
                title="Emotion Check-in"
                copy="Hiểu cảm xúc hiện tại và chăm sóc bản thân tốt hơn mỗi ngày."
                onClick={() => begin('emotion')}
              >
                <ColorOrb entries={emotionOrbEntries.length ? emotionOrbEntries : NEUTRAL_ORB_ENTRIES} size="small" label="Emotion Check-in" />
              </ModeCard>
              <ModeCard
                className="landing-mode-card--unknown"
                eyebrow="Viết ra trước"
                title="Unknown Check-in"
                copy="Chưa gọi tên được cảm xúc? Viết ra những gì đang hiện diện."
                onClick={() => begin('unknown')}
              >
                <UnknownCheckinVisual />
              </ModeCard>
            </section>
            {hasDraft && (
              <section className="draft-resume" aria-label="Tiếp tục bản nháp">
                <div className="draft-resume__icon" aria-hidden="true">
                  ▣
                </div>
                <div>
                  <span className="section-label">Tiếp tục bản nháp</span>
                  <strong>{draft.checkinType === 'unknown' ? 'Một khoảng dừng còn đang mơ hồ' : 'Một cảm xúc đang chờ được gọi tên'}</strong>
                  <small>Những gì bạn đã viết vẫn được giữ lại trên thiết bị này.</small>
                </div>
                <div className="draft-resume__actions">
                  <button className="button button--primary button--small" type="button" onClick={resume}>
                    Tiếp tục
                  </button>
                  <button className="button button--secondary button--small" type="button" onClick={() => resetDraft('emotion')}>
                    Bỏ bản nháp
                  </button>
                </div>
              </section>
            )}
            <RecentActivity records={summary.recent} />
          </main>
        )}
        {!summary && !landingError && <div className="landing-state">Đang chuẩn bị không gian check-in cho bạn…</div>}
      </div>
    </div>
  )
}

function LandingHero({ summary, entries }: { summary: CheckinLandingSummary; entries: Array<{ color: string; intensity: number }> }) {
  const todayDone = summary.todayCount > 0
  const filledDots = Math.min(summary.currentStreak, 7)

  return (
    <section className="landing-hero" aria-labelledby="checkin-today-title">
      <div className="landing-hero__streak">
        <span className="section-label">Chuỗi hiện tại</span>
        <div className="landing-hero__streak-value">
          <strong>{summary.currentStreak}</strong>
          <span>ngày</span>
        </div>
        <p>{summary.currentStreak ? 'Giữ nhịp nhẹ nhàng, theo cách phù hợp với bạn.' : 'Mỗi lần dừng lại đều là một bước lắng nghe bản thân.'}</p>
        <div className="landing-streak-dots" aria-label={`${summary.currentStreak} ngày liên tiếp`}>
          {Array.from({ length: 7 }, (_, index) => (
            <i className={index < filledDots ? 'is-filled' : ''} key={index} />
          ))}
        </div>
      </div>
      <div className="landing-hero__orb">
        <ColorOrb entries={entries} size="large" label="Không gian check-in" />
      </div>
      <div className="landing-hero__today">
        <span className="section-label">Hôm nay</span>
        <h2 id="checkin-today-title">{todayDone ? 'Đã check-in hôm nay' : 'Chưa check-in'}</h2>
        <p>{todayDone ? 'Bạn đã dành một khoảng dừng để lắng nghe mình hôm nay.' : 'Dành vài phút để kết nối với cảm xúc của bạn ngay bây giờ nhé.'}</p>
        <div className="landing-hero__meta" aria-label="Tóm tắt hoạt động check-in">
          <span>{summary.totalCount} lần check-in</span>
          <span>{summary.periodCount} trong tháng này</span>
        </div>
      </div>
    </section>
  )
}

function ModeCard({ className, eyebrow, title, copy, onClick, children }: { className: string; eyebrow: string; title: string; copy: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`landing-mode-card ${className}`} type="button" onClick={onClick}>
      <span className="landing-mode-card__visual" aria-hidden="true">
        {children}
      </span>
      <span className="landing-mode-card__copy">
        <span className="section-label">{eyebrow}</span>
        <strong>{title}</strong>
        <p>{copy}</p>
      </span>
      <span className="landing-mode-card__cta">
        <span>Bắt đầu {title}</span>
        <span aria-hidden="true">→</span>
      </span>
    </button>
  )
}

function UnknownCheckinVisual() {
  return (
    <svg className="unknown-checkin-visual" viewBox="0 0 128 128" role="img" aria-label="Biểu tượng viết ra điều đang hiện diện">
      <circle cx="64" cy="64" r="52" fill="#eef3ff" />
      <circle cx="64" cy="64" r="39" fill="#c9d9ff" opacity="0.75" />
      <rect x="38" y="32" width="52" height="62" rx="10" fill="#4679eb" />
      <path d="M50 49h28M50 61h28M50 73h20" stroke="white" strokeLinecap="round" strokeWidth="5" />
      <circle cx="92" cy="91" r="15" fill="#779bf2" />
      <path d="M92 84v10M92 98h.01" stroke="white" strokeLinecap="round" strokeWidth="3.5" />
    </svg>
  )
}

function RecentActivity({ records }: { records: CheckinLandingSummary['recent'] }) {
  return (
    <section className="landing-recent" aria-labelledby="recent-activity-title">
      <div className="landing-recent__header">
        <h2 id="recent-activity-title">Hoạt động gần đây</h2>
        <Link className="landing-recent__link" to="/checkin/history">
          Xem tất cả <span aria-hidden="true">→</span>
        </Link>
      </div>
      {records.length ? (
        <div className="landing-recent__list">
          {records.map((record) => (
            <RecentActivityItem key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <p className="landing-recent__empty">Những check-in đầu tiên của bạn sẽ xuất hiện ở đây.</p>
      )}
    </section>
  )
}

function RecentActivityItem({ record }: { record: CheckinLandingSummary['recent'][number] }) {
  const isUnknown = record.checkinType === 'unknown'
  const activityColor = isUnknown ? '#5e8cf0' : record.primaryEmotion?.color_hex ?? '#8d78e8'
  const activityLabel = isUnknown ? 'Unknown Check-in' : 'Emotion Check-in'
  const detail = isUnknown ? record.unknownPrompt?.prompt_text_vn ?? record.note?.trim() ?? 'Bạn đã ghi lại cảm xúc' : record.primaryEmotion?.emotion_name_vn ?? 'Đã gọi tên cảm xúc'
  const intensity = record.intensity ? `${record.intensity}/5` : null

  return (
    <article className="landing-recent__item">
      <span className="landing-recent__pigment" style={{ '--activity-color': activityColor } as CSSProperties} aria-hidden="true">
        {isUnknown ? '✎' : record.primaryEmotion?.emoji ?? '✦'}
      </span>
      <div className="landing-recent__item-copy">
        <small>
          {formatRecentDate(record.createdAt)} <span aria-hidden="true">•</span> {activityLabel}
        </small>
        <strong>{detail}</strong>
        <p>{record.note?.trim() || (isUnknown ? 'Một khoảng dừng để viết ra điều đang hiện diện.' : 'Bạn đã dành thời gian lắng nghe mình.')}</p>
      </div>
      {intensity && <span className="landing-recent__intensity">{intensity}</span>}
    </article>
  )
}

function formatRecentDate(createdAt: string) {
  const today = getLocalDateKey(new Date().toISOString(), LANDING_TIME_ZONE)
  const recordDay = getLocalDateKey(createdAt, LANDING_TIME_ZONE)
  const dayDifference = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${recordDay}T00:00:00Z`)) / 86_400_000)
  if (dayDifference === 0) return 'Hôm nay'
  if (dayDifference === 1) return 'Hôm qua'
  if (dayDifference > 1 && dayDifference < 7) return `${dayDifference} ngày trước`
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' }).format(new Date(createdAt))
}
