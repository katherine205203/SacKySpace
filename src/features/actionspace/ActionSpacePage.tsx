import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_REFLECTION_OUTCOMES,
  createAction,
  deleteAction,
  getActionRhythm,
  getActionScheduleLabel,
  getActionTabItems,
  getUpcomingGroups,
  getLinkedCheckin,
  isActionCompleted,
  listReflectionOutcomes,
  linkActionToCheckin,
  loadActionSpaceSnapshot,
  saveActionReflection,
  setActionStatus,
  updateAction,
} from './actionService'
import { getActionAccentColor } from './actionPresentation'
import type { ActionDraft, ActionRecord, ActionReflection, ActionReflectionOutcome, ActionSpaceSnapshot, ActionTab } from './types'
import type { CheckinRecord } from '../checkin/types'
import './actionspace.css'

const tabs: { value: ActionTab; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'unscheduled', label: 'Chưa lên lịch' },
  { value: 'completed', label: 'Đã hoàn thành' },
]

const emptyDraft = (): ActionDraft => ({
  title: '',
  note: '',
  scheduleType: 'none',
  plannedDate: '',
  plannedEndDate: '',
  dueTime: '',
  sourceCheckinId: null,
})

const draftFromAction = (action: ActionRecord): ActionDraft => ({
  title: action.title,
  note: action.note ?? '',
  scheduleType: action.plannedDate ? (action.plannedEndDate && action.plannedEndDate !== action.plannedDate ? 'date_range' : 'date') : 'none',
  plannedDate: action.plannedDate ?? '',
  plannedEndDate: action.plannedEndDate ?? '',
  dueTime: action.dueTime ?? '',
  sourceCheckinId: action.sourceCheckinId,
})

const formatCheckinDate = (createdAt: string): string => new Date(createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
const formatCompletedAt = (completedAt: string | null): string | null => completedAt
  ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(completedAt))
  : null

const formatActionSpaceError = (_reason: unknown): string => 'Không thể tải Action Space lúc này. Thử lại nhé.'

const actionColor = (action: ActionRecord, snapshot: ActionSpaceSnapshot): string => {
  return getActionAccentColor(action, snapshot.checkins)
}

const linkedCheckinLabel = (action: ActionRecord, snapshot: ActionSpaceSnapshot): string | null => {
  const checkin = getLinkedCheckin(action, snapshot.checkins)
  if (!checkin) return null
  return checkin.primaryEmotion?.emotion_name_vn ?? checkin.unknownPrompt?.prompt_text_vn ?? 'Unknown Check-in'
}

export function ActionSpacePage() {
  const [snapshot, setSnapshot] = useState<ActionSpaceSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ActionTab>('today')
  const [composer, setComposer] = useState<{ action: ActionRecord | null } | null>(null)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [reflection, setReflection] = useState<{ action: ActionRecord; historyAvailable: boolean } | null>(null)
  const [reflectionOutcomes, setReflectionOutcomes] = useState<ActionReflectionOutcome[]>(DEFAULT_REFLECTION_OUTCOMES)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadedAt] = useState(() => Date.now())

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await loadActionSpaceSnapshot()
      setSnapshot(next)
      const outcomes = await listReflectionOutcomes()
      setReflectionOutcomes(outcomes.length ? outcomes : DEFAULT_REFLECTION_OUTCOMES)
    } catch (reason: unknown) {
      setError(formatActionSpaceError(reason))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const actions = snapshot?.actions ?? []
  const selectedAction = selectedActionId ? actions.find((action) => action.id === selectedActionId) ?? null : null
  const visibleActions = useMemo(() => snapshot ? getActionTabItems(snapshot.actions, tab) : [], [snapshot, tab])
  const todayActions = useMemo(() => snapshot ? getActionTabItems(snapshot.actions, 'today') : [], [snapshot])
  const completedActions = useMemo(() => snapshot ? getActionTabItems(snapshot.actions, 'completed') : [], [snapshot])
  const rhythm = useMemo(() => snapshot ? getActionRhythm(snapshot.actions) : [], [snapshot])
  const helpfulCount = useMemo(() => {
    if (!snapshot) return 0
    const helpful = new Set(reflectionOutcomes.filter((outcome) => outcome.semanticGroup === 'positive').map((outcome) => outcome.id))
    return snapshot.reflections.filter((item) => helpful.has(item.outcomeId)).length
  }, [reflectionOutcomes, snapshot])

  const runCreate = async (draft: ActionDraft) => {
    await createAction(draft)
    setComposer(null)
    await refresh()
  }

  const runUpdate = async (action: ActionRecord, draft: ActionDraft) => {
    await updateAction(action.id, draft)
    setComposer(null)
    setSelectedActionId(action.id)
    await refresh()
  }

  const handleDone = async (action: ActionRecord) => {
    const nextStatus = isActionCompleted(action) ? 'pending' : 'completed'
    setBusyActionId(action.id)
    setNotice(null)
    try {
      const result = await setActionStatus(action.id, nextStatus)
      setSnapshot((current) => current ? { ...current, actions: current.actions.map((item) => item.id === action.id ? { ...item, status: nextStatus, completedAt: nextStatus === 'completed' ? new Date().toISOString() : null } : item) } : current)
      if (nextStatus === 'completed') {
        setReflection({ action: { ...action, status: 'completed', completedAt: new Date().toISOString() }, historyAvailable: result.historyAvailable })
      }
      void refresh()
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : 'Không thể cập nhật Action.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleDelete = async (action: ActionRecord) => {
    if (!window.confirm(`Xoá action “${action.title}”?`)) return
    setBusyActionId(action.id)
    setNotice(null)
    try {
      await deleteAction(action.id)
      setSelectedActionId(null)
      await refresh()
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : 'Không thể xoá Action.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleReflectionSave = async (action: ActionRecord, outcome: ActionReflectionOutcome, note: string) => {
    await saveActionReflection(action.id, outcome, note)
    setReflection(null)
    await refresh()
  }

  if (isLoading && !snapshot) return <section className="action-space" role="status"><p className="eyebrow">Sắc Ký · Action Space</p><h1>Action Space</h1><p className="action-space__loading">Đang gom những bước nhỏ của bạn…</p></section>
  if (!snapshot) return <section className="action-space action-space--error" role="alert"><p className="eyebrow">Sắc Ký · Action Space</p><h1>Chưa thể mở Action Space</h1><p>{error ?? 'Dữ liệu chưa sẵn sàng.'}</p><button className="button button--secondary" type="button" onClick={() => void refresh()}>Thử lại</button></section>

  return <section className="action-space" aria-labelledby="action-space-title">
    <header className="action-space__header">
      <div>
        <p className="eyebrow">Sắc Ký · Capture → Plan → Reflect</p>
        <h1 id="action-space-title">Action Space</h1>
        <p>Những bước nhỏ đang chờ bạn — có thể lên lịch, hoặc để dành cho lúc sẵn sàng.</p>
      </div>
      <button className="button button--primary" type="button" onClick={() => setComposer({ action: null })}>＋ Thêm action</button>
    </header>

    {error && <p className="action-space__notice" role="alert">Không thể làm mới dữ liệu: {error}</p>}
    {notice && <p className="action-space__notice" role="alert">{notice}</p>}

    <div className="action-space__metrics" aria-label="Tóm tắt Action Space">
      <Metric label="Cần làm hôm nay" value={todayActions.length} />
      <Metric label="Đã làm tuần này" value={completedActions.filter((action) => action.completedAt && loadedAt - new Date(action.completedAt).getTime() <= 7 * 86_400_000).length} />
      <Metric label="Nhịp hành động" value={`${rhythm.filter(Boolean).length}/7 ngày`} />
      <Metric label="Những bước từng giúp" value={snapshot.reflectionStorageAvailable ? helpfulCount : '—'} />
    </div>

    <div className="action-space__layout">
      <main className="action-space__main">
        <nav className="action-space__tabs" aria-label="Các nhóm Action" role="tablist">
          {tabs.map((item) => <button key={item.value} className={tab === item.value ? 'is-active' : undefined} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)}>{item.label}<span>{getActionTabItems(actions, item.value).length}</span></button>)}
        </nav>
        {tab === 'upcoming' ? <UpcomingGroups snapshot={snapshot} reflectionOutcomes={reflectionOutcomes} onSelect={setSelectedActionId} onDone={(action) => void handleDone(action)} busyActionId={busyActionId} /> : <ActionList actions={visibleActions} snapshot={snapshot} tab={tab} onSelect={setSelectedActionId} onDone={(action) => void handleDone(action)} busyActionId={busyActionId} reflectionOutcomes={reflectionOutcomes} />}
      </main>
      <ActionInsightRail tab={tab} rhythm={rhythm} completedCount={completedActions.length} helpfulCount={helpfulCount} unscheduledCount={getActionTabItems(actions, 'unscheduled').length} overdueCount={getActionTabItems(actions, 'overdue').length} />
    </div>

    {composer && <ActionComposerModal action={composer.action} snapshot={snapshot} onClose={() => setComposer(null)} onSubmit={(draft) => composer.action ? runUpdate(composer.action, draft) : runCreate(draft)} />}
    {selectedAction && <ActionDetailDrawer action={selectedAction} snapshot={snapshot} reflections={snapshot.reflections.filter((item) => item.actionId === selectedAction.id)} onClose={() => setSelectedActionId(null)} onEdit={() => setComposer({ action: selectedAction })} onDone={() => void handleDone(selectedAction)} onDelete={() => void handleDelete(selectedAction)} onLink={async (checkinId) => { await linkActionToCheckin(selectedAction.id, checkinId); await refresh() }} busy={busyActionId === selectedAction.id} reflectionOutcomes={reflectionOutcomes} />}
    {reflection && <ReflectionModal action={reflection.action} checkin={reflection.action.sourceCheckinId ? snapshot.checkins.find((checkin) => checkin.id === reflection.action.sourceCheckinId) ?? null : null} outcomes={reflectionOutcomes} historyAvailable={reflection.historyAvailable} onClose={() => setReflection(null)} onSave={(outcome, note) => handleReflectionSave(reflection.action, outcome, note)} />}
  </section>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="action-space__metric"><span>{label}</span><strong>{value}</strong></div>
}

function ActionList({ actions, snapshot, tab, onSelect, onDone, busyActionId, reflectionOutcomes }: { actions: ActionRecord[]; snapshot: ActionSpaceSnapshot; tab: ActionTab; onSelect: (id: string) => void; onDone: (action: ActionRecord) => void; busyActionId: string | null; reflectionOutcomes: ActionReflectionOutcome[] }) {
  return <section className="action-list" aria-live="polite">
    <div className="action-list__heading"><div><span className="section-label">{tab === 'today' ? 'Những bước hôm nay' : tabs.find((item) => item.value === tab)?.label}</span><h2>{tab === 'overdue' ? 'Có vài action vẫn đang chờ bạn.' : tab === 'unscheduled' ? 'Những điều bạn muốn giữ lại' : tab === 'completed' ? 'Những bước bạn đã làm được' : 'Đi từng bước vừa đủ.'}</h2></div><span className="action-list__count">{actions.length} action</span></div>
    {actions.length ? <div className="action-list__items">{actions.map((action) => <ActionCard key={action.id} action={action} snapshot={snapshot} reflections={snapshot.reflections.filter((item) => item.actionId === action.id)} reflectionOutcomes={reflectionOutcomes} showDone={tab !== 'completed'} onSelect={() => onSelect(action.id)} onDone={() => onDone(action)} busy={busyActionId === action.id} />)}</div> : <ActionEmpty tab={tab} />}
  </section>
}

function UpcomingGroups({ snapshot, reflectionOutcomes, onSelect, onDone, busyActionId }: { snapshot: ActionSpaceSnapshot; reflectionOutcomes: ActionReflectionOutcome[]; onSelect: (id: string) => void; onDone: (action: ActionRecord) => void; busyActionId: string | null }) {
  const groups = useMemo(() => getUpcomingGroups(snapshot.actions), [snapshot.actions])
  if (!groups.length) return <ActionEmpty tab="upcoming" />
  return <section className="action-list action-list--groups">{groups.map((group) => <div className="action-group" key={group.label}><div className="action-group__heading"><span className="section-label">{group.label}</span><span>{group.items.length}</span></div><div className="action-list__items">{group.items.map((action) => <ActionCard key={action.id} action={action} snapshot={snapshot} reflections={snapshot.reflections.filter((item) => item.actionId === action.id)} reflectionOutcomes={reflectionOutcomes} showDone onSelect={() => onSelect(action.id)} onDone={() => onDone(action)} busy={busyActionId === action.id} />)}</div></div>)}</section>
}

function ActionCard({ action, snapshot, reflections, reflectionOutcomes, showDone, onSelect, onDone, busy }: { action: ActionRecord; snapshot: ActionSpaceSnapshot; reflections: ActionReflection[]; reflectionOutcomes: ActionReflectionOutcome[]; showDone: boolean; onSelect: () => void; onDone: () => void; busy: boolean }) {
  const color = actionColor(action, snapshot)
  const linked = linkedCheckinLabel(action, snapshot)
  const latestReflection = reflections[0]
  const reflectionLabel = latestReflection ? reflectionOutcomes.find((outcome) => outcome.id === latestReflection.outcomeId)?.labelVn ?? latestReflection.outcomeSnapshot : null
  return <article className={`action-card ${isActionCompleted(action) ? 'is-completed' : ''}`} style={{ '--action-color': color } as CSSProperties}>
    <button className="action-card__open" type="button" onClick={onSelect} aria-label={`Mở chi tiết ${action.title}`}>
      <span className="action-card__rail" aria-hidden="true" />
      <span className="action-card__icon" aria-hidden="true">{isActionCompleted(action) ? '✓' : '↳'}</span>
      <span className="action-card__body"><strong>{action.title}</strong>{action.note && <small>{action.note}</small>}<span className="action-card__meta"><span>{linked ? `Từ Check-in · ${linked}` : 'Action độc lập'}</span><span>{isActionCompleted(action) ? `Hoàn thành · ${formatCompletedAt(action.completedAt) ?? 'đã ghi nhận'}` : getActionScheduleLabel(action)}</span></span>{reflectionLabel && <span className="action-card__reflection-chip">{reflectionLabel}</span>}</span>
    </button>
    {showDone && <button className={`action-card__done ${isActionCompleted(action) ? 'is-done' : ''}`} type="button" disabled={busy} onClick={onDone}>{isActionCompleted(action) ? 'Đã xong' : 'Xong'}</button>}
  </article>
}

function ActionEmpty({ tab }: { tab: ActionTab }) {
  const copy = tab === 'unscheduled' ? 'Bạn có thể ghi lại một action trước, rồi lên lịch sau.' : tab === 'overdue' ? 'Mọi thứ đang ở đúng nhịp của bạn.' : tab === 'completed' ? 'Những bước đã làm sẽ ở lại đây.' : 'Chưa có action nào trong nhóm này.'
  return <div className="action-empty"><span aria-hidden="true">✦</span><strong>{copy}</strong>{tab !== 'completed' && <Link to="/checkin">Tạo một Check-in để bắt đầu từ điều đang hiện diện.</Link>}</div>
}

function ActionInsightRail({ tab, rhythm, completedCount, helpfulCount, unscheduledCount, overdueCount }: { tab: ActionTab; rhythm: boolean[]; completedCount: number; helpfulCount: number; unscheduledCount: number; overdueCount: number }) {
  const copy = tab === 'overdue' ? 'Không cần vội. Bạn có thể hoàn thành hoặc đổi lịch cho một bước đang chờ.' : tab === 'unscheduled' ? 'Capture trước, plan sau. Một action chưa có ngày vẫn là một action hợp lệ.' : tab === 'completed' ? 'Những điều đã làm được có thể giúp bạn nhận ra điều gì thực sự nâng đỡ mình.' : 'Action Space giữ cho bước tiếp theo đủ nhỏ để bạn còn ở cùng chính mình.'
  return <aside className="action-space__rail-panel"><div className="action-rail-card action-rail-card--intro"><span className="section-label">{tab === 'today' ? 'Nhịp hôm nay' : 'Một khoảng nhìn lại'}</span><p>{copy}</p></div><div className="action-rail-card"><div className="action-rail-card__heading"><strong>Nhịp hành động</strong><small>7 ngày gần đây</small></div><div className="action-rhythm" aria-label={`${rhythm.filter(Boolean).length} trên 7 ngày có hoàn thành action`}>{rhythm.map((active, index) => <span className={active ? 'is-active' : ''} key={index}><i />{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}</span>)}</div></div><div className="action-rail-card action-rail-card--numbers"><div><span>Những bước nhỏ</span><strong>{completedCount}</strong><small>bước nhỏ đã làm được</small></div><div><span>Những bước từng giúp</span>{helpfulCount ? <><strong>{helpfulCount}</strong><small>lần thấy dễ hơn</small></> : <p>Chưa đủ dữ liệu để nhìn lại.</p>}</div></div>{(unscheduledCount > 0 || overdueCount > 0) && <div className="action-rail-card action-rail-card--quiet">{unscheduledCount > 0 && <span>{unscheduledCount} action chưa lên lịch</span>}{overdueCount > 0 && <span>{overdueCount} action đang chờ được nhìn lại</span>}</div>}</aside>
}

function ActionComposerModal({ action, snapshot, onClose, onSubmit }: { action: ActionRecord | null; snapshot: ActionSpaceSnapshot; onClose: () => void; onSubmit: (draft: ActionDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<ActionDraft>(() => action ? draftFromAction(action) : emptyDraft())
  const [checkinQuery, setCheckinQuery] = useState('')
  const [showMoreCheckins, setShowMoreCheckins] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedCheckin = draft.sourceCheckinId ? snapshot.checkins.find((item) => item.id === draft.sourceCheckinId) ?? null : null
  const checkins = snapshot.checkins.filter((checkin) => {
    if (!checkinQuery.trim()) return true
    const value = `${checkin.primaryEmotion?.emotion_name_vn ?? ''} ${checkin.primaryEmotion?.emotion_name_en ?? ''} ${checkin.note ?? ''} ${checkin.unknownPrompt?.prompt_text_vn ?? ''}`.toLocaleLowerCase()
    return value.includes(checkinQuery.trim().toLocaleLowerCase())
  }).slice(0, checkinQuery.trim() || showMoreCheckins ? 8 : 3)
  const activeCountFor = (id: string) => snapshot.actions.filter((item) => item.id !== action?.id && item.sourceCheckinId === id && !isActionCompleted(item)).length
  const submit = async () => {
    if (!draft.title.trim()) { setError('Hãy nhập tên action.'); return }
    if (draft.scheduleType === 'date' && !draft.plannedDate) { setError('Hãy chọn ngày hoặc để action chưa lên lịch.'); return }
    if (draft.scheduleType === 'date_range' && (!draft.plannedDate || !draft.plannedEndDate || draft.plannedEndDate < draft.plannedDate)) { setError('Khoảng ngày chưa hợp lệ.'); return }
    setIsSaving(true)
    setError(null)
    try { await onSubmit(draft) } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể lưu Action.') } finally { setIsSaving(false) }
  }
  return <div className="action-modal-backdrop" role="presentation" onClick={onClose}><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-modal-title" onClick={(event) => event.stopPropagation()}><button className="action-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><header><p className="eyebrow">{action ? 'Chỉnh sửa action' : 'Capture'}</p><h2 id="action-modal-title">{action ? 'Giữ action đúng với bạn' : 'Bạn muốn làm gì?'}</h2><p>Một bước nhỏ cũng đủ. Lên lịch khi bạn muốn, hoặc để dành trong Chưa lên lịch.</p></header><div className="action-modal__fields"><label><span>Tên action <em>*</em></span><input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: Đi bộ 10 phút" /></label><label><span>Ghi chú <small>tuỳ chọn</small></span><textarea rows={3} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Điều gì sẽ giúp bước này vừa đủ?" /></label><section className="action-modal__section" aria-labelledby="schedule-label"><h3 id="schedule-label">Lên lịch</h3><div className="schedule-choices">{([['none', 'Chưa lên lịch'], ['date', 'Một ngày'], ['date_range', 'Khoảng ngày']] as const).map(([value, label]) => <button key={value} className={draft.scheduleType === value ? 'is-selected' : ''} type="button" onClick={() => setDraft((current) => ({ ...current, scheduleType: value }))}>{label}</button>)}</div>{draft.scheduleType !== 'none' && <div className="schedule-inputs"><label><span>{draft.scheduleType === 'date_range' ? 'Từ ngày' : 'Ngày'}</span><input type="date" value={draft.plannedDate} onChange={(event) => setDraft((current) => ({ ...current, plannedDate: event.target.value }))} /></label>{draft.scheduleType === 'date_range' && <label><span>Đến ngày</span><input type="date" value={draft.plannedEndDate} onChange={(event) => setDraft((current) => ({ ...current, plannedEndDate: event.target.value }))} /></label>}<label><span>Giờ <small>tuỳ chọn</small></span><input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} /></label></div>}</section><section className="action-modal__section" aria-labelledby="checkin-label"><h3 id="checkin-label">Gắn với Check-in <small>tuỳ chọn</small></h3>{selectedCheckin ? <div className="selected-checkin" style={{ '--checkin-color': selectedCheckin.primaryEmotion?.color_hex ?? '#b8a5df' } as CSSProperties}><span>{selectedCheckin.primaryEmotion?.emoji ?? selectedCheckin.unknownPrompt?.emoji ?? '◌'}</span><div><strong>{selectedCheckin.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'}</strong><small>{formatCheckinDate(selectedCheckin.createdAt)} · {selectedCheckin.note || selectedCheckin.unknownPrompt?.prompt_text_vn || 'Không có ghi chú'}</small></div><button type="button" onClick={() => setDraft((current) => ({ ...current, sourceCheckinId: null }))}>Bỏ gắn</button></div> : <><div className="checkin-picker-toolbar"><input value={checkinQuery} onChange={(event) => { setCheckinQuery(event.target.value); setShowMoreCheckins(Boolean(event.target.value)) }} placeholder="Tìm Check-in gần đây…" aria-label="Tìm Check-in" /></div><div className="checkin-picker-list">{checkins.map((checkin) => { const count = activeCountFor(checkin.id); const disabled = count >= 2; const name = checkin.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'; return <button key={checkin.id} className="checkin-picker-item" style={{ '--checkin-color': checkin.primaryEmotion?.color_hex ?? '#b8a5df' } as CSSProperties} disabled={disabled} type="button" onClick={() => setDraft((current) => ({ ...current, sourceCheckinId: checkin.id }))}><span>{checkin.primaryEmotion?.emoji ?? checkin.unknownPrompt?.emoji ?? '◌'}</span><span><strong>{name}</strong><small>{formatCheckinDate(checkin.createdAt)} · {disabled ? 'Đã đủ 2 action đang hoạt động' : (checkin.note || checkin.unknownPrompt?.prompt_text_vn || 'Check-in không có ghi chú')}</small></span><i>{disabled ? 'Đủ' : 'Gắn'}</i></button> })}{!checkins.length && <small className="muted-text">Không tìm thấy Check-in phù hợp.</small>}{!checkinQuery && !showMoreCheckins && snapshot.checkins.length > 3 && <button className="text-button checkin-picker-more" type="button" onClick={() => setShowMoreCheckins(true)}>Xem thêm</button>}</div></>}</section></div>{error && <p className="action-modal__error" role="alert">{error}</p>}<footer><button className="button button--secondary" type="button" onClick={onClose}>Hủy</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void submit()}>{isSaving ? 'Đang lưu…' : action ? 'Lưu thay đổi' : 'Thêm action'}</button></footer></section></div>
}

function ActionDetailDrawer({ action, snapshot, reflections, onClose, onEdit, onDone, onDelete, onLink, busy, reflectionOutcomes }: { action: ActionRecord; snapshot: ActionSpaceSnapshot; reflections: ActionReflection[]; onClose: () => void; onEdit: () => void; onDone: () => void; onDelete: () => void; onLink: (checkinId: string | null) => Promise<void>; busy: boolean; reflectionOutcomes: ActionReflectionOutcome[] }) {
  const linked = getLinkedCheckin(action, snapshot.checkins)
  const [linkError, setLinkError] = useState<string | null>(null)
  const unlink = async () => { try { await onLink(null) } catch (reason: unknown) { setLinkError(reason instanceof Error ? reason.message : 'Không thể bỏ liên kết.') } }
  return <div className="action-drawer-backdrop" role="presentation" onClick={onClose}><aside className="action-drawer" role="dialog" aria-modal="true" aria-labelledby="action-drawer-title" onClick={(event) => event.stopPropagation()} style={{ '--action-color': actionColor(action, snapshot) } as CSSProperties}><header><div><span className="section-label">Chi tiết Action</span><h2 id="action-drawer-title">{action.title}</h2></div><button className="action-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button></header><div className="action-drawer__rail" aria-hidden="true" /><div className="action-drawer__content"><div className="action-drawer__status"><span className={isActionCompleted(action) ? 'is-done' : ''}>{isActionCompleted(action) ? '✓' : '○'}</span><strong>{isActionCompleted(action) ? 'Đã hoàn thành' : 'Đang chờ'}</strong><small>{getActionScheduleLabel(action)}</small></div>{action.note && <section><span className="section-label">Ghi chú</span><p>{action.note}</p></section>}<section><span className="section-label">Nguồn</span><p>{action.origin === 'user_created' ? 'Tạo từ Action Space' : 'Sinh từ Check-in'}</p></section><section><div className="drawer-section-heading"><span className="section-label">Check-in hiện tại</span>{linked && <button className="text-button" type="button" onClick={() => void unlink()}>Bỏ gắn</button>}</div>{linked ? <p>{linked.primaryEmotion?.emoji ?? linked.unknownPrompt?.emoji} {linked.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'}</p> : <p className="muted-text">Action độc lập · có thể gắn sau từ Chỉnh sửa.</p>}</section>{linkError && <p className="action-modal__error">{linkError}</p>}<section><span className="section-label">Reflection</span>{reflections.length ? <div className="reflection-history">{reflections.map((item) => <div key={item.id}><strong>{reflectionOutcomes.find((outcome) => outcome.id === item.outcomeId)?.labelVn ?? item.outcomeSnapshot ?? item.outcomeId}</strong>{item.note && <p>{item.note}</p>}<small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></div>)}</div> : <p className="muted-text">Chưa có reflection cho lần hoàn thành này.</p>}</section></div><footer><button className="button button--secondary" type="button" onClick={onEdit}>Chỉnh sửa</button><button className={isActionCompleted(action) ? 'button button--secondary' : 'button button--primary'} type="button" disabled={busy} onClick={onDone}>{isActionCompleted(action) ? 'Đánh dấu chưa xong' : 'Đánh dấu xong'}</button><button className="button button--danger" type="button" disabled={busy} onClick={onDelete}>Xoá</button></footer></aside></div>
}

const getReflectionSource = (checkin: CheckinRecord | null | undefined) => {
  if (checkin?.primaryEmotion) return { emoji: checkin.primaryEmotion.emoji, nameVn: checkin.primaryEmotion.emotion_name_vn, nameEn: checkin.primaryEmotion.emotion_name_en, color: checkin.primaryEmotion.color_hex, sourceLabel: 'Từ Check-in' }
  if (checkin?.checkinType === 'unknown') return { emoji: checkin.unknownPrompt?.emoji ?? '◌', nameVn: 'Mình còn đang mơ hồ', nameEn: 'Unknown Check-in', color: '#7C9BEF', sourceLabel: 'Từ Unknown Check-in' }
  return { emoji: '✦', nameVn: 'Action Space', nameEn: 'Một bước nhỏ cho bạn', color: '#8D78E8', sourceLabel: 'Action độc lập' }
}

export function ReflectionModal({ action, checkin, outcomes, onClose, onSave }: { action: ActionRecord; checkin?: CheckinRecord | null; outcomes: ActionReflectionOutcome[]; historyAvailable?: boolean; onClose: () => void; onSave: (outcome: ActionReflectionOutcome, note: string) => Promise<void> }) {
  const availableOutcomes = outcomes.length ? outcomes : DEFAULT_REFLECTION_OUTCOMES
  const [selected, setSelected] = useState<ActionReflectionOutcome | null>(availableOutcomes[0] ?? null)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => { if (!selected) return; setIsSaving(true); setError(null); try { await onSave(selected, note) } catch { setError('Chưa thể lưu lại lúc này. Thử lại nhé.') } finally { setIsSaving(false) } }
  const source = getReflectionSource(checkin)
  const icons: Record<string, string> = { better: '↗', lighter: '≈', same: '—', not_better: '↘', other: '✦' }
  return <div className="action-modal-backdrop" role="presentation" onClick={onClose}><section className="reflection-modal" style={{ '--reflection-color': source.color } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="reflection-modal-title" onClick={(event) => event.stopPropagation()}><button className="action-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><div className="reflection-modal__layout"><aside className="reflection-modal__source"><div className="reflection-modal__source-orb" aria-hidden="true">{source.emoji}</div><span className="eyebrow">{source.sourceLabel}</span><strong>{source.nameVn}</strong><small>{source.nameEn}</small><div className="reflection-modal__source-action"><span>✓</span><p>{action.title}</p></div></aside><div className="reflection-modal__main"><p className="eyebrow">Một khoảng nhìn lại</p><h2 id="reflection-modal-title">Làm xong, bạn thấy thế nào rồi?</h2><p className="reflection-modal__prompt">Không cần câu trả lời hoàn hảo — chỉ cần điều đúng nhất với bạn lúc này.</p><div className="reflection-options" role="radiogroup" aria-label="Cảm nhận sau khi làm xong">{availableOutcomes.map((outcome) => <button key={outcome.id} className={`reflection-option reflection-option--${outcome.semanticGroup} ${selected?.id === outcome.id ? 'is-selected' : ''}`} type="button" role="radio" aria-checked={selected?.id === outcome.id} onClick={() => setSelected(outcome)}><span aria-hidden="true">{icons[outcome.id] ?? '◌'}</span><span>{outcome.labelVn}</span>{selected?.id === outcome.id && <b aria-hidden="true">✓</b>}</button>)}</div><label className="reflection-note"><span>Ghi chú tùy chọn</span><textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Viết một dòng nếu bạn muốn…" /></label>{error && <p className="action-modal__error" role="alert">{error}</p>}<footer><button className="button button--secondary" type="button" onClick={onClose}>Bỏ qua</button><button className="button button--primary" type="button" disabled={!selected || isSaving} onClick={() => void submit()}>{isSaving ? 'Đang lưu…' : 'Lưu lại'}</button></footer></div></div></section></div>
}
