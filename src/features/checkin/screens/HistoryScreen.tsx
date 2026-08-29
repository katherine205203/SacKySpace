import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckinWorkspaceHeader, ColorOrb, IntensityDots, TagList } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { deleteCheckin, listCheckins } from '../services/checkinRepository'
import type { CheckinRecord } from '../types'
import { filterByDateRange, getHistoryDateRange, getLocalDateKey, sortByCreatedAtDesc, type HistoryPreset } from '../utils/history'

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

  useEffect(() => { if (reference) void listCheckins(reference).then(setRecords).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử.')) }, [reference])
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

  const remove = async (record: CheckinRecord) => { if (!window.confirm('Xoá check-in này?')) return; try { await deleteCheckin(record.id); setRecords((current) => current.filter((item) => item.id !== record.id)); setSelected(null) } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể xoá check-in.') } }
  const edit = async (record: CheckinRecord) => { await loadExistingDraft(record.id); navigate(record.checkinType === 'unknown' ? '/checkin/unknown' : '/checkin/emotion') }
  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  return (
    <div className="page-stack checkin-page history-page">
      <CheckinWorkspaceHeader active="history" eyebrow="Check-in · Lịch sử" title="Nhìn lại những mảnh màu của bạn" copy="Mỗi lần bạn dừng lại đều đáng được ghi nhận." />
      <section className="history-toolbar"><div className="history-toolbar__top"><div className="preset-row">{(['all', 'today', 'week', 'month', 'custom'] as HistoryPreset[]).map((item) => <button key={item} className={`filter-chip ${preset === item ? 'is-active' : ''}`} type="button" onClick={() => setPreset(item)}>{({ all: 'Tất cả', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', custom: 'Tuỳ chọn' })[item]}</button>)}</div><button className="text-button" type="button" onClick={() => { setPreset('all'); setFamily('all'); setEmotion('all'); setNeed('all'); setContext('all'); setCustomStart(''); setCustomEnd('') }}>Đặt lại bộ lọc</button></div>{preset === 'custom' && <div className="date-range"><input aria-label="Từ ngày" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><span>→</span><input aria-label="Đến ngày" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>}<div className="history-filters"><select aria-label="Lọc theo nhóm cảm xúc" value={family} onChange={(event) => setFamily(event.target.value)}><option value="all">Mọi nhóm cảm xúc</option>{reference.emotionFamilies.map((item) => <option key={item.emotion_family_id} value={item.emotion_family_id}>{item.family_name_vn}</option>)}</select><select aria-label="Lọc theo cảm xúc" value={emotion} onChange={(event) => setEmotion(event.target.value)}><option value="all">Mọi cảm xúc</option>{reference.emotions.map((item) => <option key={item.emotion_id} value={item.emotion_id}>{item.emotion_name_vn}</option>)}</select><select aria-label="Lọc theo nhu cầu" value={need} onChange={(event) => setNeed(event.target.value)}><option value="all">Mọi nhu cầu</option>{reference.needs.map((item) => <option key={item.need_id} value={item.need_id}>{item.need_name_vn}</option>)}</select><select aria-label="Lọc theo bối cảnh" value={context} onChange={(event) => setContext(event.target.value)}><option value="all">Mọi bối cảnh</option>{reference.contexts.map((item) => <option key={item.context_id} value={item.context_id}>{item.context_name_vn}</option>)}</select></div></section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="history-overview"><div><span className="eyebrow">{filtered.length} check-in</span><h3>Color Orb của khoảng thời gian này</h3><p>Những màu sắc xuất hiện nhiều hơn không nói lên bạn là ai — chỉ cho biết điều gì đã ghé qua.</p></div><ColorOrb entries={filtered.flatMap((record) => record.primaryEmotion ? [{ color: record.primaryEmotion.color_hex, intensity: record.intensity ?? 1 }, ...record.secondaryEmotions.map((emotion) => ({ color: emotion.color_hex, intensity: 1 }))] : [])} size="large" label="Color Orb lịch sử" /></section>
      <div className="history-list">{filtered.slice(0, visibleCount).map((record) => { const title = record.primaryEmotion?.emotion_name_vn ?? 'Unknown Check-in'; const tags = [...record.secondaryEmotions.map((item) => item.emotion_name_vn), ...record.needs.map((item) => item.need_name_vn), ...record.contexts.map((item) => item.context_name_vn)]; return <button className="history-item" type="button" key={record.id} onClick={() => setSelected(record)}><span className="history-item__orb" style={{ background: record.primaryEmotion?.color_hex ?? '#d9d9e7' }} /><span className="history-item__body"><small>{new Date(record.createdAt).toLocaleString('vi-VN')} · {getLocalDateKey(record.createdAt)}</small><strong>{record.primaryEmotion?.emoji} {title}</strong>{tags.length > 0 && <span className="history-item__tags">{tags.join(' · ')}</span>}<span>{record.note || record.unknownPrompt?.prompt_text_vn || 'Không có ghi chú'}</span></span><span className="history-item__meta">{record.intensity && <IntensityDots value={record.intensity} />}<b>›</b></span></button> })}{!filtered.length && <div className="empty-state empty-state--large"><strong>Chưa có check-in trong khoảng này.</strong><span>Khoảng dừng đầu tiên đang chờ bạn.</span><button className="button button--primary" type="button" onClick={() => navigate('/checkin')}>Tạo check-in</button></div>}{filtered.length > visibleCount && <button className="button button--secondary history-more" type="button" onClick={() => setVisibleCount((current) => current + 30)}>Xem thêm</button>}</div>
      {selected && <HistoryDrawer record={selected} onClose={() => setSelected(null)} onEdit={() => void edit(selected)} onDelete={() => void remove(selected)} reference={reference} />}
    </div>
  )
}

function HistoryDrawer({ record, reference, onClose, onEdit, onDelete }: { record: CheckinRecord; reference: NonNullable<ReturnType<typeof useReferenceData>['reference']>; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className="drawer-backdrop" role="presentation" onClick={onClose}><aside className="history-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button><span className="eyebrow">{new Date(record.createdAt).toLocaleString('vi-VN')}</span><h2>{record.primaryEmotion?.emoji} {record.primaryEmotion?.emotion_name_vn ?? 'Unknown Check-in'}</h2><ColorOrb entries={record.primaryEmotion ? [{ color: record.primaryEmotion.color_hex, intensity: record.intensity ?? 1 }, ...record.secondaryEmotions.map((item) => ({ color: item.color_hex, intensity: 1 }))] : []} size="small" label="Color Orb chi tiết" />{record.intensity && <div className="drawer-intensity"><span>Cường độ</span><IntensityDots value={record.intensity} /></div>}<div className="drawer-sections">{record.secondaryEmotions.length > 0 && <div><span className="section-label">Cảm xúc phụ</span><TagList items={record.secondaryEmotions.map((item) => `${item.emoji} ${item.emotion_name_vn}`)} /></div>}{record.needs.length > 0 && <div><span className="section-label">Nhu cầu</span><TagList items={record.needs.map((item) => `${item.emoji} ${item.need_name_vn}`)} /></div>}{record.contexts.length > 0 && <div><span className="section-label">Bối cảnh</span><TagList items={record.contexts.map((item) => `${item.emoji} ${item.context_name_vn}`)} /></div>}<div><span className="section-label">Ghi chú</span><p>{record.note || 'Không có ghi chú.'}</p></div></div><div className="drawer-actions"><button className="button button--secondary" type="button" onClick={onEdit}>Chỉnh sửa</button><button className="button button--danger" type="button" onClick={onDelete}>Xoá</button></div><small className="drawer-footnote">{reference.emotions.length} cảm xúc tham chiếu đang hoạt động.</small></aside></div>
}
