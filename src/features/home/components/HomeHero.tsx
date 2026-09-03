import { Link } from 'react-router-dom'
import { HomeOrb } from './HomeOrb'
import type { HomeRange } from '../types'
import type { DateRange } from '../../checkin/utils/history'
import { formatHomeRangeLabel } from '../services/homeAggregation'
import { useUiContent } from '../../../services/uiContent'
import { getColorOrbLegend, type ColorOrbEntry } from '../../checkin/utils/colorOrb'

const rangeOptions: { value: HomeRange; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' },
]

type HomeHeroProps = {
  displayName: string
  streak: number
  orbEntries: readonly ColorOrbEntry[]
  range: HomeRange
  customRange: DateRange
  relevantCheckins: number
  completedActions: number
  remainingActions: number
  onRangeChange: (range: HomeRange) => void
  onCustomRangeChange: (range: DateRange) => void
}

export function HomeHero({ displayName, streak, orbEntries, range, customRange, relevantCheckins, completedActions, remainingActions, onRangeChange, onCustomRangeChange }: HomeHeroProps) {
  const heroEyebrow = useUiContent('home.landing.hero_eyebrow')
  const heroSubtitle = useUiContent('home.landing.hero_subtitle')
  const orbTitle = useUiContent('home.landing.orb_title')
  const checkinCta = useUiContent('home.landing.checkin_cta')
  const dominantEmotions = getColorOrbLegend(orbEntries)
  const greeting = new Date().getHours() < 12 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const greetingLabel = displayName ? `${greeting}, ${displayName}` : greeting

  return (
    <section className="home-v2__card home-v2__hero" aria-labelledby="home-v2-title">
      <header className="home-v2__hero-header">
        <div>
          <p className="home-v2__eyebrow home-v2__eyebrow--header">{heroEyebrow}</p>
          <h1 id="home-v2-title">{greetingLabel} <span aria-hidden="true">🌿</span></h1>
          <p className="home-v2__lede">{heroSubtitle}</p>
        </div>
        <div className="home-v2__streak" aria-label={`${streak} ngày liên tiếp`}><span aria-hidden="true">🔥</span><strong>{streak}</strong><small>ngày liên tiếp</small></div>
      </header>

      <div className="home-v2__hero-body">
        <div className="home-v2__hero-orb"><HomeOrb entries={orbEntries} label="Color Orb Home" /></div>
        <div className="home-v2__hero-summary">
          <p className="home-v2__eyebrow">{orbTitle}</p>
          <h3>{formatHomeRangeLabel(range, customRange)}</h3>
          <p>{relevantCheckins} {relevantCheckins === 1 ? 'Check-in' : 'Check-ins'} đã ghi nhận</p>
          <div className="home-v2__range-tabs" role="tablist" aria-label="Khoảng thời gian Home">
            {rangeOptions.map((option) => <button key={option.value} className={range === option.value ? 'is-active' : undefined} type="button" role="tab" aria-selected={range === option.value} onClick={() => onRangeChange(option.value)}>{option.label}</button>)}
          </div>
          {range === 'custom' && <div className="home-v2__custom-range"><label>Từ ngày<input type="date" value={customRange.start ?? ''} onChange={(event) => onCustomRangeChange({ ...customRange, start: event.target.value || null })} /></label><span>→</span><label>Đến ngày<input type="date" value={customRange.end ?? ''} onChange={(event) => onCustomRangeChange({ ...customRange, end: event.target.value || null })} /></label></div>}
          <div className="home-v2__metrics" aria-label="Tóm tắt khoảng thời gian"><div><strong>{relevantCheckins}</strong><small>Check-in</small></div><div><strong>{completedActions}</strong><small>Action đã xong</small></div><div><strong>{remainingActions}</strong><small>Action còn lại</small></div></div>
          <div className="home-v2__orb-legend" aria-label="Cảm xúc hiện diện hôm nay"><div className="home-v2__orb-legend-heading"><span>Màu sắc hôm nay</span><small>{dominantEmotions.length ? 'Nổi bật nhất' : 'Chưa có Emotion Check-in'}</small></div>{dominantEmotions.length ? dominantEmotions.map((emotion) => <div className="home-v2__orb-legend-item" key={emotion.key}><i style={{ background: emotion.color }} aria-hidden="true" /><span>{emotion.emoji && <b aria-hidden="true">{emotion.emoji}</b>}{emotion.label ?? 'Cảm xúc'}</span><strong>{emotion.percentage}%</strong></div>) : <p className="home-v2__orb-legend-empty">Hôm nay chưa có màu cảm xúc nào được ghi nhận.</p>}</div>
          <Link className="button button--primary home-v2__cta" to="/checkin">{checkinCta} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  )
}
