import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { formatReminderSchedule, getCheckinPresentation, getHomeActionItems, isReminderCompleted, type HomeActionTab } from '../services/homeAggregation'
import type { CheckinRecord } from '../../checkin/types'
import type { HomeReminder } from '../types'

const tabs: { value: HomeActionTab; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Quá hạn' },
]

export function ActionPreview({ reminders, checkins, onDone }: { reminders: HomeReminder[]; checkins: CheckinRecord[]; onDone: (reminder: HomeReminder) => Promise<void> | void }) {
  const [tab, setTab] = useActionTab()
  const items = getHomeActionItems(reminders, tab)
  return <section className="home-v2__card home-v2__actions" aria-labelledby="home-actions-title">
    <header className="home-v2__section-header"><h2 id="home-actions-title">Việc cần làm</h2><Link to="/action-space">Xem tất cả</Link></header>
    <div className="home-v2__action-tabs" role="tablist" aria-label="Lọc action"><div>{tabs.map((item) => <button key={item.value} className={tab === item.value ? 'is-active' : undefined} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)}>{item.label}</button>)}</div></div>
    <div className="home-v2__action-list">{items.map((item) => <ActionRow key={item.id} reminder={item} checkin={item.sourceCheckinId ? checkins.find((checkin) => checkin.id === item.sourceCheckinId) ?? null : null} onDone={() => onDone(item)} />)}{!items.length && <div className="home-v2__empty home-v2__empty--compact"><span aria-hidden="true">✦</span><p>{tab === 'overdue' ? 'Không có action quá hạn.' : tab === 'upcoming' ? 'Chưa có action sắp tới.' : 'Hôm nay chưa có việc cần làm.'}</p></div>}</div>
  </section>
}

function useActionTab(): [HomeActionTab, (tab: HomeActionTab) => void] {
  const [tab, setTab] = useState<HomeActionTab>('today')
  return [tab, setTab]
}

function ActionRow({ reminder, checkin, onDone }: { reminder: HomeReminder; checkin: CheckinRecord | null; onDone: () => Promise<void> | void }) {
  const completed = isReminderCompleted(reminder)
  const [isCompleting, setIsCompleting] = useState(false)
  const presentation = checkin ? getCheckinPresentation(checkin) : null
  const color = presentation?.color ?? '#159a9c'
  const sourceLabel = presentation ? `Từ Check-in · ${presentation.title}` : 'Action độc lập'
  const handleDone = async () => {
    if (completed || isCompleting) return
    setIsCompleting(true)
    try { await onDone() } finally { window.setTimeout(() => setIsCompleting(false), 420) }
  }
  return <div className={`home-v2__action-row ${completed ? 'is-completed' : ''} ${isCompleting ? 'is-completing' : ''}`} style={{ '--action-color': color } as CSSProperties}><Link className="home-v2__action-link" to="/action-space"><span className="home-v2__action-rail" aria-hidden="true" /><span className="home-v2__action-status" aria-label={completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}>{completed ? '✓' : ''}</span><span className="home-v2__action-copy"><strong>{reminder.title}</strong>{reminder.note && <small>{reminder.note}</small>}<span>{sourceLabel} · {formatReminderSchedule(reminder)}</span></span><span aria-hidden="true" className="home-v2__action-more">⋮</span></Link><button className="home-v2__action-done" type="button" onClick={() => void handleDone()}>{completed ? 'Hoàn tác' : 'Xong'}</button></div>
}
