import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { listCheckins } from '../checkin/services/checkinRepository'
import { useReferenceData } from '../checkin/hooks/useReferenceData'
import type { CheckinRecord, Emotion } from '../checkin/types'
import { createEmptyDiaryDraft, deleteDiary, getDiaryEntry, listDiaryEntries, listDiaryPrompts, saveDiary } from './services/diaryRepository'
import type { DiaryCheckinLink, DiaryDraft, DiaryEntry, DiaryImage, DiaryPrompt, DiaryPromptResponse } from './types'
import { addDiaryDays, clampDiaryWeight, DIARY_TIME_ZONE, formatDiaryDate, formatDiaryMonth, formatDiaryShortDate, getDiaryLocalDate, getDiaryMetrics, isDiaryDateToday, monthDateKey } from './utils'
import './diary.css'

type DiaryPageMode = 'today' | 'editor' | 'history'

const getMode = (search: URLSearchParams): DiaryPageMode => {
  const value = search.get('view')
  if (value === 'editor' || value === 'history') return value
  return 'today'
}

const statusLabel = (status: DiaryEntry['status']): string => status === 'done' ? 'Đã hoàn tất' : 'Bản nháp'
const statusClass = (status: DiaryEntry['status']): string => status === 'done' ? 'is-done' : 'is-draft'

const emptyDiaryDraft = (date: string): DiaryDraft => ({ ...createEmptyDiaryDraft(date), status: 'draft' })

const getPromptResponses = (entry: DiaryEntry | null, prompts: DiaryPrompt[]): DiaryPromptResponse[] =>
  entry?.promptResponses.map((response) => ({
    ...response,
    promptSnapshot: prompts.find((prompt) => prompt.id === response.promptId) ?? response.promptSnapshot,
  })) ?? []

const mapDraftToEntry = (draft: DiaryDraft): DiaryEntry => ({
  id: draft.id ?? `preview-${draft.localDate}`,
  userId: draft.userId ?? '',
  localDate: draft.localDate,
  status: draft.status,
  title: draft.title,
  overallText: draft.overallText,
  dailyEmotionId: draft.dailyEmotionId,
  dailyEmotionSnapshot: draft.dailyEmotionSnapshot,
  promptResponses: draft.promptResponses,
  checkinLinks: draft.checkinLinks,
  images: draft.images,
  createdAt: draft.createdAt ?? new Date().toISOString(),
  updatedAt: draft.updatedAt ?? new Date().toISOString(),
  completedAt: draft.completedAt ?? null,
})

const useDiaryEntries = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setIsLoading(true)
    try {
      setEntries(await listDiaryEntries())
      setError(null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải nhật ký.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [])
  return { entries, isLoading, error, refresh }
}

const useDiaryCheckins = (localDate: string, enabled = true) => {
  const { reference } = useReferenceData()
  const [records, setRecords] = useState<CheckinRecord[]>([])

  useEffect(() => {
    if (!enabled || !reference) return
    let isMounted = true
    void supabaseCheckins(reference, localDate).then((nextRecords) => {
      if (isMounted) setRecords(nextRecords)
    }).catch(() => {
      if (isMounted) setRecords([])
    })
    return () => { isMounted = false }
  }, [enabled, localDate, reference])

  return { records, reference }
}

const supabaseCheckins = async (reference: NonNullable<ReturnType<typeof useReferenceData>['reference']>, localDate: string): Promise<CheckinRecord[]> => {
  const records = await listCheckins(reference)
  return records.filter((record) => new Intl.DateTimeFormat('en-CA', { timeZone: DIARY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.createdAt)) === localDate)
}

const DiaryPageHeader = ({ title, description, children }: { title: string; description: string; children?: ReactNode }) => (
  <header className="diary-page-header">
    <div>
      <p className="eyebrow">Diary</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {children}
  </header>
)

const DiaryState = ({ children, error, onRetry }: { children: ReactNode; error?: string | null; onRetry?: () => void }) => (
  <div className="diary-state" role={error ? 'alert' : 'status'}>
    <span className="diary-state__mark" aria-hidden="true">{error ? '!' : '✦'}</span>
    <p>{error ?? children}</p>
    {error && onRetry && <button className="button button--secondary button--small" type="button" onClick={onRetry}>Thử lại</button>}
  </div>
)

const MetricCard = ({ icon, value, label, hint }: { icon: string; value: number; label: string; hint: string }) => (
  <article className="diary-metric-card">
    <span className="diary-metric-card__icon" aria-hidden="true">{icon}</span>
    <div><strong>{value}</strong><span>{label}</span><small>{hint}</small></div>
  </article>
)

const DiaryStatusBadge = ({ status }: { status: DiaryEntry['status'] }) => (
  <span className={`diary-status ${statusClass(status)}`}><span aria-hidden="true">{status === 'done' ? '✓' : '◌'}</span>{statusLabel(status)}</span>
)

const DiarySummary = ({ entry, checkins }: { entry: DiaryEntry; checkins: CheckinRecord[] }) => {
  const byId = new Map(checkins.map((record) => [record.id, record]))
  const progress = Math.min(100, Number(Boolean(entry.title.trim())) * 30 + Number(Boolean(entry.overallText.trim())) * 40 + Number(entry.promptResponses.length > 0) * 10 + Number(entry.dailyEmotionId !== null) * 7 + Number(entry.checkinLinks.length > 0) * 7 + Number(entry.images.length > 0) * 6)
  return <aside className="diary-summary" aria-label="Tóm tắt nhật ký">
    <div className="diary-summary__heading"><span>Nhật ký</span><DiaryStatusBadge status={entry.status} /></div>
    <div className="diary-summary__date">{formatDiaryDate(entry.localDate)}</div>
    <div className="diary-summary__progress"><span>Tiến độ bài viết</span><div className="diary-progress"><i style={{ width: `${progress}%` }} /></div><small>{entry.status === 'done' ? 'Đã hoàn tất' : 'Có thể lưu lại bất kỳ lúc nào'}</small></div>
    <div className="diary-summary__list">
      <span><i>✎</i> Tiêu đề <b>{entry.title ? 'Đã viết' : 'Chưa viết'}</b></span>
      <span><i>☰</i> Tổng quan <b>{entry.overallText ? 'Đã viết' : 'Chưa viết'}</b></span>
      <span><i>✦</i> Prompt <b>{entry.promptResponses.length || '—'}</b></span>
      <span><i>◉</i> Cảm xúc <b>{entry.dailyEmotionSnapshot?.emotion_name_vn ?? '—'}</b></span>
      <span><i>↗</i> Check-in <b>{entry.checkinLinks.length || '—'}</b></span>
      <span><i>▧</i> Ảnh <b>{entry.images.length}/4</b></span>
    </div>
    {entry.checkinLinks.length > 0 && <div className="diary-summary__chips">{entry.checkinLinks.map((link) => { const record = byId.get(link.checkinId); return <span key={link.checkinId}>{record?.primaryEmotion?.emoji ?? record?.unknownPrompt?.emoji ?? '◌'} {link.weightPercent}%</span> })}</div>}
  </aside>
}

const getCheckinLabel = (record: CheckinRecord): { title: string; emoji: string; description: string } => {
  if (record.checkinType === 'unknown') return { title: 'Mình còn đang mơ hồ', emoji: record.unknownPrompt?.emoji ?? '◌', description: record.note ?? 'Chưa có ghi chú' }
  return { title: record.primaryEmotion?.emotion_name_vn ?? 'Check-in cảm xúc', emoji: record.primaryEmotion?.emoji ?? '◉', description: record.note ?? 'Không có ghi chú' }
}

const formatCheckinTime = (record: CheckinRecord): string => new Intl.DateTimeFormat('vi-VN', { timeZone: DIARY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(record.createdAt))

const DiaryReadView = ({ entry, onEdit, onDelete }: { entry: DiaryEntry; onEdit?: () => void; onDelete?: () => void }) => {
  const { records, reference } = useDiaryCheckins(entry.localDate)
  const linked = entry.checkinLinks.map((link) => ({ link, record: records.find((record) => record.id === link.checkinId) })).filter((item): item is { link: DiaryCheckinLink; record: CheckinRecord } => Boolean(item.record))
  return <article className="diary-read-view">
    <div className="diary-read-view__toolbar"><DiaryStatusBadge status={entry.status} /><span>{formatDiaryDate(entry.localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><div>{onEdit && <button className="button button--secondary button--small" type="button" onClick={onEdit}>{entry.status === 'draft' ? '→ Tiếp tục viết' : '✎ Chỉnh sửa'}</button>}{onDelete && <button className="button button--danger button--small" type="button" onClick={onDelete}>Xóa</button>}</div></div>
    <h2>{entry.title}</h2>
    <p className="diary-read-view__overall">{entry.overallText}</p>
    {entry.dailyEmotionSnapshot && <section className="diary-read-section diary-read-section--emotion"><span className="diary-read-section__icon" style={{ background: `${entry.dailyEmotionSnapshot.color_hex}20` }}>{entry.dailyEmotionSnapshot.emoji}</span><div><span className="section-label">Cảm xúc chính của ngày</span><strong>{entry.dailyEmotionSnapshot.emotion_name_vn}</strong><small>{entry.dailyEmotionSnapshot.emotion_name_en}</small></div></section>}
    {entry.promptResponses.length > 0 && <section className="diary-read-section"><div className="diary-read-section__heading"><span className="section-label">Những dòng tự sự thêm</span><span>{entry.promptResponses.length} prompt</span></div><div className="diary-prompt-read-list">{entry.promptResponses.map((response) => <div className="diary-prompt-read" key={response.promptId} style={{ '--prompt-color': response.promptSnapshot.hexColor } as React.CSSProperties}><span className="diary-prompt-read__emoji">{response.promptSnapshot.emoji}</span><div><strong>{response.promptSnapshot.textVn}</strong>{response.responseText ? <p>{response.responseText}</p> : <small>Chưa thêm câu trả lời</small>}</div></div>)}</div></section>}
    {entry.checkinLinks.length > 0 && <section className="diary-read-section"><div className="diary-read-section__heading"><span className="section-label">Check-in trong ngày</span><span>{entry.checkinLinks.length} liên kết</span></div><div className="diary-checkin-read-list">{entry.checkinLinks.map((link) => { const item = linked.find((candidate) => candidate.link.checkinId === link.checkinId); const label = item ? getCheckinLabel(item.record) : null; return <div className="diary-checkin-read" key={link.checkinId}><span>{label?.emoji ?? '◌'}</span><div><strong>{label?.title ?? 'Check-in đã liên kết'}</strong><small>{item && label ? `${formatCheckinTime(item.record)} · ${label.description}` : 'Đang tải dữ liệu check-in'}</small></div><b>{link.weightPercent}%</b></div> })}</div>{!reference && <small>Đang tải dữ liệu tham chiếu…</small>}</section>}
    {entry.images.length > 0 && <section className="diary-read-section"><div className="diary-read-section__heading"><span className="section-label">Hình ảnh trong ngày</span><span>{entry.images.length}/4</span></div><div className="diary-read-images">{entry.images.map((image) => <figure key={image.id}><img src={image.externalUrl} alt={image.caption || 'Ảnh trong nhật ký'} /><figcaption>{image.caption || 'Ảnh trong ngày'}</figcaption></figure>)}</div></section>}
  </article>
}

export function DiaryTodayPage() {
  const navigate = useNavigate()
  const { entries, isLoading, error, refresh } = useDiaryEntries()
  const today = getDiaryLocalDate()
  const todayEntry = entries.find((entry) => entry.localDate === today) ?? null
  const metrics = useMemo(() => getDiaryMetrics(entries), [entries])
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const remove = async () => {
    if (!todayEntry || !window.confirm('Xóa nhật ký hôm nay? Bạn có thể viết lại từ đầu sau đó.')) return
    try { await deleteDiary(todayEntry.id); await refresh() } catch (reason: unknown) { setDeleteError(reason instanceof Error ? reason.message : 'Không thể xóa nhật ký.') }
  }

  if (isLoading) return <section className="diary-page"><DiaryState>Đang mở không gian viết của bạn…</DiaryState></section>
  if (error) return <section className="diary-page"><DiaryState error={error} onRetry={() => void refresh()}> </DiaryState></section>
  return <section className="diary-page" aria-labelledby="diary-today-title">
    <DiaryPageHeader title="Nhật ký hôm nay" description="Một khoảng lặng để bạn ghi lại điều đang ở cùng mình."><div className="diary-header-actions"><Link className="button button--secondary button--small" to="/diary?view=history">Lịch sử nhật ký</Link></div></DiaryPageHeader>
    {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
    <div className="diary-metrics"><MetricCard icon="◌" value={metrics.currentStreak} label="Chuỗi hiện tại" hint="ngày đã hoàn tất" /><MetricCard icon="♕" value={metrics.longestStreak} label="Chuỗi dài nhất" hint="ngày liên tiếp" /><MetricCard icon="▣" value={metrics.doneCount} label="Đã viết tháng này" hint="bài hoàn tất" /><MetricCard icon="✎" value={metrics.draftCount} label="Bản nháp" hint="có thể viết tiếp" /></div>
    {!todayEntry && <section className="diary-empty-hero"><div className="diary-empty-hero__art" aria-hidden="true"><span>✦</span><i>◌</i></div><div><p className="eyebrow">{formatDiaryDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>Hôm nay vẫn còn một khoảng trống.</h2><p>Không cần viết thật hay. Chỉ cần để lại một dấu nhỏ về ngày hôm nay, theo cách vừa đủ với bạn.</p><button className="button button--primary" type="button" onClick={() => navigate(`/diary?view=editor&date=${today}`)}>✎ Bắt đầu viết</button></div></section>}
    {todayEntry && <section className="diary-today-card"><div className="diary-today-card__intro"><div className="diary-today-card__heading"><div><p className="eyebrow">{formatDiaryDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>{todayEntry.status === 'done' ? 'Một ngày được giữ lại.' : 'Bản nháp của hôm nay'}</h2></div><DiaryStatusBadge status={todayEntry.status} /></div><h3>{todayEntry.title}</h3><p className="diary-today-card__excerpt">{todayEntry.overallText}</p>{todayEntry.promptResponses.length > 0 && <span className="diary-inline-meta">✦ {todayEntry.promptResponses.length} dòng tự sự thêm</span>}{todayEntry.checkinLinks.length > 0 && <span className="diary-inline-meta">↗ {todayEntry.checkinLinks.length} check-in gắn với ngày này</span>}<div className="diary-today-card__actions"><button className="button button--primary" type="button" onClick={() => navigate(`/diary?view=editor&date=${today}`)}>{todayEntry.status === 'done' ? 'Chỉnh sửa' : 'Tiếp tục viết'} <span aria-hidden="true">→</span></button><button className="button button--secondary" type="button" onClick={() => navigate('/diary?view=history')}>Xem lịch sử</button>{todayEntry.status === 'draft' && <button className="button button--danger button--small" type="button" onClick={() => void remove()}>Xóa bản nháp</button>}</div></div><div className="diary-today-card__preview"><span aria-hidden="true">{todayEntry.dailyEmotionSnapshot?.emoji ?? '✦'}</span><small>{todayEntry.dailyEmotionSnapshot?.emotion_name_vn ?? 'Một ngày đang được lắng nghe'}</small><b>{todayEntry.images.length ? `${todayEntry.images.length} ảnh` : 'Không gian của riêng bạn'}</b></div></section>}
    {todayEntry?.status === 'done' && <DiaryReadView entry={todayEntry} onEdit={() => navigate(`/diary?view=editor&date=${today}`)} onDelete={() => void remove()} />}
    {todayEntry?.status === 'draft' && <p className="diary-draft-note">Bản nháp đã được giữ lại. Bạn có thể hoàn tất bất cứ lúc nào.</p>}
  </section>
}

const localDraftStorageKey = (date: string): string => `sacky:diary:editor-draft:v2:${date}`

const readEditorCache = (date: string): DiaryDraft | null => {
  try {
    const value = JSON.parse(window.localStorage.getItem(localDraftStorageKey(date)) ?? 'null') as DiaryDraft | null
    return value?.localDate === date ? value : null
  } catch { return null }
}

const PromptSelectionModal = ({ prompts, selectedIds, onToggle, onClose }: { prompts: DiaryPrompt[]; selectedIds: string[]; onToggle: (id: string) => void; onClose: () => void }) => (
  <div className="diary-modal-backdrop" role="presentation" onClick={onClose}><section className="diary-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-dialog-title" onClick={(event) => event.stopPropagation()}><button className="diary-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><div className="diary-modal__header"><p className="eyebrow">Những dòng tự sự thêm</p><h2 id="prompt-dialog-title">Chọn prompt</h2><p>Chọn tối đa 6 prompt. Thứ tự bạn chọn sẽ được giữ nguyên trong bài viết.</p><strong>{selectedIds.length}/6 đã chọn</strong></div><div className="diary-prompt-selection-grid">{prompts.map((prompt) => { const selected = selectedIds.includes(prompt.id); const disabled = !selected && selectedIds.length >= 6; return <button key={prompt.id} type="button" className={`diary-prompt-selection ${selected ? 'is-selected' : ''}`} disabled={disabled} onClick={() => onToggle(prompt.id)} style={{ '--prompt-color': prompt.hexColor } as React.CSSProperties}><span>{prompt.emoji}</span><div><strong>{prompt.textVn}</strong>{prompt.description && <small>{prompt.description}</small>}</div><i aria-hidden="true">{selected ? '✓' : '+'}</i></button> })}</div><div className="diary-modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>Quay lại bài viết</button></div></section></div>
)

const EmotionPicker = ({ selected, emotions, onSelect }: { selected: string | null; emotions: Emotion[]; onSelect: (emotion: Emotion | null) => void }) => {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const filtered = useMemo(() => emotions.filter((emotion) => `${emotion.emotion_name_vn} ${emotion.emotion_name_en}`.toLowerCase().includes(query.toLowerCase())).slice(0, showAll || query ? 117 : 12), [emotions, query, showAll])
  return <div className="diary-emotion-picker"><div className="diary-section-header"><div><span className="section-label">Cảm xúc chính của ngày <em>tuỳ chọn</em></span><p>Chọn một trong 117 cảm xúc. Không cần chọn cường độ.</p></div>{selected && <button className="text-button" type="button" onClick={() => onSelect(null)}>Bỏ chọn</button>}</div><label className="diary-search"><span aria-hidden="true">⌕</span><input aria-label="Tìm cảm xúc" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm cảm xúc…" /></label><div className="diary-emotion-grid">{filtered.map((emotion) => <button key={emotion.emotion_id} type="button" className={`diary-emotion-option ${selected === emotion.emotion_id ? 'is-selected' : ''}`} style={{ '--emotion-color': emotion.color_hex } as React.CSSProperties} aria-pressed={selected === emotion.emotion_id} onClick={() => onSelect(selected === emotion.emotion_id ? null : emotion)}><span style={{ background: `${emotion.color_hex}20` }}>{emotion.emoji}</span><strong>{emotion.emotion_name_vn}</strong>{selected === emotion.emotion_id && <i aria-hidden="true">✓</i>}</button>)}</div>{emotions.length > 12 && !query && <button className="diary-show-more" type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Thu gọn danh sách' : `Xem tất cả ${emotions.length} cảm xúc`} <span aria-hidden="true">⌄</span></button>}</div>
}

const PromptResponseEditor = ({ responses, onChange, onRemove, onMove }: { responses: DiaryPromptResponse[]; onChange: (index: number, patch: Partial<DiaryPromptResponse>) => void; onRemove: (index: number) => void; onMove: (index: number, direction: -1 | 1) => void }) => <div className="diary-response-list">{responses.map((response, index) => <section className={`diary-response-card ${response.isDone ? 'is-done' : ''}`} key={response.promptId} style={{ '--prompt-color': response.promptSnapshot.hexColor } as React.CSSProperties}><div className="diary-response-card__top"><span className="diary-response-card__emoji">{response.promptSnapshot.emoji}</span><div><span className="section-label">Dòng {index + 1}</span><h3>{response.promptSnapshot.textVn}</h3></div><div className="diary-response-card__actions"><button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Di chuyển lên">↑</button><button type="button" onClick={() => onMove(index, 1)} disabled={index === responses.length - 1} aria-label="Di chuyển xuống">↓</button><button type="button" onClick={() => onRemove(index)} aria-label={`Bỏ prompt ${response.promptSnapshot.textVn}`}>×</button></div></div><textarea aria-label={`Trả lời: ${response.promptSnapshot.textVn}`} value={response.responseText} onChange={(event) => onChange(index, { responseText: event.target.value })} placeholder="Viết vài dòng nếu bạn muốn…" /><div className="diary-response-card__footer"><span>{response.responseText.length} ký tự</span><button type="button" className={`diary-tick ${response.isDone ? 'is-done' : ''}`} aria-pressed={response.isDone} onClick={() => onChange(index, { isDone: !response.isDone })}>{response.isDone ? '✓ Đã viết xong' : '○ Đánh dấu đã xong'}</button></div></section>)}</div>

const CheckinAttachmentPicker = ({ localDate, records, links, onChange }: { localDate: string; records: CheckinRecord[]; links: DiaryCheckinLink[]; onChange: (links: DiaryCheckinLink[]) => void }) => {
  const toggle = (record: CheckinRecord) => {
    const existing = links.find((link) => link.checkinId === record.id)
    onChange(existing ? links.filter((link) => link.checkinId !== record.id) : [...links, { checkinId: record.id, weightPercent: 50, position: links.length + 1 }])
  }
  const updateWeight = (id: string, value: number) => onChange(links.map((link) => link.checkinId === id ? { ...link, weightPercent: clampDiaryWeight(value) } : link))
  return <div className="diary-checkin-picker"><div className="diary-section-header"><div><span className="section-label">Check-in trong ngày <em>tuỳ chọn</em></span><p>Chỉ hiện Check-in của {isDiaryDateToday(localDate) ? 'hôm nay' : formatDiaryShortDate(localDate)}. Mỗi mức đại diện là độc lập.</p></div><span className="diary-count-badge">{links.length} đã gắn</span></div>{records.length === 0 && <div className="diary-subtle-empty">Chưa có Check-in nào cho ngày này. Bạn vẫn có thể viết nhật ký mà không cần gắn Check-in.</div>}<div className="diary-checkin-list">{records.map((record) => { const link = links.find((item) => item.checkinId === record.id); const label = getCheckinLabel(record); const checkinColor = record.primaryEmotion?.color_hex ?? '#7B879D'; return <div key={record.id} className={`diary-checkin-option ${link ? 'is-selected' : ''}`} style={{ '--checkin-color': checkinColor } as React.CSSProperties}><button type="button" className="diary-checkin-option__main" aria-pressed={Boolean(link)} onClick={() => toggle(record)}><span className="diary-checkin-option__emoji">{label.emoji}</span><span><strong>{label.title}</strong><small>{formatCheckinTime(record)} · {label.description}</small></span><i aria-hidden="true">{link ? '✓' : '+'}</i></button>{link && <label className="diary-weight"><span>Mức đại diện</span><input type="range" min="1" max="100" value={link.weightPercent} style={{ '--weight-percent': `${link.weightPercent}%` } as React.CSSProperties} onChange={(event) => updateWeight(record.id, Number(event.target.value))} aria-label={`Mức đại diện cho ${label.title}`} /><b>{link.weightPercent}%</b></label>}</div> })}</div><p className="diary-helper">Các mức phần trăm không cần cộng thành 100%. Chúng chỉ nói lên Check-in nào ảnh hưởng hoặc đại diện cho ngày viết này.</p></div>
}

const ImageManager = ({ images, onChange }: { images: DiaryImage[]; onChange: (images: DiaryImage[]) => void }) => {
  const [url, setUrl] = useState('')
  const add = () => { const value = url.trim(); if (!value || images.length >= 4) return; onChange([...images, { id: `image-${Date.now()}`, externalUrl: value, position: images.length + 1, caption: '' }]); setUrl('') }
  const replace = (image: DiaryImage) => { const value = window.prompt('Dán link ảnh mới', image.externalUrl); if (value?.trim()) onChange(images.map((item) => item.id === image.id ? { ...item, externalUrl: value.trim() } : item)) }
  const update = (id: string, patch: Partial<DiaryImage>) => onChange(images.map((image) => image.id === id ? { ...image, ...patch } : image))
  const move = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= images.length) return; const next = [...images]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; onChange(next.map((image, position) => ({ ...image, position: position + 1 }))) }
  return <div className="diary-image-manager"><div className="diary-section-header"><div><span className="section-label">Hình ảnh trong ngày <em>tuỳ chọn</em></span><p>Thêm tối đa 4 ảnh. Ảnh được lưu bằng link ngoài, sẵn sàng kết nối với Google Drive.</p></div><span className="diary-count-badge">{images.length}/4</span></div><div className="diary-image-add"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Dán link ảnh (Google Drive hoặc URL ngoài)…" aria-label="Link ảnh" onKeyDown={(event) => { if (event.key === 'Enter') add() }} /><button className="button button--secondary button--small" type="button" disabled={!url.trim() || images.length >= 4} onClick={add}>＋ Thêm ảnh</button></div>{images.length > 0 && <div className="diary-image-grid">{images.map((image, index) => <figure className="diary-image-card" key={image.id}><div className="diary-image-card__media"><img src={image.externalUrl} alt={image.caption || `Ảnh ${index + 1}`} onError={(event) => { event.currentTarget.style.opacity = '0.2' }} /><span>{index + 1}</span></div><input value={image.caption} maxLength={120} onChange={(event) => update(image.id, { caption: event.target.value })} placeholder="Chú thích (tuỳ chọn)…" aria-label={`Chú thích ảnh ${index + 1}`} /><figcaption><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>←</button><button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1}>→</button><button type="button" onClick={() => replace(image)}>↻ Thay ảnh</button><button type="button" onClick={() => onChange(images.filter((item) => item.id !== image.id).map((item, position) => ({ ...item, position: position + 1 })))}>Xóa</button></figcaption></figure>)}</div>}{images.length === 4 && <div className="diary-image-limit">✓ Đã đạt giới hạn 4 ảnh cho ngày này</div>}<p className="diary-helper">Media storage trung lập: bạn có thể dán URL hoặc định danh file bên ngoài. App không giả định Supabase Storage là kho ảnh cuối cùng.</p></div>
}

export function DiaryEditorPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const localDate = searchParams.get('date') || getDiaryLocalDate()
  const [draft, setDraft] = useState<DiaryDraft>(() => emptyDiaryDraft(localDate))
  const [prompts, setPrompts] = useState<DiaryPrompt[]>([])
  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState('')
  const [showPromptSelection, setShowPromptSelection] = useState(false)
  const { reference } = useReferenceData()

  useEffect(() => {
    let isMounted = true
    void Promise.all([getDiaryEntry(localDate), listDiaryPrompts()]).then(([entry, nextPrompts]) => {
      const cached = readEditorCache(localDate)
      let nextDraft: DiaryDraft = entry ? { ...entry, id: entry.id, userId: entry.userId } : emptyDiaryDraft(localDate)
      if (cached && (!entry || (cached.updatedAt && cached.updatedAt > entry.updatedAt))) nextDraft = cached
      if (isMounted) { setDraft({ ...nextDraft, promptResponses: getPromptResponses(entry, nextPrompts).length && !cached ? getPromptResponses(entry, nextPrompts) : nextDraft.promptResponses }); setPrompts(nextPrompts); setIsLoading(false) }
    }).catch((reason: unknown) => { if (isMounted) { setError(reason instanceof Error ? reason.message : 'Không thể mở trình biên tập.'); setIsLoading(false) } })
    return () => { isMounted = false }
  }, [localDate])

  useEffect(() => {
    if (!reference) return
    let isMounted = true
    void supabaseCheckins(reference, localDate).then((nextRecords) => {
      if (isMounted) setRecords(nextRecords)
    }).catch(() => {
      if (isMounted) setRecords([])
    })
    return () => { isMounted = false }
  }, [localDate, reference])

  useEffect(() => {
    if (isLoading) return
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(localDraftStorageKey(localDate), JSON.stringify(draft)); setSaveNotice('Đã lưu an toàn trên thiết bị') } catch { setSaveNotice('') }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft, isLoading, localDate])

  const updateDraft = (patch: Partial<DiaryDraft>) => { setDraft((current) => ({ ...current, ...patch })); setError(null); setSaveNotice('Đang lưu…') }
  const emotions = reference?.emotions ?? []
  const selectedIds = draft.promptResponses.map((response) => response.promptId)
  const togglePrompt = (id: string) => {
    if (selectedIds.includes(id)) updateDraft({ promptResponses: draft.promptResponses.filter((response) => response.promptId !== id) })
    else if (selectedIds.length < 6) { const prompt = prompts.find((item) => item.id === id); if (prompt) updateDraft({ promptResponses: [...draft.promptResponses, { promptId: id, promptSnapshot: prompt, position: draft.promptResponses.length + 1, responseText: '', isDone: false }] }) }
  }
  const updateResponse = (index: number, patch: Partial<DiaryPromptResponse>) => updateDraft({ promptResponses: draft.promptResponses.map((response, responseIndex) => responseIndex === index ? { ...response, ...patch } : response) })
  const removeResponse = (index: number) => { const response = draft.promptResponses[index]; if (response.responseText.trim() && !window.confirm('Prompt này đã có nội dung. Bỏ prompt sẽ xóa phần đã viết, bạn có muốn tiếp tục?')) return; updateDraft({ promptResponses: draft.promptResponses.filter((_, responseIndex) => responseIndex !== index).map((item, position) => ({ ...item, position: position + 1 })) }) }
  const moveResponse = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= draft.promptResponses.length) return; const next = [...draft.promptResponses]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; updateDraft({ promptResponses: next.map((item, position) => ({ ...item, position: position + 1 })) }) }
  const selectEmotion = (emotion: Emotion | null) => updateDraft({ dailyEmotionId: emotion?.emotion_id ?? null, dailyEmotionSnapshot: emotion ? { emotion_id: emotion.emotion_id, emotion_name_vn: emotion.emotion_name_vn, emotion_name_en: emotion.emotion_name_en, emoji: emotion.emoji, color_hex: emotion.color_hex } : null })
  const persist = async (target: 'draft' | 'done') => {
    if (!draft.title.trim()) { setError('Hãy thêm tiêu đề trước khi lưu.'); return }
    if (!draft.overallText.trim()) { setError('Hãy viết một chút cho phần tổng quan trước khi lưu.'); return }
    setIsSaving(true); setError(null)
    try {
      const saved = await saveDiary({ ...draft, status: target === 'done' ? 'done' : draft.status === 'done' ? 'done' : 'draft' })
      window.localStorage.removeItem(localDraftStorageKey(localDate))
      if (target === 'done') navigate('/diary')
      else { setDraft({ ...saved }); setSaveNotice('Đã lưu bản nháp'); navigate(`/diary?view=editor&date=${localDate}`, { replace: true }) }
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể lưu nhật ký.') } finally { setIsSaving(false) }
  }

  if (isLoading) return <section className="diary-page"><DiaryState>Đang chuẩn bị trang viết…</DiaryState></section>
  if (error && !draft.localDate) return <section className="diary-page"><DiaryState error={error}> </DiaryState></section>
  const previewEntry = mapDraftToEntry(draft)
  const isBackfill = !isDiaryDateToday(localDate)
  return <section className="diary-page diary-page--editor" aria-labelledby="diary-editor-title">
    <div className="diary-editor-heading"><div><Link className="diary-back-link" to={isBackfill ? '/diary?view=history' : '/diary'}>← Quay lại</Link><p className="eyebrow">{isBackfill ? 'Viết bù' : 'Diary hôm nay'}</p><h1 id="diary-editor-title">{isBackfill ? 'Giữ lại một ngày đã qua' : 'Viết nhật ký'}</h1><p className="diary-date-context">{formatDiaryDate(localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{isBackfill && ' · Bạn đang viết cho ngày này'}</p></div><div className="diary-editor-actions"><span className="diary-autosave" role="status"><i aria-hidden="true">●</i>{saveNotice || 'Bản nháp tự động'}</span><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void persist('draft')}>▣ {draft.status === 'done' ? 'Lưu thay đổi' : 'Lưu nháp'}</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void persist('done')}>✓ {isSaving ? 'Đang lưu…' : 'Đánh dấu hoàn tất'}</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="diary-editor-layout"><main className="diary-editor-main"><section className="diary-editor-card diary-editor-card--writing"><div className="diary-field"><label htmlFor="diary-title">Tiêu đề <em>*</em></label><input id="diary-title" maxLength={120} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Một tiêu đề để nhớ về ngày hôm nay…" /><small>{draft.title.length}/120</small></div><div className="diary-field"><label htmlFor="diary-overall">Tổng quan <em>*</em></label><textarea id="diary-overall" value={draft.overallText} onChange={(event) => updateDraft({ overallText: event.target.value })} placeholder="Hôm nay của bạn như thế nào? Điều gì đã xảy ra, bạn đã nghĩ gì, cảm nhận gì?" rows={9} /><small>{draft.overallText.length} ký tự</small></div></section><section className="diary-editor-card"><div className="diary-section-header"><div><span className="section-label">Những dòng tự sự thêm</span><p>Chọn prompt nếu bạn muốn nhìn ngày hôm nay từ một góc khác.</p></div><button className="button button--secondary button--small" type="button" onClick={() => setShowPromptSelection(true)}>＋ {draft.promptResponses.length ? 'Thêm / sửa prompt' : 'Chọn prompt'}</button></div>{draft.promptResponses.length === 0 ? <div className="diary-subtle-empty diary-subtle-empty--prompt">Chưa có prompt nào được chọn. Phần này hoàn toàn tuỳ chọn.</div> : <PromptResponseEditor responses={draft.promptResponses} onChange={updateResponse} onRemove={removeResponse} onMove={moveResponse} />}</section><section className="diary-editor-card"><EmotionPicker selected={draft.dailyEmotionId} emotions={emotions} onSelect={selectEmotion} /></section><section className="diary-editor-card"><CheckinAttachmentPicker localDate={localDate} records={records} links={draft.checkinLinks} onChange={(links) => updateDraft({ checkinLinks: links })} /></section><section className="diary-editor-card"><ImageManager images={draft.images} onChange={(images) => updateDraft({ images })} /></section><div className="diary-editor-footer"><Link className="button button--secondary" to={isBackfill ? '/diary?view=history' : '/diary'}>← Quay lại</Link><div><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void persist('draft')}>{draft.status === 'done' ? 'Lưu thay đổi' : 'Lưu nháp'}</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void persist('done')}>✓ Hoàn tất nhật ký</button></div></div></main><DiarySummary entry={previewEntry} checkins={records} /></div>
    {showPromptSelection && <PromptSelectionModal prompts={prompts} selectedIds={selectedIds} onToggle={togglePrompt} onClose={() => setShowPromptSelection(false)} />}
  </section>
}

const getMonthDateKeys = (monthKey: string): string[] => {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const startOffset = first.getUTCDay() === 0 ? 6 : first.getUTCDay() - 1
  const gridStart = addDiaryDays(monthKey + '-01', -startOffset)
  return Array.from({ length: 42 }, (_, index) => addDiaryDays(gridStart, index))
}

const DiaryCalendar = ({ month, entries, selectedDate, onSelect, onMoveMonth }: { month: string; entries: DiaryEntry[]; selectedDate: string; onSelect: (date: string) => void; onMoveMonth: (amount: number) => void }) => {
  const byDate = new Map(entries.map((entry) => [entry.localDate, entry]))
  const days = getMonthDateKeys(month)
  return <section className="diary-calendar"><div className="diary-calendar__header"><div><span className="section-label">Lịch viết</span><h2>{formatDiaryMonth(new Date(`${month}-01T12:00:00+07:00`))}</h2></div><div><button type="button" onClick={() => onMoveMonth(-1)} aria-label="Tháng trước">‹</button><button type="button" onClick={() => onMoveMonth(1)} aria-label="Tháng sau">›</button></div></div><div className="diary-weekdays">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}</div><div className="diary-calendar__grid">{days.map((date) => { const entry = byDate.get(date); const inMonth = date.startsWith(month); return <button key={date} type="button" className={`diary-calendar-day ${inMonth ? '' : 'is-outside'} ${selectedDate === date ? 'is-selected' : ''} ${entry ? statusClass(entry.status) : 'is-missing'}`} onClick={() => onSelect(date)}><span>{Number(date.slice(8, 10))}</span>{entry && <i aria-label={statusLabel(entry.status)} />}</button> })}</div><div className="diary-calendar__legend"><span><i className="is-done" /> Đã viết</span><span><i className="is-draft" /> Bản nháp</span><span><i className="is-missing" /> Chưa viết</span></div></section>
}

const HistoryDetail = ({ date, entry, onEdit, onDelete }: { date: string; entry: DiaryEntry | null; onEdit: () => void; onDelete: () => void }) => {
  if (!entry) return <section className="diary-history-detail diary-history-detail--missing"><div className="diary-empty-hero__art" aria-hidden="true"><span>✦</span><i>◌</i></div><p className="eyebrow">{formatDiaryDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>Chưa viết ngày này</h2><p>Mỗi ngày là một cơ hội để nhìn lại. Bạn có thể viết bù mà không cần quay về hôm nay.</p><button className="button button--primary" type="button" onClick={onEdit}>✎ Viết bù</button></section>
  return <DiaryReadView entry={entry} onEdit={onEdit} onDelete={onDelete} />
}

export function DiaryHistoryPage() {
  const navigate = useNavigate()
  const { entries, isLoading, error, refresh } = useDiaryEntries()
  const today = getDiaryLocalDate()
  const [month, setMonth] = useState(monthDateKey(new Date()).slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [filter, setFilter] = useState<'all' | 'done' | 'draft'>('all')
  const metrics = useMemo(() => getDiaryMetrics(entries), [entries])
  const visibleEntries = useMemo(() => entries.filter((entry) => entry.localDate.startsWith(month)).filter((entry) => filter === 'all' || entry.status === filter).sort((left, right) => right.localDate.localeCompare(left.localDate)), [entries, filter, month])
  const selectedEntry = entries.find((entry) => entry.localDate === selectedDate) ?? null
  const deleteSelected = async () => {
    if (!selectedEntry || !window.confirm('Xóa nhật ký này? Check-in và dữ liệu cảm xúc gốc sẽ không bị ảnh hưởng.')) return
    await deleteDiary(selectedEntry.id)
    setSelectedDate(today)
    await refresh()
  }
  const changeMonth = (amount: number) => { const [year, monthNumber] = month.split('-').map(Number); const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1)); setMonth(next.toISOString().slice(0, 7)) }

  if (isLoading) return <section className="diary-page"><DiaryState>Đang mở lịch sử nhật ký…</DiaryState></section>
  if (error) return <section className="diary-page"><DiaryState error={error} onRetry={() => void refresh()}> </DiaryState></section>
  return <section className="diary-page diary-page--history" aria-labelledby="diary-history-title">
    <DiaryPageHeader title="Lịch sử nhật ký" description="Nhìn lại hành trình viết của bạn theo thời gian."><Link className="button button--secondary button--small" to="/diary">← Hôm nay</Link></DiaryPageHeader>
    <div className="diary-metrics"><MetricCard icon="◌" value={metrics.currentStreak} label="Chuỗi hiện tại" hint="ngày đã hoàn tất" /><MetricCard icon="♕" value={metrics.longestStreak} label="Chuỗi dài nhất" hint="ngày liên tiếp" /><MetricCard icon="▣" value={metrics.doneCount} label="Đã viết tháng này" hint="bài hoàn tất" /><MetricCard icon="✎" value={metrics.draftCount} label="Bản nháp" hint="chưa hoàn tất" /></div>
    <div className="diary-history-layout"><div className="diary-history-calendar-column"><DiaryCalendar month={month} entries={entries} selectedDate={selectedDate} onSelect={setSelectedDate} onMoveMonth={changeMonth} /><section className="diary-timeline"><div className="diary-section-header"><div><span className="section-label">Dòng thời gian</span><p>Những ngày bạn đã để lại một điều gì đó.</p></div><div className="diary-filter-tabs" role="tablist" aria-label="Lọc nhật ký">{(['all', 'done', 'draft'] as const).map((value) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'Tất cả' : value === 'done' ? 'Đã hoàn tất' : 'Bản nháp'}</button>)}</div></div>{visibleEntries.length === 0 && <div className="diary-subtle-empty">Chưa có bài viết nào trong bộ lọc này.</div>}{visibleEntries.map((entry) => <button key={entry.id} type="button" className={`diary-timeline-item ${selectedDate === entry.localDate ? 'is-selected' : ''}`} onClick={() => setSelectedDate(entry.localDate)}><span className={`diary-timeline-item__dot ${statusClass(entry.status)}`} /><div><small>{formatDiaryShortDate(entry.localDate)}</small><strong>{entry.title}</strong><p>{entry.overallText}</p><span>{entry.promptResponses.length ? `✦ ${entry.promptResponses.length} prompt` : ''} {entry.images.length ? ` · ▧ ${entry.images.length} ảnh` : ''}</span></div><DiaryStatusBadge status={entry.status} /></button>)}</section></div><HistoryDetail date={selectedDate} entry={selectedEntry} onEdit={() => navigate(`/diary?view=editor&date=${selectedDate}`)} onDelete={() => void deleteSelected()} /></div>
  </section>
}

export function DiaryPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const mode = getMode(searchParams)
  // A direct /diary route must always land in the Today state; query params only extend it.
  if (location.pathname !== '/diary') return <DiaryTodayPage />
  if (mode === 'editor') return <DiaryEditorPage />
  if (mode === 'history') return <DiaryHistoryPage />
  return <DiaryTodayPage />
}
