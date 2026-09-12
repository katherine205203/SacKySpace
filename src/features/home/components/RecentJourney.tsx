import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCheckinDateShort, formatCheckinTime, getCheckinPresentation } from '../services/homeAggregation'
import type { CheckinRecord } from '../../checkin/types'
import { useUiContent } from '../../../services/uiContent'

type RecentJourneyProps = {
  records: CheckinRecord[]
  onSelectCheckin: (record: CheckinRecord) => void
}

export function RecentJourney({ records, onSelectCheckin }: RecentJourneyProps) {
  const journeyTitle = useUiContent('home.landing.journey_title')
  const historyLabel = useUiContent('home.landing.journey_history')
  const railRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateScrollState = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    setCanScrollPrev(rail.scrollLeft > 2)
    setCanScrollNext(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2)
  }, [])

  useEffect(() => {
    updateScrollState()
    const rail = railRef.current
    if (!rail) return
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      rail.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [records.length, updateScrollState])

  const moveRail = (direction: -1 | 1) => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * .78, 220), behavior: 'smooth' })
  }

  return <section className="home-v2__card home-v2__journey" aria-labelledby="recent-journey-title">
    <header className="home-v2__section-header"><div><h2 id="recent-journey-title">{journeyTitle}</h2><p>3 ngày gần nhất · {records.length} Check-in</p></div><Link to="/checkin/history">{historyLabel}</Link></header>
    {records.length ? <div className="home-v2__journey-rail-wrap">
      {canScrollPrev && <button className="home-v2__journey-arrow" type="button" aria-label="Xem Check-in cũ hơn" onClick={() => moveRail(-1)}>←</button>}
      <div ref={railRef} className="home-v2__journey-rail" aria-label="Các Check-in trong 3 ngày gần nhất">
        {records.map((record) => <JourneyCheckinCard key={record.id} record={record} onSelect={() => onSelectCheckin(record)} />)}
      </div>
      {canScrollNext && <button className="home-v2__journey-arrow" type="button" aria-label="Xem Check-in mới hơn" onClick={() => moveRail(1)}>→</button>}
    </div> : <div className="home-v2__empty home-v2__empty--compact"><span aria-hidden="true">✦</span><p>Chưa có Check-in trong 3 ngày gần nhất.</p></div>}
  </section>
}

function JourneyCheckinCard({ record, onSelect }: { record: CheckinRecord; onSelect: () => void }) {
  const presentation = getCheckinPresentation(record)
  const emotionNameEn = record.primaryEmotion?.emotion_name_en ?? 'Unknown Check-in'
  return <button className="home-v2__journey-card" type="button" onClick={onSelect} aria-label={`${formatCheckinDateShort(record.occurredAt)}, ${formatCheckinTime(record.occurredAt)}, ${presentation.title}`}>
    <span className="home-v2__journey-card-datetime">
      <span>{formatCheckinDateShort(record.occurredAt)}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={record.occurredAt}>{formatCheckinTime(record.occurredAt)}</time>
    </span>
    <span className="home-v2__journey-card-emoji" style={{ background: `color-mix(in srgb, ${presentation.color} 24%, white)` }} aria-hidden="true">{presentation.emoji}</span>
    <span className="home-v2__journey-card-names"><strong className="home-v2__journey-card-title">{presentation.title}</strong><span className="home-v2__journey-card-english">{emotionNameEn}</span></span>
  </button>
}
