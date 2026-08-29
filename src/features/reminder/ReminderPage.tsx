import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatReminderSchedule, isReminderCompleted } from '../home/services/homeAggregation'
import { deleteReminder, setReminderCompleted, updateReminder, type ReminderEdit } from '../home/services/reminderRepository'
import { useHomeData } from '../home/hooks/useHomeData'
import type { HomeReminder } from '../home/types'
import './reminder.css'

export function ReminderPage() {
  const { snapshot, isLoading, error, refresh } = useHomeData()
  const [patches, setPatches] = useState<Record<string, Partial<HomeReminder>>>({})
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const reminders = (snapshot?.reminders ?? [])
    .filter((reminder) => !deletedIds.includes(reminder.id))
    .map((reminder) => ({ ...reminder, ...patches[reminder.id] }))

  const handleToggle = async (reminder: HomeReminder) => {
    const completed = !isReminderCompleted(reminder)
    setBusyId(reminder.id)
    setWorkspaceError(null)
    try {
      await setReminderCompleted(reminder.id, completed)
      setPatches((current) => ({ ...current, [reminder.id]: { ...current[reminder.id], status: completed ? 'completed' : 'pending', completedAt: completed ? new Date().toISOString() : null } }))
      await refresh()
    } catch (reason: unknown) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'Không thể cập nhật Action.')
    } finally {
      setBusyId(null)
    }
  }

  const handleEdit = async (reminder: HomeReminder) => {
    const title = window.prompt('Tên action', reminder.title)
    if (title === null) return
    const edit: ReminderEdit = { title, note: reminder.note ?? '', plannedDate: reminder.plannedDate ?? '', dueTime: reminder.dueTime ?? '' }
    setBusyId(reminder.id)
    setWorkspaceError(null)
    try {
      await updateReminder(reminder.id, edit)
      setPatches((current) => ({ ...current, [reminder.id]: { ...current[reminder.id], title: title.trim(), note: edit.note.trim() || null } }))
      await refresh()
    } catch (reason: unknown) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'Không thể sửa Action.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (reminder: HomeReminder) => {
    if (!window.confirm(`Xoá action “${reminder.title}”?`)) return
    setBusyId(reminder.id)
    setWorkspaceError(null)
    try {
      await deleteReminder(reminder.id)
      setDeletedIds((current) => current.includes(reminder.id) ? current : [...current, reminder.id])
      await refresh()
    } catch (reason: unknown) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'Không thể xoá Action.')
    } finally {
      setBusyId(null)
    }
  }

  if (!snapshot && isLoading) return <section className="reminder-workspace" role="status"><p className="eyebrow">Sắc Ký</p><h1>Việc cần làm</h1><p>Đang tải các action của bạn…</p></section>
  if (!snapshot) return <section className="reminder-workspace reminder-workspace--error" role="alert"><p className="eyebrow">Sắc Ký</p><h1>Chưa thể mở Action</h1><p>{error ?? 'Dữ liệu chưa sẵn sàng.'}</p><button className="button button--secondary" type="button" onClick={() => void refresh()}>Thử lại</button></section>

  return <section className="reminder-workspace" aria-labelledby="reminder-workspace-title">
    <header className="reminder-workspace__header"><div><p className="eyebrow">Sắc Ký · Action</p><h1 id="reminder-workspace-title">Việc cần làm</h1><p>Những bước nhỏ đang chờ bạn.</p></div><Link className="button button--secondary" to="/">Về Home</Link></header>
    {error && <p className="reminder-workspace__notice" role="alert">Không thể làm mới dữ liệu: {error}</p>}
    {workspaceError && <p className="reminder-workspace__notice" role="alert">{workspaceError}</p>}
    {reminders.length ? <div className="reminder-workspace__list">{reminders.map((reminder) => <ReminderWorkspaceRow key={reminder.id} reminder={reminder} busy={busyId === reminder.id} onToggle={() => void handleToggle(reminder)} onEdit={() => void handleEdit(reminder)} onDelete={() => void handleDelete(reminder)} />)}</div> : <div className="reminder-workspace__empty"><span aria-hidden="true">✦</span><p>Chưa có action nào.</p><Link to="/checkin">Tạo Check-in để gắn một bước nhỏ.</Link></div>}
  </section>
}

function ReminderWorkspaceRow({ reminder, busy, onToggle, onEdit, onDelete }: { reminder: HomeReminder; busy: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const completed = isReminderCompleted(reminder)
  return <article className={`reminder-workspace__row ${completed ? 'is-completed' : ''}`}>
    <button className="reminder-workspace__toggle" type="button" disabled={busy} aria-label={completed ? `Hoàn tác: ${reminder.title}` : `Đánh dấu hoàn thành: ${reminder.title}`} aria-pressed={completed} onClick={onToggle}><span>{completed ? '✓' : ''}</span></button>
    <div className="reminder-workspace__copy"><strong>{reminder.title}</strong><small>{formatReminderSchedule(reminder)} · {completed ? 'Đã hoàn thành' : 'Đang chờ'}</small>{reminder.note && <p>{reminder.note}</p>}</div>
    <div className="reminder-workspace__actions"><button type="button" disabled={busy} onClick={onEdit}>Sửa</button><button type="button" disabled={busy} onClick={onDelete}>Xoá</button></div>
  </article>
}
