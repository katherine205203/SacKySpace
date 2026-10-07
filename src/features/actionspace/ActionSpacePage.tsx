import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { ACTION_INDEPENDENT_COLOR, getActionAccentColor } from './actionPresentation'
import { useUiContent } from '../../services/uiContent'
import { PageHeading } from '../../components/PageHeading'
import type { ActionDraft, ActionRecord, ActionReflection, ActionReflectionOutcome, ActionSpaceSnapshot, ActionTab } from './types'
import type { CheckinRecord } from '../checkin/types'
import { getLocalDateKey } from '../checkin/utils/history'
import { useAutosave } from '../../hooks/useAutosave'
import { ReflectionModal } from './components/ReflectionModal'
import './actionspace.css'

const tabs: { value: ActionTab; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'unscheduled', label: 'Chưa lên lịch' },
  { value: 'completed', label: 'Đã hoàn thành' },
]

type ActionHistoryLens = 'timeline' | 'calendar' | 'reflection'
type ActionHistorySource = 'all' | 'checkin' | 'independent'
type ActionHistoryFilters = {
  start: string
  end: string
  source: ActionHistorySource
  emotionId: string
  outcomeId: string
}

const historyLenses: { value: ActionHistoryLens; label: string }[] = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Theo ngày' },
  { value: 'reflection', label: 'Reflection Lens' },
]

const emptyHistoryFilters = (): ActionHistoryFilters => ({ start: '', end: '', source: 'all', emotionId: 'all', outcomeId: 'all' })

const historyDateKey = (value: string): string => getLocalDateKey(value, 'Asia/Ho_Chi_Minh')
const formatHistoryDay = (dateKey: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${dateKey}T12:00:00+07:00`))
const formatHistoryMonth = (dateKey: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'long', year: 'numeric' }).format(new Date(`${dateKey}T12:00:00+07:00`))
const formatHistoryTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

const shiftMonth = (dateKey: string, amount: number): string => {
  const [year, month] = dateKey.slice(0, 7).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + amount, 1))
  return next.toISOString().slice(0, 10)
}

const getCalendarCells = (monthKey: string): Array<string | null> => {
  const [year, month] = monthKey.slice(0, 7).split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const firstMondayIndex = (firstDay.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [
    ...Array.from({ length: firstMondayIndex }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${monthKey.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`),
  ]
}

const emptyDraft = (): ActionDraft => ({
  title: '',
  note: '',
  scheduleType: 'none',
  plannedDate: '',
  plannedEndDate: '',
  dueTime: '',
  sourceCheckinId: null,
})

const ACTION_DRAFT_STORAGE_KEY = 'sacky:action-composer-draft:v1'
const readActionDraft = (): ActionDraft => {
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTION_DRAFT_STORAGE_KEY) ?? 'null') as Partial<ActionDraft> | null
    if (!value || typeof value.title !== 'string' || typeof value.note !== 'string') return emptyDraft()
    return { ...emptyDraft(), ...value }
  } catch {
    return emptyDraft()
  }
}

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
  const pageEyebrow = useUiContent('actionspace.landing.eyebrow')
  const pageTitle = useUiContent('actionspace.landing.title')
  const pageSubtitle = useUiContent('actionspace.landing.subtitle')
  const addButton = useUiContent('actionspace.landing.add_button')
  const historyButton = useUiContent('actionspace.landing.history_button')
  const historyEyebrow = useUiContent('actionspace.history.eyebrow')
  const historyTitle = useUiContent('actionspace.history.title')
  const historySubtitle = useUiContent('actionspace.history.subtitle')
  const [searchParams, setSearchParams] = useSearchParams()
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
  const isHistory = searchParams.get('view') === 'history'
  const historyLensParam = searchParams.get('lens')
  const historyLens: ActionHistoryLens = historyLenses.some((item) => item.value === historyLensParam) ? historyLensParam as ActionHistoryLens : 'timeline'
  const selectedAction = selectedActionId ? actions.find((action) => action.id === selectedActionId) ?? null : null
  const visibleActions = useMemo(() => snapshot ? getActionTabItems(snapshot.actions, tab) : [], [snapshot, tab])
  const completedActions = useMemo(() => snapshot ? getActionTabItems(snapshot.actions, 'completed') : [], [snapshot])
  const rhythm = useMemo(() => snapshot ? getActionRhythm(snapshot.actions) : [], [snapshot])
  const completedTodayCount = useMemo(() => {
    const today = getLocalDateKey(new Date().toISOString(), 'Asia/Ho_Chi_Minh')
    return completedActions.filter((action) => action.completedAt && getLocalDateKey(action.completedAt, 'Asia/Ho_Chi_Minh') === today).length
  }, [completedActions])

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

  const handleComposerAutosaved = useCallback((saved: ActionRecord) => {
    setSnapshot((current) => current ? { ...current, actions: current.actions.map((item) => item.id === saved.id ? saved : item) } : current)
  }, [])

  if (isLoading && !snapshot) return <section className="action-space" role="status"><p className="eyebrow">{pageEyebrow}</p><h1>{pageTitle}</h1><p className="action-space__loading">Đang gom những bước nhỏ của bạn…</p></section>
  if (!snapshot) return <section className="action-space action-space--error" role="alert"><p className="eyebrow">{pageEyebrow}</p><h1>Chưa thể mở {pageTitle}</h1><p>{error ?? 'Dữ liệu chưa sẵn sàng.'}</p><button className="button button--secondary" type="button" onClick={() => void refresh()}>Thử lại</button></section>

  if (isHistory) return <section className="action-space action-space--history" aria-labelledby="action-history-title">
    <PageHeading className="action-space__header" eyebrow={historyEyebrow} title={historyTitle} description={historySubtitle} titleId="action-history-title" actions={<><Link className="button button--secondary" to="/action-space">← Action Space</Link><button className="button button--primary" type="button" onClick={() => setComposer({ action: null })}>{addButton}</button></>} />
    {error && <p className="action-space__notice" role="alert">Không thể làm mới dữ liệu: {error}</p>}
    <ActionHistorySurface snapshot={snapshot} outcomes={reflectionOutcomes} lens={historyLens} onLensChange={(nextLens) => setSearchParams({ view: 'history', lens: nextLens })} />
    {composer && <ActionComposerModal action={composer.action} snapshot={snapshot} onClose={() => setComposer(null)} onAutosaved={handleComposerAutosaved} onSubmit={(draft) => composer.action ? runUpdate(composer.action, draft) : runCreate(draft)} />}
  </section>

  return <section className="action-space" aria-labelledby="action-space-title">
    <PageHeading className="action-space__header" eyebrow={pageEyebrow} title={pageTitle} description={pageSubtitle} titleId="action-space-title" actions={<><button className="button button--primary" type="button" onClick={() => setComposer({ action: null })}>{addButton}</button><Link className="button button--secondary" to="/action-space?view=history&lens=timeline">{historyButton}</Link></>} />

    {error && <p className="action-space__notice" role="alert">Không thể làm mới dữ liệu: {error}</p>}
    {notice && <p className="action-space__notice" role="alert">{notice}</p>}

    <div className="action-space__layout">
      <main className="action-space__main">
        <nav className="action-space__tabs" aria-label="Các nhóm Action" role="tablist">
          {tabs.map((item) => <button key={item.value} className={tab === item.value ? 'is-active' : undefined} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)}>{item.label}<span>{getActionTabItems(actions, item.value).length}</span></button>)}
        </nav>
        {tab === 'upcoming' ? <UpcomingGroups snapshot={snapshot} reflectionOutcomes={reflectionOutcomes} onSelect={setSelectedActionId} onDone={(action) => void handleDone(action)} busyActionId={busyActionId} /> : <ActionList actions={visibleActions} snapshot={snapshot} tab={tab} onSelect={setSelectedActionId} onDone={(action) => void handleDone(action)} busyActionId={busyActionId} reflectionOutcomes={reflectionOutcomes} />}
      </main>
      <ActionContextRail action={selectedAction} tab={tab} visibleActions={visibleActions} completedTodayCount={completedTodayCount} rhythm={rhythm} snapshot={snapshot} reflections={selectedAction ? snapshot.reflections.filter((item) => item.actionId === selectedAction.id) : []} reflectionOutcomes={reflectionOutcomes} onClose={() => setSelectedActionId(null)} onEdit={() => selectedAction && setComposer({ action: selectedAction })} onReschedule={() => selectedAction && setComposer({ action: selectedAction })} onDone={() => selectedAction && void handleDone(selectedAction)} onDelete={() => selectedAction && void handleDelete(selectedAction)} onLink={async (checkinId) => { if (selectedAction) { await linkActionToCheckin(selectedAction.id, checkinId); await refresh() } }} busy={Boolean(selectedAction && busyActionId === selectedAction.id)} />
    </div>

    {composer && <ActionComposerModal action={composer.action} snapshot={snapshot} onClose={() => setComposer(null)} onAutosaved={handleComposerAutosaved} onSubmit={(draft) => composer.action ? runUpdate(composer.action, draft) : runCreate(draft)} />}
    {reflection && <ReflectionModal action={reflection.action} checkin={reflection.action.sourceCheckinId ? snapshot.checkins.find((checkin) => checkin.id === reflection.action.sourceCheckinId) ?? null : null} outcomes={reflectionOutcomes} historyAvailable={reflection.historyAvailable} onClose={() => setReflection(null)} onSave={(outcome, note) => handleReflectionSave(reflection.action, outcome, note)} />}
  </section>
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
  const linkedCheckin = getLinkedCheckin(action, snapshot.checkins)
  const linked = linkedCheckin ? linkedCheckinLabel(action, snapshot) : null
  const sourceEmoji = linkedCheckin?.primaryEmotion?.emoji ?? linkedCheckin?.unknownPrompt?.emoji ?? '✨'
  const latestReflection = reflections[0]
  const reflectionLabel = latestReflection ? reflectionOutcomes.find((outcome) => outcome.id === latestReflection.outcomeId)?.labelVn ?? latestReflection.outcomeSnapshot : null
  return <article className={`action-card ${isActionCompleted(action) ? 'is-completed' : ''}`} style={{ '--action-color': color } as CSSProperties}>
    <button className="action-card__open" type="button" onClick={onSelect} aria-label={`Mở chi tiết ${action.title}`}>
      <span className="action-card__rail" aria-hidden="true" />
      <span className="action-card__icon" aria-hidden="true">{sourceEmoji ?? (isActionCompleted(action) ? '✓' : '✦')}</span>
      <span className="action-card__body"><strong>{action.title}</strong><span className="action-card__description">{action.note || 'Chưa thêm mô tả.'}</span><span className="action-card__meta"><span className="action-card__source">{linked ? `Từ Check-in · ${linked}` : 'Độc lập'}</span><span className="action-card__schedule">{isActionCompleted(action) ? `Hoàn thành · ${formatCompletedAt(action.completedAt) ?? 'đã ghi nhận'}` : getActionScheduleLabel(action)}</span></span>{reflectionLabel && <span className="action-card__reflection-chip">{reflectionLabel}</span>}</span>
    </button>
    {showDone && <button className={`action-card__done ${isActionCompleted(action) ? 'is-done' : ''}`} type="button" disabled={busy} onClick={onDone}><span aria-hidden="true">{isActionCompleted(action) ? '✓' : '○'}</span><span>{isActionCompleted(action) ? 'Đã xong' : 'Xong'}</span></button>}
  </article>
}

function ActionEmpty({ tab }: { tab: ActionTab }) {
  const todayCopy = useUiContent('actionspace.landing.today_empty')
  const copy = tab === 'unscheduled' ? 'Bạn có thể ghi lại một action trước, rồi lên lịch sau.' : tab === 'overdue' ? 'Mọi thứ đang ở đúng nhịp của bạn.' : tab === 'completed' ? 'Những bước đã làm sẽ ở lại đây.' : todayCopy
  return <div className="action-empty"><span aria-hidden="true">✦</span><strong>{copy}</strong>{tab !== 'completed' && <Link to="/checkin">Tạo một Check-in để bắt đầu từ điều đang hiện diện.</Link>}</div>
}

function ActionContextRail({ action, tab, visibleActions, completedTodayCount, rhythm, snapshot, reflections, reflectionOutcomes, onClose, onEdit, onReschedule, onDone, onDelete, onLink, busy }: { action: ActionRecord | null; tab: ActionTab; visibleActions: ActionRecord[]; completedTodayCount: number; rhythm: boolean[]; snapshot: ActionSpaceSnapshot; reflections: ActionReflection[]; reflectionOutcomes: ActionReflectionOutcome[]; onClose: () => void; onEdit: () => void; onReschedule: () => void; onDone: () => void; onDelete: () => void; onLink: (checkinId: string | null) => Promise<void>; busy: boolean }) {
  if (action) return <ActionDetailRail action={action} snapshot={snapshot} reflections={reflections} reflectionOutcomes={reflectionOutcomes} onClose={onClose} onEdit={onEdit} onReschedule={onReschedule} onDone={onDone} onDelete={onDelete} onLink={onLink} busy={busy} />

  const checkinCount = visibleActions.filter((item) => getLinkedCheckin(item, snapshot.checkins)).length
  const independentCount = visibleActions.length - checkinCount
  const isCompletedTab = tab === 'completed'
  return <aside className="action-space__rail-panel action-context-rail" aria-label="Tóm tắt theo ngữ cảnh">
    <div className="action-rail-card action-rail-card--intro"><span className="section-label">{isCompletedTab ? 'Đã hoàn thành' : tabs.find((item) => item.value === tab)?.label}</span><h2>{isCompletedTab ? 'Những bước đã khép lại' : 'Những gì đang ở đây'}</h2><p>{isCompletedTab ? 'Các Action vẫn ở lại cùng Reflection để bạn đọc lại khi cần.' : 'Danh sách là nơi chính để nhìn thấy bước tiếp theo của mình.'}</p></div>
    <div className="action-rail-card action-context-rail__stats"><div><span>{isCompletedTab ? 'Đã hoàn thành' : 'Đang chờ'}</span><strong>{isCompletedTab ? visibleActions.length : visibleActions.length}</strong></div><div><span>{isCompletedTab ? 'Có Reflection' : 'Đã xong hôm nay'}</span><strong>{isCompletedTab ? visibleActions.filter((item) => snapshot.reflections.some((reflection) => reflection.actionId === item.id)).length : completedTodayCount}</strong></div></div>
    <div className="action-rail-card"><div className="action-rail-card__heading"><strong>Nhịp 7 ngày</strong><small>{rhythm.filter(Boolean).length}/7 ngày có hoàn thành</small></div><div className="action-rhythm" aria-label={`${rhythm.filter(Boolean).length} trên 7 ngày có hoàn thành action`}>{rhythm.map((active, index) => <span className={active ? 'is-active' : ''} key={index}><i />{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}</span>)}</div></div>
    <div className="action-rail-card action-context-rail__sources"><div className="action-rail-card__heading"><strong>Theo nguồn</strong><small>Trong nhóm đang xem</small></div><div><span><i className="action-source-dot action-source-dot--checkin" />Từ Check-in</span><strong>{checkinCount}</strong></div><div><span><i className="action-source-dot action-source-dot--independent" />Độc lập</span><strong>{independentCount}</strong></div></div>
  </aside>
}

function ActionDetailRail({ action, snapshot, reflections, reflectionOutcomes, onClose, onEdit, onReschedule, onDone, onDelete, onLink, busy }: { action: ActionRecord; snapshot: ActionSpaceSnapshot; reflections: ActionReflection[]; reflectionOutcomes: ActionReflectionOutcome[]; onClose: () => void; onEdit: () => void; onReschedule: () => void; onDone: () => void; onDelete: () => void; onLink: (checkinId: string | null) => Promise<void>; busy: boolean }) {
  const linked = getLinkedCheckin(action, snapshot.checkins)
  const color = actionColor(action, snapshot)
  const linkedLabel = linked ? linkedCheckinLabel(action, snapshot) : null
  const [linkError, setLinkError] = useState<string | null>(null)
  const unlink = async () => {
    try { await onLink(null); setLinkError(null) } catch (reason: unknown) { setLinkError(reason instanceof Error ? reason.message : 'Không thể bỏ liên kết.') }
  }
  return <aside className="action-space__rail-panel action-detail-rail" aria-label={`Chi tiết ${action.title}`} style={{ '--action-color': color } as CSSProperties}>
    <div className="action-detail-rail__header"><div><span className="section-label">Chi tiết Action</span><h2>{action.title}</h2></div><button className="action-detail-rail__close" type="button" onClick={onClose} aria-label="Đóng chi tiết">×</button></div>
    <div className="action-detail-rail__content"><div className="action-detail-rail__identity"><span aria-hidden="true">{linked?.primaryEmotion?.emoji ?? linked?.unknownPrompt?.emoji ?? '✨'}</span><div><strong>{linkedLabel ? `Từ Check-in · ${linkedLabel}` : 'Độc lập'}</strong><small>{isActionCompleted(action) ? 'Đã hoàn thành' : 'Đang chờ'}</small></div></div><section><span className="section-label">Mô tả</span><p>{action.note || 'Chưa thêm mô tả.'}</p></section><section><span className="section-label">Lịch</span><p>{getActionScheduleLabel(action)}</p>{action.completedAt && <small>Hoàn thành lúc {formatCompletedAt(action.completedAt)}</small>}</section><section><div className="action-detail-rail__section-heading"><span className="section-label">Provenance</span>{linked && <button className="text-button" type="button" onClick={() => void unlink()}>Bỏ gắn</button>}</div>{linked ? <div className="action-detail-rail__checkin"><span>{linked.primaryEmotion?.emoji ?? linked.unknownPrompt?.emoji ?? '◌'}</span><div><strong>{linked.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'}</strong><small>{formatCheckinDate(linked.occurredAt)}</small></div><Link to="/checkin/history">Xem Check-in →</Link></div> : <p className="muted-text">Action độc lập · có thể gắn với Check-in sau.</p>}</section>{linkError && <p className="action-modal__error" role="alert">{linkError}</p>}<section><span className="section-label">Reflection</span>{reflections.length ? <div className="reflection-history">{reflections.map((item) => <div key={item.id}><strong>{reflectionOutcomes.find((outcome) => outcome.id === item.outcomeId)?.labelVn ?? item.outcomeSnapshot ?? item.outcomeId}</strong>{item.note && <p>{item.note}</p>}<small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></div>)}</div> : <p className="muted-text">Chưa có reflection cho lần hoàn thành này.</p>}</section></div>
    <footer className="action-detail-rail__footer"><button className="button button--secondary button--small" type="button" onClick={onEdit}>Chỉnh sửa</button><button className="button button--secondary button--small" type="button" onClick={onReschedule}>Đổi lịch</button><button className={isActionCompleted(action) ? 'button button--secondary button--small' : 'button button--primary button--small'} type="button" disabled={busy} onClick={onDone}>{isActionCompleted(action) ? 'Đánh dấu chưa xong' : 'Đánh dấu xong'}</button><button className="button button--danger button--small" type="button" disabled={busy} onClick={onDelete}>Xoá</button></footer>
  </aside>
}

type ActionHistoryRecord = {
  action: ActionRecord
  checkin: CheckinRecord | null
  reflection: ActionReflection | null
  dateKey: string
  occurredAt: string
}

const getLatestReflection = (actionId: string, reflections: readonly ActionReflection[]): ActionReflection | null => reflections
  .filter((reflection) => reflection.actionId === actionId)
  .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null

const getActionHistoryRecords = (snapshot: ActionSpaceSnapshot, filters: ActionHistoryFilters): ActionHistoryRecord[] => snapshot.actions
  .map((action) => {
    const reflection = getLatestReflection(action.id, snapshot.reflections)
    const occurredAt = action.completedAt ?? reflection?.createdAt
    if (!occurredAt) return null
    return { action, checkin: getLinkedCheckin(action, snapshot.checkins), reflection, dateKey: historyDateKey(occurredAt), occurredAt }
  })
  .filter((item): item is ActionHistoryRecord => item !== null)
  .filter((item) => {
    if (filters.start && item.dateKey < filters.start) return false
    if (filters.end && item.dateKey > filters.end) return false
    if (filters.source === 'checkin' && !item.checkin) return false
    if (filters.source === 'independent' && item.checkin) return false
    if (filters.emotionId !== 'all' && item.checkin?.primaryEmotionId !== filters.emotionId) return false
    if (filters.outcomeId !== 'all' && item.reflection?.outcomeId !== filters.outcomeId) return false
    return true
  })
  .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))

function ActionHistorySurface({ snapshot, outcomes, lens, onLensChange }: { snapshot: ActionSpaceSnapshot; outcomes: ActionReflectionOutcome[]; lens: ActionHistoryLens; onLensChange: (lens: ActionHistoryLens) => void }) {
  const [filters, setFilters] = useState<ActionHistoryFilters>(emptyHistoryFilters)
  const today = historyDateKey(new Date().toISOString())
  const [calendarDate, setCalendarDate] = useState(today)
  const [calendarMonth, setCalendarMonth] = useState(`${today.slice(0, 7)}-01`)
  const records = useMemo(() => getActionHistoryRecords(snapshot, filters), [filters, snapshot])
  const reflectionRecords = useMemo(() => records.filter((item) => item.reflection), [records])
  const sourceEmotions = useMemo(() => {
    const byId = new Map<string, NonNullable<CheckinRecord['primaryEmotion']>>()
    snapshot.checkins.forEach((checkin) => {
      if (checkin.primaryEmotion && !byId.has(checkin.primaryEmotion.emotion_id)) byId.set(checkin.primaryEmotion.emotion_id, checkin.primaryEmotion)
    })
    return [...byId.values()].sort((left, right) => left.sort_order - right.sort_order)
  }, [snapshot.checkins])

  const patchFilters = (patch: Partial<ActionHistoryFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const calendarRecords = records.filter((item) => item.dateKey === calendarDate)
  const activeDays = new Set(records.map((item) => item.dateKey))
  const groupedTimeline = useMemo(() => {
    const groups = new Map<string, ActionHistoryRecord[]>()
    records.forEach((record) => groups.set(record.dateKey, [...(groups.get(record.dateKey) ?? []), record]))
    return [...groups.entries()]
  }, [records])

  return <section className="action-history" aria-label="Lịch sử Action">
    <nav className="action-history__lenses" aria-label="Các góc nhìn lịch sử" role="tablist">{historyLenses.map((item) => <button key={item.value} className={lens === item.value ? 'is-active' : undefined} type="button" role="tab" aria-selected={lens === item.value} onClick={() => onLensChange(item.value)}>{item.label}</button>)}</nav>
    {lens === 'reflection' && <div className="action-history__outcomes" role="tablist" aria-label="Lọc theo Reflection"><button className={filters.outcomeId === 'all' ? 'is-active' : undefined} type="button" role="tab" aria-selected={filters.outcomeId === 'all'} onClick={() => patchFilters({ outcomeId: 'all' })}>Tất cả Reflection</button>{outcomes.map((outcome) => <button key={outcome.id} className={filters.outcomeId === outcome.id ? 'is-active' : undefined} type="button" role="tab" aria-selected={filters.outcomeId === outcome.id} onClick={() => patchFilters({ outcomeId: outcome.id })}>{outcome.labelVn}</button>)}</div>}
    <ActionHistoryFiltersBar filters={filters} sourceEmotions={sourceEmotions} outcomes={outcomes} includeOutcome={lens !== 'reflection'} onPatch={patchFilters} onReset={() => setFilters(emptyHistoryFilters())} />
    {lens === 'timeline' && <div className="action-history__timeline">{groupedTimeline.length ? groupedTimeline.map(([dateKey, items]) => <section className="action-history__day" key={dateKey}><div className="action-history__day-heading"><span className="section-label">{formatHistoryDay(dateKey)}</span><span>{items.length} action</span></div><div className="action-history__records">{items.map((item) => <ActionHistoryRecordCard key={item.action.id} item={item} outcomes={outcomes} showReflectionNote />)}</div></section>) : <ActionHistoryEmpty />}</div>}
    {lens === 'calendar' && <div className="action-history__calendar-layout"><section className="action-history__calendar" aria-label="Lịch các Action đã hoàn thành"><div className="action-history__calendar-heading"><button className="text-button" type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} aria-label="Tháng trước">←</button><strong>{formatHistoryMonth(calendarMonth)}</strong><button className="text-button" type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} aria-label="Tháng sau">→</button></div><div className="action-history__weekdays">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}</div><div className="action-history__calendar-grid">{getCalendarCells(calendarMonth).map((day, index) => day ? <button key={day} className={`${calendarDate === day ? 'is-selected ' : ''}${activeDays.has(day) ? 'has-actions' : ''}`} type="button" aria-label={`Chọn ${formatHistoryDay(day)}`} aria-current={calendarDate === day ? 'date' : undefined} onClick={() => { setCalendarDate(day); setCalendarMonth(`${day.slice(0, 7)}-01`) }}><span>{Number(day.slice(-2))}</span>{activeDays.has(day) && <i aria-hidden="true" />}</button> : <span className="is-empty" key={`empty-${index}`} />)}</div><p className="action-history__calendar-note">{activeDays.size} ngày có Action đã hoàn thành trong khoảng lọc.</p></section><section className="action-history__selected-day"><div className="action-history__day-heading"><div><span className="section-label">Theo ngày</span><h2>{formatHistoryDay(calendarDate)}</h2></div><span>{calendarRecords.length} action</span></div>{calendarRecords.length ? <div className="action-history__records">{calendarRecords.map((item) => <ActionHistoryRecordCard key={item.action.id} item={item} outcomes={outcomes} showReflectionNote />)}</div> : <ActionHistoryEmpty copy="Ngày này chưa có Action hoàn thành." />}</section></div>}
    {lens === 'reflection' && <div className="action-history__reflection-list">{reflectionRecords.length ? reflectionRecords.map((item) => <ActionHistoryRecordCard key={item.action.id} item={item} outcomes={outcomes} showReflectionNote />) : <ActionHistoryEmpty copy={filters.outcomeId === 'all' ? 'Chưa có Action nào có Reflection để đọc lại.' : 'Chưa có Reflection nào phù hợp với bộ lọc này.'} />}</div>}
  </section>
}

function ActionHistoryFiltersBar({ filters, sourceEmotions, outcomes, includeOutcome, onPatch, onReset }: { filters: ActionHistoryFilters; sourceEmotions: NonNullable<CheckinRecord['primaryEmotion']>[]; outcomes: ActionReflectionOutcome[]; includeOutcome: boolean; onPatch: (patch: Partial<ActionHistoryFilters>) => void; onReset: () => void }) {
  return <section className="action-history__filters" aria-label="Bộ lọc lịch sử"><div className="action-history__date-fields"><label><span>Từ ngày</span><input type="date" value={filters.start} onChange={(event) => onPatch({ start: event.target.value })} /></label><span aria-hidden="true">→</span><label><span>Đến ngày</span><input type="date" value={filters.end} onChange={(event) => onPatch({ end: event.target.value })} /></label></div><label><span>Nguồn</span><select value={filters.source} onChange={(event) => onPatch({ source: event.target.value as ActionHistorySource })}><option value="all">Mọi nguồn</option><option value="checkin">Từ Check-in</option><option value="independent">Độc lập</option></select></label><label><span>Cảm xúc từ Check-in</span><select value={filters.emotionId} onChange={(event) => onPatch({ emotionId: event.target.value })}><option value="all">Mọi cảm xúc</option>{sourceEmotions.map((emotion) => <option key={emotion.emotion_id} value={emotion.emotion_id}>{emotion.emoji} {emotion.emotion_name_vn}</option>)}</select></label>{includeOutcome && <label><span>Reflection</span><select value={filters.outcomeId} onChange={(event) => onPatch({ outcomeId: event.target.value })}><option value="all">Mọi kết quả</option>{outcomes.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.labelVn}</option>)}</select></label>}<button className="text-button" type="button" onClick={onReset}>↻ Đặt lại</button></section>
}

function ActionHistoryRecordCard({ item, outcomes, showReflectionNote = false }: { item: ActionHistoryRecord; outcomes: ActionReflectionOutcome[]; showReflectionNote?: boolean }) {
  const color = item.checkin?.primaryEmotion?.color_hex ?? ACTION_INDEPENDENT_COLOR
  const sourceLabel = item.checkin ? `Từ Check-in · ${item.checkin.primaryEmotion?.emotion_name_vn ?? item.checkin.unknownPrompt?.prompt_text_vn ?? 'Mình còn đang mơ hồ'}` : 'Độc lập'
  const emoji = item.checkin?.primaryEmotion?.emoji ?? item.checkin?.unknownPrompt?.emoji ?? '✨'
  const reflectionLabel = item.reflection ? outcomes.find((outcome) => outcome.id === item.reflection?.outcomeId)?.labelVn ?? item.reflection.outcomeSnapshot : null
  return <article className="action-history-record" style={{ '--action-color': color } as CSSProperties}><div className="action-history-record__time"><time dateTime={item.occurredAt}>{formatHistoryTime(item.occurredAt)}</time><span>đã hoàn thành</span></div><div className="action-history-record__icon" aria-hidden="true">{emoji}</div><div className="action-history-record__body"><strong>{item.action.title}</strong>{item.action.note && <p>{item.action.note}</p>}<div className="action-history-record__meta"><span className="action-history-record__source">{sourceLabel}</span>{item.checkin && <span>{formatCheckinDate(item.checkin.occurredAt)}</span>}</div>{reflectionLabel && <div className="action-history-record__reflection"><span>Reflection</span><strong>{reflectionLabel}</strong>{showReflectionNote && item.reflection?.note && <p>{item.reflection.note}</p>}</div>}</div></article>
}

function ActionHistoryEmpty({ copy = 'Chưa có Action hoàn thành trong khoảng này.' }: { copy?: string }) {
  return <div className="action-history__empty"><span aria-hidden="true">◌</span><strong>{copy}</strong><Link to="/action-space">Về Action Space để viết một bước mới.</Link></div>
}

function ActionComposerModal({ action, snapshot, onClose, onAutosaved, onSubmit }: { action: ActionRecord | null; snapshot: ActionSpaceSnapshot; onClose: () => void; onAutosaved?: (action: ActionRecord) => void; onSubmit: (draft: ActionDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<ActionDraft>(() => action ? draftFromAction(action) : readActionDraft())
  const [checkinQuery, setCheckinQuery] = useState('')
  const [showMoreCheckins, setShowMoreCheckins] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autosaveSignatureRef = useRef(JSON.stringify(action ? draftFromAction(action) : null))
  const { flush: flushAutosave, schedule: scheduleAutosave, status: autosaveStatus } = useAutosave(async (nextDraft: ActionDraft) => {
    if (!action?.id || !nextDraft.title.trim()) return
    const saved = await updateAction(action.id, nextDraft)
    autosaveSignatureRef.current = JSON.stringify(nextDraft)
    onAutosaved?.(saved)
  }, { delay: 700 })

  useEffect(() => {
    if (action) return
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(ACTION_DRAFT_STORAGE_KEY, JSON.stringify(draft)) } catch { /* Device autosave is best effort. */ }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [action, draft])

  useEffect(() => {
    if (!action?.id || !draft.title.trim()) return
    const signature = JSON.stringify(draft)
    if (signature === autosaveSignatureRef.current) return
    scheduleAutosave(draft)
  }, [action, draft, scheduleAutosave])

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
    try {
      await flushAutosave().catch(() => undefined)
      await onSubmit(draft)
      if (!action) window.localStorage.removeItem(ACTION_DRAFT_STORAGE_KEY)
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể lưu Action.') } finally { setIsSaving(false) }
  }
  return <div className="action-modal-backdrop" role="presentation" onClick={onClose}><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-modal-title" onClick={(event) => event.stopPropagation()}><button className="action-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><header><p className="eyebrow">{action ? 'Chỉnh sửa action' : 'Capture'}</p><h2 id="action-modal-title">{action ? 'Giữ action đúng với bạn' : 'Bạn muốn làm gì?'}</h2><p>Một bước nhỏ cũng đủ. Lên lịch khi bạn muốn, hoặc để dành trong Chưa lên lịch.</p></header><div className="action-modal__fields"><label><span>Tên action <em>*</em></span><input autoFocus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: Đi bộ 10 phút" /></label><label><span>Ghi chú <small>tuỳ chọn</small></span><textarea rows={3} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Điều gì sẽ giúp bước này vừa đủ?" /></label><section className="action-modal__section" aria-labelledby="schedule-label"><h3 id="schedule-label">Lên lịch</h3><div className="schedule-choices">{([['none', 'Chưa lên lịch'], ['date', 'Một ngày'], ['date_range', 'Khoảng ngày']] as const).map(([value, label]) => <button key={value} className={draft.scheduleType === value ? 'is-selected' : ''} type="button" onClick={() => setDraft((current) => ({ ...current, scheduleType: value }))}>{label}</button>)}</div>{draft.scheduleType !== 'none' && <div className="schedule-inputs"><label><span>{draft.scheduleType === 'date_range' ? 'Từ ngày' : 'Ngày'}</span><input type="date" value={draft.plannedDate} onChange={(event) => setDraft((current) => ({ ...current, plannedDate: event.target.value }))} /></label>{draft.scheduleType === 'date_range' && <label><span>Đến ngày</span><input type="date" value={draft.plannedEndDate} onChange={(event) => setDraft((current) => ({ ...current, plannedEndDate: event.target.value }))} /></label>}<label><span>Giờ <small>tuỳ chọn</small></span><input type="time" value={draft.dueTime} onChange={(event) => setDraft((current) => ({ ...current, dueTime: event.target.value }))} /></label></div>}</section><section className="action-modal__section" aria-labelledby="checkin-label"><h3 id="checkin-label">Gắn với Check-in <small>tuỳ chọn</small></h3>{selectedCheckin ? <div className="selected-checkin" style={{ '--checkin-color': selectedCheckin.primaryEmotion?.color_hex ?? '#b8a5df' } as CSSProperties}><span>{selectedCheckin.primaryEmotion?.emoji ?? selectedCheckin.unknownPrompt?.emoji ?? '◌'}</span><div><strong>{selectedCheckin.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'}</strong><small>{formatCheckinDate(selectedCheckin.occurredAt)} · {selectedCheckin.note || selectedCheckin.unknownPrompt?.prompt_text_vn || 'Không có ghi chú'}</small></div><button type="button" onClick={() => setDraft((current) => ({ ...current, sourceCheckinId: null }))}>Bỏ gắn</button></div> : <><div className="checkin-picker-toolbar"><input value={checkinQuery} onChange={(event) => { setCheckinQuery(event.target.value); setShowMoreCheckins(Boolean(event.target.value)) }} placeholder="Tìm Check-in gần đây…" aria-label="Tìm Check-in" /></div><div className="checkin-picker-list">{checkins.map((checkin) => { const count = activeCountFor(checkin.id); const disabled = count >= 2; const name = checkin.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'; return <button key={checkin.id} className="checkin-picker-item" style={{ '--checkin-color': checkin.primaryEmotion?.color_hex ?? '#b8a5df' } as CSSProperties} disabled={disabled} type="button" onClick={() => setDraft((current) => ({ ...current, sourceCheckinId: checkin.id }))}><span>{checkin.primaryEmotion?.emoji ?? checkin.unknownPrompt?.emoji ?? '◌'}</span><span><strong>{name}</strong><small>{formatCheckinDate(checkin.occurredAt)} · {disabled ? 'Đã đủ 2 action đang hoạt động' : (checkin.note || checkin.unknownPrompt?.prompt_text_vn || 'Check-in không có ghi chú')}</small></span><i>{disabled ? 'Đủ' : 'Gắn'}</i></button> })}{!checkins.length && <small className="muted-text">Không tìm thấy Check-in phù hợp.</small>}{!checkinQuery && !showMoreCheckins && snapshot.checkins.length > 3 && <button className="text-button checkin-picker-more" type="button" onClick={() => setShowMoreCheckins(true)}>Xem thêm</button>}</div></>}</section></div>{error && <p className="action-modal__error" role="alert">{error}</p>}<footer><small className="action-modal__autosave" role="status">{autosaveStatus === 'saving' ? 'Đang tự động lưu…' : autosaveStatus === 'saved' ? 'Đã tự động lưu' : autosaveStatus === 'error' ? 'Chưa lưu được — sẽ thử lại khi bạn tiếp tục' : !action ? 'Bản nháp lưu trên thiết bị' : ''}</small><button className="button button--secondary" type="button" onClick={onClose}>Hủy</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void submit()}>{isSaving ? 'Đang lưu…' : action ? 'Lưu thay đổi' : 'Thêm action'}</button></footer></section></div>
}
