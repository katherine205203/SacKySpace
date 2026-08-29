import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatReminderSchedule, getHomeActionItems, isReminderCompleted, type HomeActionTab } from '../services/homeAggregation'
import type { HomeReminder } from '../types'

const tabs: { value: HomeActionTab; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Quá hạn' },
]

export function ActionPreview({ reminders }: { reminders: HomeReminder[] }) {
  const [tab, setTab] = useActionTab()
  const items = getHomeActionItems(reminders, tab)
  return <section className="home-v2__card home-v2__actions" aria-labelledby="home-actions-title">
    <header className="home-v2__section-header"><h2 id="home-actions-title">Việc cần làm</h2><Link to="/reminder">Xem tất cả</Link></header>
    <div className="home-v2__action-tabs" role="tablist" aria-label="Lọc action"><div>{tabs.map((item) => <button key={item.value} className={tab === item.value ? 'is-active' : undefined} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)}>{item.label}</button>)}</div></div>
    <div className="home-v2__action-list">{items.map((item) => <ActionRow key={item.id} reminder={item} />)}{!items.length && <div className="home-v2__empty home-v2__empty--compact"><span aria-hidden="true">✦</span><p>{tab === 'overdue' ? 'Không có action quá hạn.' : tab === 'upcoming' ? 'Chưa có action sắp tới.' : 'Hôm nay chưa có việc cần làm.'}</p></div>}</div>
  </section>
}

function useActionTab(): [HomeActionTab, (tab: HomeActionTab) => void] {
  const [tab, setTab] = useState<HomeActionTab>('today')
  return [tab, setTab]
}

function ActionRow({ reminder }: { reminder: HomeReminder }) {
  const completed = isReminderCompleted(reminder)
  return <Link className={`home-v2__action-row ${completed ? 'is-completed' : ''}`} to="/reminder"><span className="home-v2__action-status" aria-label={completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}>{completed ? '✓' : ''}</span><span className="home-v2__action-copy"><strong>{reminder.title}</strong>{reminder.note && <small>{reminder.note}</small>}</span><time>{formatReminderSchedule(reminder)}</time><span aria-hidden="true" className="home-v2__action-more">⋮</span></Link>
}
