import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, IntensityDots, TagList } from '../components/CheckinComponents'
import { HomeOrb } from '../../home/components/HomeOrb'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { deleteCheckin, deleteLinkedActions, detachLinkedActions, draftFromRecord, listCheckins, updateCheckin } from '../services/checkinRepository'
import type { CheckinRecord } from '../types'
import { filterByDateRange, getHistoryDateRange, getHistoryMetrics, getLocalDateKey, sortByCreatedAtDesc, type HistoryPreset } from '../utils/history'
import { getHomeOrbEntries } from '../../home/services/homeAggregation'
import { DEFAULT_REFLECTION_OUTCOMES, listReflectionOutcomes, saveActionReflection, setActionStatus } from '../../actionspace/actionService'
import { ReflectionModal } from '../../actionspace/ActionSpacePage'
import type { ActionRecord, ActionReflectionOutcome } from '../../actionspace/types'
import { isRichTextEmpty, richTextToPlainText, RichTextRenderer } from '../../../components/richText'

export function HistoryScreen() {
  const navigate = useNavigate()
  const { loadExistingDraft } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [selected, setSelected] = useState<CheckinRecord | null>(null)
  const [preset, setPreset] = useState<HistoryPreset>('all')
  const [family, setFamily] = useState('all')
  const [emotion, setEmotion] = useState('all')
  const [need, setNeed] = useState('all')
  const [context, setContext] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [actionRecord, setActionRecord] = useState<CheckinRecord | null>(null)
  const [reflectionAction, setReflectionAction] = useState<{ action: ActionRecord; historyAvailable: boolean } | null>(null)
  const [reflectionOutcomes, setReflectionOutcomes] = useState<ActionReflectionOutcome[]>(DEFAULT_REFLECTION_OUTCOMES)

  useEffect(() => {
    let active = true
    if (reference) void listCheckins(reference).then((nextRecords) => { if (active) { setRecords(nextRecords); setSelected((current) => current ?? nextRecords[0] ?? null) } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử.') })
    return () => { active = false }
  }, [reference])
  useEffect(() => { void listReflectionOutcomes().then((outcomes) => { if (outcomes.length) setReflectionOutcomes(outcomes) }).catch(() => undefined) }, [])
  const filtered = useMemo(() => {
    if (!reference) return []
    const ranged = filterByDateRange(records, getHistoryDateRange(preset, new Date(), { start: customStart || null, end: customEnd || null }))
    return sortByCreatedAtDesc(ranged.filter((record) => {
      const familyMatch = family === 'all' || record.primaryEmotion?.emotion_family_id === family
      const emotionMatch = emotion === 'all' || record.primaryEmotionId === emotion || record.secondaryEmotions.some((item) => item.emotion_id === emotion)
      const needMatch = need === 'all' || record.needs.some((item) => item.need_id === need)
      const contextMatch = context === 'all' || record.contexts.some((item) => item.context_id === context)
      return familyMatch && emotionMatch && needMatch && contextMatch
    }))
  }, [context, customEnd, customStart, emotion, family, need, preset, records, reference])
  const metrics = useMemo(() => getHistoryMetrics(filtered), [filtered])
  const overviewOrbEntries = useMemo(() => getHomeOrbEntries(filtered), [filtered])

  const remove = async (record: CheckinRecord) => {
    if (!window.confirm('Xoá check-in này?')) return
    try {
      if (record.actions.length > 0) {
        const deleteActions = window.confirm('Check-in này có Action liên kết. Chọn OK để xoá cả Action, hoặc Huỷ để giữ Action độc lập.')
        if (deleteActions) await deleteLinkedActions(record.id)
        else if (window.confirm('Giữ các Action độc lập và xoá Check-in?')) await detachLinkedActions(record.id)
        else return
      }
      await deleteCheckin(record.id)
      setRecords((current) => current.filter((item) => item.id !== record.id))
      setSelected(null)
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể xoá check-in.') }
  }
  const edit = async (record: CheckinRecord) => { await loadExistingDraft(record.id); navigate(record.checkinType === 'unknown' ? '/checkin/unknown' : '/checkin/emotion') }
  const toggleAction = async (record: CheckinRecord, actionId: string, completed: boolean) => {
    try {
      const result = await setActionStatus(actionId, completed ? 'completed' : 'pending')
      const completedAt = completed ? new Date().toISOString() : null
      const patchRecord = (item: CheckinRecord): CheckinRecord => item.id === record.id ? { ...item, actions: item.actions.map((action) => action.id === actionId ? { ...action, status: completed ? 'completed' : 'pending', completedAt } : action) } : item
      setRecords((current) => current.map(patchRecord))
      setSelected((current) => current ? patchRecord(current) : current)
      if (completed) {
        const sourceAction = record.actions.find((action) => action.id === actionId)
        if (sourceAction) setReflectionAction({ action: { id: actionId, userId: record.userId, title: sourceAction.title, note: sourceAction.note, plannedDate: sourceAction.plannedDate || null, plannedEndDate: null, dueTime: sourceAction.dueTime || null, status: 'completed', completedAt, createdAt: record.createdAt, updatedAt: record.updatedAt, origin: 'checkin', sourceCheckinId: record.id, careActionId: sourceAction.careActionId }, historyAvailable: result.historyAvailable })
      }
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật Action.') }
  }
  const addAction = async (actions: CheckinRecord['actions']) => {
    if (!actionRecord || !reference) return
    try {
      const nextDraft = { ...draftFromRecord(actionRecord), id: actionRecord.id, actions }
      await updateCheckin(nextDraft)
      const refreshed = await listCheckins(reference)
      const nextRecord = refreshed.find((item) => item.id === actionRecord.id) ?? { ...actionRecord, actions }
      setRecords(refreshed)
      setSelected(nextRecord)
      setActionRecord(null)
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể thêm Action.') }
  }
  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  return (
    <div className="page-stack checkin-page history-page">
      <CheckinWorkspaceHeader active="history" showTabs eyebrow="Sắc Ký · Check-in" title="Check-in" copy="Nhìn lại những mảnh màu và những điều đã hiện diện." />
      <section className="history-toolbar"><div className="history-toolbar__top"><div className="preset-row">{(['all', 'today', 'week', 'month', 'custom'] as HistoryPreset[]).map((item) => <button key={item} className={`filter-chip ${preset === item ? 'is-active' : ''}`} type="button" onClick={() => setPreset(item)}>{({ all: 'Tất cả', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', custom: 'Tuỳ chọn' })[item]}</button>)}</div><button className="text-button" type="button" onClick={() => { setPreset('all'); setFamily('all'); setEmotion('all'); setNeed('all'); setContext('all'); setCustomStart(''); setCustomEnd('') }}>↻ Đặt lại bộ lọc</button></div>{preset === 'custom' && <div className="date-range"><input aria-label="Từ ngày" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><span>→</span><input aria-label="Đến ngày" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>}<div className="history-filters"><select aria-label="Lọc theo nhóm cảm xúc" value={family} onChange={(event) => setFamily(event.target.value)}><option value="all">Mọi nhóm cảm xúc</option>{reference.emotionFamilies.map((item) => <option key={item.emotion_family_id} value={item.emotion_family_id}>{item.family_name_vn}</option>)}</select><select aria-label="Lọc theo cảm xúc" value={emotion} onChange={(event) => setEmotion(event.target.value)}><option value="all">Mọi cảm xúc</option>{reference.emotions.map((item) => <option key={item.emotion_id} value={item.emotion_id}>{item.emotion_name_vn}</option>)}</select><select aria-label="Lọc theo nhu cầu" value={need} onChange={(event) => setNeed(event.target.value)}><option value="all">Mọi nhu cầu</option>{reference.needs.map((item) => <option key={item.need_id} value={item.need_id}>{item.need_name_vn}</option>)}</select><select aria-label="Lọc theo bối cảnh" value={context} onChange={(event) => setContext(event.target.value)}><option value="all">Mọi bối cảnh</option>{reference.contexts.map((item) => <option key={item.context_id} value={item.context_id}>{item.context_name_vn}</option>)}</select></div></section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="history-dashboard"><main className="history-main"><section className="history-metrics" aria-label="Tóm tắt lịch sử"><Metric label="Check-in trong khoảng này" value={metrics.total} /><Metric label="Streak hiện tại" value={`${metrics.currentStreak} ngày`} /><Metric label="Streak dài nhất" value={`${metrics.longestStreak} ngày`} /><Metric label="Cường độ trung bình" value={metrics.averageIntensity ? `${metrics.averageIntensity.toFixed(1)} / 5` : '—'} /></section><section className="history-overview"><div><span className="eyebrow">{filtered.length} check-in</span><h3>Color Orb của khoảng thời gian này</h3><p>Những màu sắc xuất hiện nhiều hơn không nói lên bạn là ai — chỉ cho biết điều gì đã ghé qua.</p></div><HomeOrb entries={overviewOrbEntries} size="medium" label="Color Orb lịch sử" density={preset === 'today' ? 'full' : 'simplified'} /></section><div className="history-list-header"><strong>{filtered.length} check-in</strong><span>Sắp xếp: Mới nhất</span></div><div className="history-list">{filtered.slice(0, visibleCount).map((record) => { const title = record.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'; const tags = [...record.secondaryEmotions.map((item) => item.emotion_name_vn), ...record.needs.map((item) => item.need_name_vn), ...record.contexts.map((item) => item.context_name_vn)]; return <button className={`history-item ${selected?.id === record.id ? 'is-selected' : ''}`} type="button" key={record.id} onClick={() => setSelected(record)}><span className="history-item__orb" style={{ background: record.primaryEmotion?.color_hex ?? '#b8a5df' }} /><span className="history-item__body"><small>{new Date(record.createdAt).toLocaleString('vi-VN')} · {getLocalDateKey(record.createdAt)}</small><strong>{record.primaryEmotion?.emoji ?? record.unknownPrompt?.emoji} {title}</strong>{tags.length > 0 && <span className="history-item__tags">{tags.join(' · ')}</span>}<span>{richTextToPlainText(record.note).trim() || record.unknownPrompt?.prompt_text_vn || 'Không có ghi chú'}</span></span><span className="history-item__meta">{record.intensity && <IntensityDots value={record.intensity} />}<b>›</b></span></button> })}{!filtered.length && <div className="empty-state empty-state--large"><strong>Chưa có check-in trong khoảng này.</strong><span>Khoảng dừng đầu tiên đang chờ bạn.</span><button className="button button--primary" type="button" onClick={() => navigate('/checkin')}>Tạo check-in</button></div>}{filtered.length > visibleCount && <button className="button button--secondary history-more" type="button" onClick={() => setVisibleCount((current) => current + 30)}>Xem thêm</button>}</div></main>{selected && <HistoryDrawer record={selected} onClose={() => setSelected(null)} onEdit={() => void edit(selected)} onDelete={() => void remove(selected)} onAddAction={() => setActionRecord(selected)} onToggleAction={(actionId, completed) => void toggleAction(selected, actionId, completed)} reference={reference} />}</div>
      {actionRecord && <ActionModal reference={reference} context={{ emotion: actionRecord.primaryEmotion, checkinType: actionRecord.checkinType, unknownEmoji: actionRecord.unknownPrompt?.emoji }} initialActions={actionRecord.actions} onClose={() => setActionRecord(null)} onSaved={(actions) => void addAction(actions)} />}
      {reflectionAction && <ReflectionModal action={reflectionAction.action} checkin={records.find((record) => record.id === reflectionAction.action.sourceCheckinId) ?? null} outcomes={reflectionOutcomes} historyAvailable={reflectionAction.historyAvailable} onClose={() => setReflectionAction(null)} onSave={async (outcome, note) => { await saveActionReflection(reflectionAction.action.id, outcome, note); setReflectionAction(null) }} />}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="history-metric"><span>{label}</span><strong>{value}</strong></div>
}

function HistoryDrawer({ record, reference, onClose, onEdit, onDelete, onAddAction, onToggleAction }: { record: CheckinRecord; reference: NonNullable<ReturnType<typeof useReferenceData>['reference']>; onClose: () => void; onEdit: () => void; onDelete: () => void; onAddAction: () => void; onToggleAction: (actionId: string, completed: boolean) => void }) {
  const detailOrbEntries = useMemo(() => getHomeOrbEntries([record]), [record])

  return <aside className="history-detail-rail" role="complementary"><div className="history-detail-rail__header"><strong>Chi tiết check-in</strong><button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button></div><div className="history-detail-rail__hero"><HomeOrb entries={detailOrbEntries} size="small" label="Color Orb chi tiết" /><div><h2>{record.primaryEmotion?.emoji ?? record.unknownPrompt?.emoji} {record.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'}</h2><p>{record.primaryEmotion?.emotion_name_en ?? 'Unknown Check-in'}</p></div></div>{record.intensity && <div className="drawer-intensity"><span>Cường độ</span><IntensityDots value={record.intensity} /></div>}<div className="drawer-sections">{record.secondaryEmotions.length > 0 && <div><span className="section-label">Cảm xúc khác</span><TagList items={record.secondaryEmotions.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /></div>}{record.needs.length > 0 && <div><span className="section-label">Nhu cầu</span><TagList items={record.needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /></div>}{record.contexts.length > 0 && <div><span className="section-label">Ngữ cảnh</span><TagList items={record.contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /></div>}<div><span className="section-label">Ghi chú</span>{isRichTextEmpty(record.note) ? <p>{record.unknownPrompt?.prompt_text_vn || 'Không có ghi chú.'}</p> : <RichTextRenderer value={record.note} />}</div><div><div className="drawer-section-header"><span className="section-label">Action liên kết ({record.actions.length}/2)</span><button className="text-button" type="button" disabled={record.actions.length >= 2} onClick={onAddAction}>+ Thêm Action</button></div>{record.actions.length ? <div className="drawer-action-list">{record.actions.map((action) => action.id ? <div className="drawer-action" key={action.id}><button className={`drawer-action__status ${action.status === 'completed' ? 'is-completed' : ''}`} type="button" aria-label={action.status === 'completed' ? `Hoàn tác ${action.title}` : `Đánh dấu hoàn thành ${action.title}`} onClick={() => onToggleAction(action.id!, action.status !== 'completed')}>{action.status === 'completed' ? '✓' : ''}</button><span><strong>{action.title}</strong><small>{action.plannedDate || 'Chưa lên lịch'}{action.dueTime ? ` · ${action.dueTime}` : ''}</small></span></div> : <div className="drawer-action" key={action.title}><span className="drawer-action__status" /><span><strong>{action.title}</strong><small>Action liên kết</small></span></div>)}</div> : <p className="muted-text">Chưa có Action liên kết.</p>}</div></div><div className="drawer-actions"><button className="button button--secondary" type="button" onClick={onEdit}>Chỉnh sửa</button><button className="button button--danger" type="button" onClick={onDelete}>Xoá</button></div><small className="drawer-footnote">{reference.emotions.length} cảm xúc tham chiếu đang hoạt động.</small></aside>
}
