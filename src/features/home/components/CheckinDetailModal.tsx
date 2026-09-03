import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HomeOrb } from './HomeOrb'
import { formatCheckinDate, formatCheckinTime, formatReminderSchedule, getCheckinPresentation, getHomeOrbEntries, isReminderCompleted } from '../services/homeAggregation'
import { deleteReminder, updateReminder, type ReminderEdit } from '../services/reminderRepository'
import { DEFAULT_REFLECTION_OUTCOMES, listReflectionOutcomes, saveActionReflection, setActionStatus } from '../../actionspace/actionService'
import { ReflectionModal } from '../../actionspace/ActionSpacePage'
import type { ActionRecord, ActionReflectionOutcome } from '../../actionspace/types'
import type { HomeReminder } from '../types'
import type { CheckinRecord } from '../../checkin/types'
import { IntensityDots, TagList } from '../../checkin/components/CheckinComponents'

type CheckinDetailModalProps = {
  record: CheckinRecord
  linkedActions: HomeReminder[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onActionChanged: () => Promise<void>
}

type CheckinRecordWithReflection = CheckinRecord & { reflection?: string | null }

export function CheckinDetailModal({ record, linkedActions, onClose, onEdit, onDelete, onActionChanged }: CheckinDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionPatches, setActionPatches] = useState<Record<string, Partial<HomeReminder>>>({})
  const [deletedActionIds, setDeletedActionIds] = useState<string[]>([])
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingAction, setEditingAction] = useState<(ReminderEdit & { id: string }) | null>(null)
  const [reflectionAction, setReflectionAction] = useState<{ action: ActionRecord; historyAvailable: boolean } | null>(null)
  const [reflectionOutcomes, setReflectionOutcomes] = useState<ActionReflectionOutcome[]>(DEFAULT_REFLECTION_OUTCOMES)
  const presentation = getCheckinPresentation(record)
  const isUnknown = record.checkinType === 'unknown'
  const orbEntries = isUnknown ? [] : getHomeOrbEntries([record])
  const reflection = (record as CheckinRecordWithReflection).reflection?.trim()
  const actions = linkedActions.filter((action) => !deletedActionIds.includes(action.id)).map((action) => ({ ...action, ...actionPatches[action.id] }))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => { void listReflectionOutcomes().then((outcomes) => { if (outcomes.length) setReflectionOutcomes(outcomes) }).catch(() => undefined) }, [])

  const handleDelete = () => {
    if (!window.confirm('Xoá check-in này?')) return
    setIsDeleting(true)
    setDeleteError(null)
    void onDelete()
      .catch((reason: unknown) => setDeleteError(reason instanceof Error ? reason.message : 'Không thể xoá check-in.'))
      .finally(() => setIsDeleting(false))
  }

  const refreshHome = () => {
    void onActionChanged().catch((reason: unknown) => setActionError(reason instanceof Error ? reason.message : 'Không thể đồng bộ Action trên Home.'))
  }

  const handleToggleAction = async (action: HomeReminder) => {
    const shouldComplete = !isReminderCompleted(action)
    setActionBusyId(action.id)
    setActionError(null)
    try {
      const result = await setActionStatus(action.id, shouldComplete ? 'completed' : 'pending')
      setActionPatches((current) => ({ ...current, [action.id]: { ...current[action.id], status: shouldComplete ? 'completed' : 'pending', completedAt: shouldComplete ? new Date().toISOString() : null } }))
      refreshHome()
      if (shouldComplete) {
        const reflectionRecord: ActionRecord = { id: action.id, userId: '', title: action.title, note: action.note, plannedDate: action.plannedDate, plannedEndDate: action.plannedEndDate ?? null, dueTime: action.dueTime, status: 'completed', completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), origin: action.origin, sourceCheckinId: action.sourceCheckinId, careActionId: null }
        setReflectionAction({ action: reflectionRecord, historyAvailable: result.historyAvailable })
      }
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể cập nhật Action.')
    } finally {
      setActionBusyId(null)
    }
  }

  const handleSaveAction = async () => {
    if (!editingAction) return
    setActionBusyId(editingAction.id)
    setActionError(null)
    try {
      await updateReminder(editingAction.id, editingAction)
      setActionPatches((current) => ({ ...current, [editingAction.id]: { ...current[editingAction.id], title: editingAction.title.trim(), note: editingAction.note.trim() || null, plannedDate: editingAction.plannedDate || null, dueTime: editingAction.dueTime || null } }))
      setEditingAction(null)
      refreshHome()
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể lưu Action.')
    } finally {
      setActionBusyId(null)
    }
  }

  const handleDeleteAction = async (action: HomeReminder) => {
    if (!window.confirm(`Xoá action “${action.title}”?`)) return
    setActionBusyId(action.id)
    setActionError(null)
    try {
      await deleteReminder(action.id)
      setDeletedActionIds((current) => current.includes(action.id) ? current : [...current, action.id])
      refreshHome()
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xoá Action.')
    } finally {
      setActionBusyId(null)
    }
  }

    return <div className="home-v2__modal-backdrop" role="presentation" onClick={onClose}>
      <section className="home-v2__detail-modal" role="dialog" aria-modal="true" aria-labelledby="home-checkin-detail-title" onClick={(event) => event.stopPropagation()}>
        <button className="home-v2__modal-close" type="button" aria-label="Đóng chi tiết Check-in" onClick={onClose}>×</button>
        <div className="home-v2__detail-scroll">
          <div className="home-v2__detail-layout">
            <div className="home-v2__detail-content">
              <header className="home-v2__detail-header">
                <div>
                  <p className="home-v2__eyebrow">{formatCheckinDate(record.createdAt)}</p>
                  <h2 id="home-checkin-detail-title">{presentation.emoji} {presentation.title}</h2>
                  {!isUnknown && record.primaryEmotion && <p className="home-v2__detail-header-language">{record.primaryEmotion.emotion_name_en}</p>}
                </div>
                <time dateTime={record.createdAt}>{formatCheckinTime(record.createdAt)}</time>
              </header>

              <div className="home-v2__detail-overview">
                <div className="home-v2__detail-overview-orb"><HomeOrb entries={orbEntries} size="medium" label="Color Orb chi tiết Check-in" /></div>
                <div className="home-v2__detail-overview-copy">
                  {isUnknown
                    ? <div className="home-v2__detail-overview-facts">
                        <div className="home-v2__detail-overview-fact home-v2__detail-overview-fact--wide"><span className="home-v2__detail-label">Câu hỏi đã chọn</span><p className="home-v2__prompt-detail"><span>{record.unknownPrompt?.emoji ?? presentation.emoji}</span>{record.unknownPrompt?.prompt_text_vn ?? 'Khoảng dừng chưa có câu hỏi hiển thị.'}</p></div>
                        <div className="home-v2__detail-overview-fact"><span className="home-v2__detail-label">Màu trình bày</span><div className="home-v2__detail-color"><span style={{ background: presentation.color }} />Màu tím trung tính · {presentation.color}</div></div>
                      </div>
                    : <div className="home-v2__detail-overview-facts">
                        <div className="home-v2__detail-overview-fact"><span className="home-v2__detail-label">Cường độ</span><div className="home-v2__detail-intensity-inline"><strong>{record.intensity ?? '—'} / 5</strong>{record.intensity && <IntensityDots value={record.intensity} />}</div></div>
                        <div className="home-v2__detail-overview-fact"><span className="home-v2__detail-label">Màu sắc chính</span><div className="home-v2__detail-color"><span style={{ background: presentation.color }} />{presentation.color}</div></div>
                      </div>}
                </div>
              </div>

              {!isUnknown && record.secondaryEmotions.length > 0 && <DetailSection label="Cảm xúc phụ"><TagList items={record.secondaryEmotions.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /></DetailSection>}
              {!isUnknown && record.needs.length > 0 && <DetailSection label="Nhu cầu"><TagList items={record.needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /></DetailSection>}
              {!isUnknown && record.contexts.length > 0 && <DetailSection label="Bối cảnh"><TagList items={record.contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /></DetailSection>}
              <DetailSection label="Ghi chú"><p className="home-v2__detail-note">{record.note || 'Không có ghi chú.'}</p></DetailSection>
            </div>

            <aside className="home-v2__detail-summary">
              <div className="home-v2__detail-summary-heading"><span className="home-v2__eyebrow">Tóm tắt</span><span className="home-v2__detail-summary-icon" aria-hidden="true">✦</span></div>
              <div className="home-v2__detail-summary-identity">
                <HomeOrb entries={orbEntries} size="small" label="Color Orb tóm tắt Check-in" />
                <div className="home-v2__detail-summary-identity-copy"><strong>{presentation.emoji} {presentation.title}</strong>{!isUnknown && record.primaryEmotion && <small>{record.primaryEmotion.emotion_name_en}</small>}{isUnknown && record.unknownPrompt && <small>{record.unknownPrompt.prompt_text_vn}</small>}</div>
              </div>
              {!isUnknown && record.intensity && <div className="home-v2__detail-summary-intensity"><strong>{record.intensity} / 5</strong><span>Cường độ</span></div>}
              {!isUnknown && record.primaryEmotion && <div className="home-v2__detail-summary-descriptions">
                <div className="home-v2__detail-summary-description-block"><span className="home-v2__detail-label">Mô tả tiếng Việt</span><p>{record.primaryEmotion.description_vn}</p></div>
                <div className="home-v2__detail-summary-description-block home-v2__detail-summary-description-block--en"><span className="home-v2__detail-label">English description</span><p>{record.primaryEmotion.description_en}</p></div>
              </div>}
              {isUnknown && <div className="home-v2__detail-summary-unknown"><span style={{ background: presentation.color }} />Màu trình bày trung tính</div>}
              {reflection && <DetailSection label="Phản chiếu"><p>{reflection}</p></DetailSection>}
              <DetailSection label={`Việc cần làm liên kết (${actions.length})`}><div className="home-v2__detail-actions">{actions.length ? actions.map((action) => <div className="home-v2__detail-action" key={action.id}>
                <button className="home-v2__detail-action-toggle" type="button" disabled={actionBusyId === action.id} aria-label={isReminderCompleted(action) ? `Hoàn tác: ${action.title}` : `Đánh dấu hoàn thành: ${action.title}`} aria-pressed={isReminderCompleted(action)} onClick={() => void handleToggleAction(action)}><span className={`home-v2__action-status ${isReminderCompleted(action) ? 'is-completed' : ''}`}>{isReminderCompleted(action) ? '✓' : ''}</span></button>
                <div className="home-v2__detail-action-copy"><strong>{action.title}</strong><small>{formatReminderSchedule(action)} · {isReminderCompleted(action) ? 'Đã hoàn thành' : 'Đang chờ'}</small></div>
                <div className="home-v2__detail-action-controls"><Link to="/action-space" aria-label={`Mở action: ${action.title}`}>Mở</Link><button type="button" disabled={actionBusyId === action.id} onClick={() => setEditingAction({ id: action.id, title: action.title, note: action.note ?? '', plannedDate: action.plannedDate ?? '', dueTime: action.dueTime ?? '' })}>Sửa</button><button type="button" disabled={actionBusyId === action.id} onClick={() => void handleDeleteAction(action)}>Xoá</button></div>
              </div>) : <p>Chưa có action cho khoảng dừng này.</p>}</div></DetailSection>
              {editingAction && <div className="home-v2__detail-action-editor">
                <span className="home-v2__detail-label">Chỉnh sửa Action</span>
                <input aria-label="Tên action" value={editingAction.title} onChange={(event) => setEditingAction({ ...editingAction, title: event.target.value })} />
                <div><input aria-label="Ngày dự kiến" type="date" value={editingAction.plannedDate} onChange={(event) => setEditingAction({ ...editingAction, plannedDate: event.target.value })} /><input aria-label="Giờ đến hạn" type="time" value={editingAction.dueTime} onChange={(event) => setEditingAction({ ...editingAction, dueTime: event.target.value })} /></div>
                <textarea aria-label="Ghi chú action" value={editingAction.note} onChange={(event) => setEditingAction({ ...editingAction, note: event.target.value })} placeholder="Ghi chú (tuỳ chọn)" />
                <div><button className="button button--secondary button--small" type="button" onClick={() => setEditingAction(null)}>Huỷ</button><button className="button button--primary button--small" type="button" disabled={actionBusyId === editingAction.id || !editingAction.title.trim()} onClick={() => void handleSaveAction()}>Lưu</button></div>
              </div>}
              {actionError && <p className="home-v2__modal-error" role="alert">{actionError}</p>}
            </aside>
          </div>

          {deleteError && <p className="home-v2__modal-error" role="alert">{deleteError}</p>}
        </div>
        <footer className="home-v2__detail-footer"><div><button className="button button--secondary" type="button" onClick={onEdit} disabled={isDeleting}>Chỉnh sửa</button><button className="button button--danger" type="button" disabled={isDeleting} onClick={handleDelete}>{isDeleting ? 'Đang xoá…' : 'Xoá check-in'}</button></div><button className="button button--primary" type="button" onClick={onClose}>Đóng</button></footer>
        {reflectionAction && <ReflectionModal action={reflectionAction.action} checkin={record} outcomes={reflectionOutcomes} historyAvailable={reflectionAction.historyAvailable} onClose={() => setReflectionAction(null)} onSave={async (outcome, note) => { await saveActionReflection(reflectionAction.action.id, outcome, note); setReflectionAction(null); refreshHome() }} />}
      </section>
    </div>
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="home-v2__detail-section"><span className="home-v2__detail-label">{label}</span>{children}</section>
}
