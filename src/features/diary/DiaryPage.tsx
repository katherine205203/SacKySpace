import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { listCheckins } from '../checkin/services/checkinRepository'
import { useReferenceData } from '../checkin/hooks/useReferenceData'
import type { CheckinRecord, Emotion } from '../checkin/types'
import { createEmptyDiaryDraft, deleteDiary, getDiaryEntry, listDiaryEntries, listDiaryPrompts, saveDiary } from './services/diaryRepository'
import type { DiaryCheckinLink, DiaryDraft, DiaryEntry, DiaryImage, DiaryPrompt, DiaryPromptResponse } from './types'
import { addDiaryDays, clampDiaryWeight, DIARY_TIME_ZONE, formatDiaryDate, formatDiaryMonth, formatDiaryShortDate, getDiaryLocalDate, getDiaryMetrics, isDiaryDateToday, monthDateKey } from './utils'
import { getDiaryDraftSignature, hasDiaryDraftContent, parseDiaryEditorCache } from './editorAutosave'
import { PageHeading } from '../../components/PageHeading'
import { useUiContent } from '../../services/uiContent'
import { DayRecordContextCard, DayRecordPage } from './components/DayRecord'
import { EmotionPicker } from './components/DiaryPickers'
import { DiaryEmotionVisual } from './components/DiaryEmotionVisual'
import { JourneyPage } from './JourneyPage'
import { uploadDiaryMedia, validateLocalDiaryImage } from './services/diaryMedia'
import { isRichTextEmpty, richTextToPlainText, richTextWordCount, RichTextEditor, RichTextRenderer } from '../../components/richText'
import './diary.css'

type DiaryPageMode = 'today' | 'editor' | 'read' | 'history' | 'day-record' | 'journey-setup' | 'journey-editor' | 'journey-read'

const getMode = (search: URLSearchParams): DiaryPageMode => {
  const value = search.get('view')
  if (value === 'editor' || value === 'read' || value === 'history' || value === 'day-record' || value === 'journey-setup' || value === 'journey-editor' || value === 'journey-read') return value
  return 'today'
}

const isDiaryFinished = (status: DiaryEntry['status']): boolean => status === 'done'
const statusLabel = (status: DiaryEntry['status']): string => status === 'done' ? 'Đã hoàn tất' : 'Bản nháp'
const statusClass = (status: DiaryEntry['status']): string => status === 'done' ? 'is-done' : 'is-draft'

const emptyDiaryDraft = (date: string): DiaryDraft => ({ ...createEmptyDiaryDraft(date), status: 'draft' })

const getPromptResponses = (entry: DiaryEntry | null, prompts: DiaryPrompt[]): DiaryPromptResponse[] =>
  entry?.promptResponses.map((response) => ({
    ...response,
    promptSnapshot: response.promptSnapshot.source === 'gift_for_tomorrow'
      ? response.promptSnapshot
      : prompts.find((prompt) => prompt.id === response.promptId) ?? response.promptSnapshot,
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
  completionSource: draft.completionSource ?? null,
  isBackfilled: draft.isBackfilled,
})

type PendingDiaryImage = {
  id: string
  slotOrder: number
  previewUrl: string
  file?: File
  sourceUrl?: string
  caption: string
  status: 'selected' | 'compressing' | 'uploading' | 'saving' | 'error'
  error?: string
}

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
  return records.filter((record) => new Intl.DateTimeFormat('en-CA', { timeZone: DIARY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.occurredAt)) === localDate)
}

const DiaryPageHeader = ({ title, description, children }: { title: string; description: string; children?: ReactNode }) => {
  const eyebrow = useUiContent('diary.landing.eyebrow')
  const landingTitle = useUiContent('diary.landing.title')
  const landingDescription = useUiContent('diary.landing.subtitle')
  return <PageHeading className="diary-page-header" eyebrow={eyebrow} title={title === 'Nhật ký hôm nay' ? landingTitle : title} description={description === 'Một khoảng lặng để bạn ghi lại điều đang ở cùng mình.' ? landingDescription : description} actions={children} titleId={title === 'Nhật ký hôm nay' ? 'diary-today-title' : 'diary-history-title'} />
}

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

const DiaryMetrics = ({ metrics }: { metrics: ReturnType<typeof getDiaryMetrics> }) => (
  <div className="diary-metrics" aria-label="Tóm tắt hành trình viết">
    <MetricCard icon="↗" value={metrics.currentStreak} label="Chuỗi hiện tại" hint="ngày đã hoàn tất" />
    <MetricCard icon="∞" value={metrics.longestStreak} label="Chuỗi dài nhất" hint="ngày liên tiếp" />
    <MetricCard icon="✍" value={metrics.doneCount} label="Đã viết tháng này" hint="bài hoàn tất" />
    <MetricCard icon="□" value={metrics.draftCount} label="Bản nháp" hint="có thể viết tiếp" />
  </div>
)

const DiaryStatusBadge = ({ status }: { status: DiaryEntry['status'] }) => (
  <span className={`diary-status ${statusClass(status)}`}><span aria-hidden="true">{isDiaryFinished(status) ? '✓' : '◌'}</span>{statusLabel(status)}</span>
)

const DiarySummary = ({ entry, checkins }: { entry: DiaryEntry; checkins: CheckinRecord[] }) => {
  const byId = new Map(checkins.map((record) => [record.id, record]))
  const progress = Math.min(100, Number(Boolean(entry.title.trim())) * 16 + Number(!isRichTextEmpty(entry.overallText)) * 24 + Number(entry.promptResponses.length > 0) * 20 + Number(entry.dailyEmotionId !== null) * 15 + Number(entry.checkinLinks.length > 0) * 15 + Number(entry.images.length > 0) * 10)
  return <aside className="diary-summary" aria-label="Tóm tắt nhật ký">
    <div className="diary-summary__heading"><span>Nhật ký</span><DiaryStatusBadge status={entry.status} /></div>
    <div className="diary-summary__date">{formatDiaryDate(entry.localDate)}</div>
    <div className="diary-summary__progress"><span>Tiến độ bài viết</span><div className="diary-progress"><i style={{ width: `${progress}%` }} /></div><small>{isDiaryFinished(entry.status) ? statusLabel(entry.status) : 'Có thể lưu lại bất kỳ lúc nào'}</small></div>
    <div className="diary-summary__list">
      <span><i>✎</i> Tiêu đề <b>{entry.title ? 'Có' : 'Chưa thêm'}</b></span>
      <span><i>☰</i> Tổng quan <b>{isRichTextEmpty(entry.overallText) ? 'Chưa thêm' : 'Có'}</b></span>
      <span><i>✦</i> Prompt <b>{entry.promptResponses.length}/6</b></span>
      <span><i>◉</i> Cảm xúc <b>{entry.dailyEmotionSnapshot ? '1/1' : '0/1'}</b></span>
      <span><i>↗</i> Check-in <b>{entry.checkinLinks.length}</b></span>
      <span><i>▧</i> Ảnh <b>{entry.images.length}/4</b></span>
    </div>
    {entry.checkinLinks.length > 0 && <div className="diary-summary__chips">{entry.checkinLinks.map((link) => { const record = byId.get(link.checkinId); return <span key={link.checkinId}>{record?.primaryEmotion?.emoji ?? record?.unknownPrompt?.emoji ?? '◌'} {link.weightPercent}%</span> })}</div>}
  </aside>
}

const getCheckinLabel = (record: CheckinRecord): { title: string; emoji: string; description: string } => {
  const note = richTextToPlainText(record.note).trim()
  if (record.checkinType === 'unknown') return { title: 'Mình còn đang mơ hồ', emoji: record.unknownPrompt?.emoji ?? '◌', description: note || 'Chưa có ghi chú' }
  return {
    title: record.primaryEmotion?.emotion_name_vn ?? 'Check-in cảm xúc',
    emoji: record.primaryEmotion?.emoji ?? '◉',
    description: [record.primaryEmotion?.emotion_name_en, note].filter(Boolean).join(' · ') || 'Không có ghi chú',
  }
}

const formatCheckinTime = (record: CheckinRecord): string => new Intl.DateTimeFormat('vi-VN', { timeZone: DIARY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(record.occurredAt))

const DiaryReadView = ({ entry, onEdit, onDelete, emotionSize = 'default', historyDetail = false }: { entry: DiaryEntry; onEdit?: () => void; onDelete?: () => void; emotionSize?: 'default' | 'small'; historyDetail?: boolean }) => {
  const { records, reference } = useDiaryCheckins(entry.localDate)
  const linked = entry.checkinLinks.map((link) => ({ link, record: records.find((record) => record.id === link.checkinId) })).filter((item): item is { link: DiaryCheckinLink; record: CheckinRecord } => Boolean(item.record))
  const completedPrompts = entry.promptResponses.filter((response) => response.isDone).length
  const updatedTime = new Intl.DateTimeFormat('vi-VN', { timeZone: DIARY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(entry.updatedAt))
  return <article className={`diary-read-view${historyDetail ? ' diary-read-view--history' : ''}`}>
    <div className="diary-read-view__toolbar"><span className="diary-read-view__date">{formatDiaryDate(entry.localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><div><DiaryStatusBadge status={entry.status} />{onEdit && <button className="button button--secondary button--small" type="button" onClick={onEdit}>{entry.status === 'draft' ? '→ Tiếp tục viết' : '✎ Chỉnh sửa'}</button>}{onDelete && <button className="button button--danger button--small" type="button" onClick={onDelete}>Xóa</button>}</div></div>
    <div className="diary-read-hero">
      <div className="diary-read-hero__copy">{entry.dailyEmotionSnapshot && <DiaryEmotionVisual snapshot={entry.dailyEmotionSnapshot} size={emotionSize} />}<p className="eyebrow">{entry.status === 'done' ? 'Một ngày được giữ lại' : 'Bản nháp của ngày này'}</p><h2>{entry.title || 'Nhật ký ngày này'}</h2>{!isRichTextEmpty(entry.overallText) && <RichTextRenderer value={entry.overallText} className="diary-read-view__overall" />}</div>
    </div>
    <div className="diary-read-details" aria-label="Tóm tắt bài viết">
      <div><span>Check-in trong ngày</span><strong>{entry.checkinLinks.length ? `${entry.checkinLinks.length} gắn` : 'Chưa gắn'}</strong></div>
      <div><span>Trả lời gợi ý</span><strong>{completedPrompts}/{entry.promptResponses.length || 0} dòng</strong></div>
      <div><span>Thời gian cập nhật</span><strong>{updatedTime}</strong></div>
      <div><span>Hình ảnh</span><strong>{entry.images.length}/4</strong></div>
    </div>
    <DayRecordContextCard localDate={entry.localDate} entry={entry} />
    {entry.promptResponses.length > 0 && <section className="diary-read-section"><div className="diary-read-section__heading"><span className="section-label">Những dòng tự sự thêm</span><span>{entry.promptResponses.length} prompt</span></div><div className="diary-prompt-read-list">{entry.promptResponses.map((response) => <div className="diary-prompt-read" key={response.promptSnapshot.id} style={{ '--prompt-color': response.promptSnapshot.hexColor } as React.CSSProperties}><span className="diary-prompt-read__emoji">{response.promptSnapshot.emoji}</span><div><strong>{response.promptSnapshot.textVn}</strong>{response.promptSnapshot.source === 'gift_for_tomorrow' && <small className="diary-prompt-read__provenance">Từ Quà cho ngày mai</small>}{!isRichTextEmpty(response.responseText) ? <RichTextRenderer value={response.responseText} /> : <small>Chưa thêm câu trả lời</small>}</div></div>)}</div></section>}
    {entry.checkinLinks.length > 0 && <section className="diary-read-section"><div className="diary-read-section__heading"><span className="section-label">Check-in trong ngày</span><span>{entry.checkinLinks.length} liên kết</span></div><div className="diary-checkin-read-list">{entry.checkinLinks.map((link) => { const item = linked.find((candidate) => candidate.link.checkinId === link.checkinId); const label = item ? getCheckinLabel(item.record) : null; return <div className="diary-checkin-read" key={link.checkinId}><span>{label?.emoji ?? '◌'}</span><div><strong>{label?.title ?? 'Check-in đã liên kết'}</strong><small>{item && label ? `${formatCheckinTime(item.record)} · ${label.description}` : 'Đang tải dữ liệu check-in'}</small></div><b>{link.weightPercent}%</b></div> })}</div>{!reference && <small>Đang tải dữ liệu tham chiếu…</small>}</section>}
    {entry.images.length > 0 && <section className="diary-read-section"><div className="diary-read-section__heading"><span className="section-label">Hình ảnh trong ngày</span><span>{entry.images.length}/4</span></div><div className="diary-read-images">{entry.images.map((image) => <figure key={image.id}><img src={image.externalUrl} alt={image.caption || 'Ảnh trong nhật ký'} loading="lazy" /><figcaption>{image.caption || 'Ảnh trong ngày'}</figcaption></figure>)}</div></section>}
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
    <DiaryPageHeader title="Nhật ký hôm nay" description="Một khoảng lặng để bạn ghi lại điều đang ở cùng mình."><div className="diary-header-actions">{todayEntry && isDiaryFinished(todayEntry.status) && <><Link className="button button--primary button--small" to={`/diary?view=read&date=${today}`}>Xem hôm nay</Link><button className="button button--secondary button--small" type="button" onClick={() => navigate(`/diary?view=editor&date=${today}`)}>✎ Chỉnh sửa</button></>}<Link className="button button--secondary button--small" to="/journey?view=setup">Nhìn lại một chặng</Link><Link className="button button--secondary button--small" to="/diary?view=history">Lịch sử nhật ký</Link></div></DiaryPageHeader>
    {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
    {todayEntry && isDiaryFinished(todayEntry.status) && <DiaryMetrics metrics={metrics} />}
    {!todayEntry && <section className="diary-empty-hero"><div className="diary-empty-hero__main"><div className="diary-empty-hero__art" aria-hidden="true"><span className="diary-art__sun" /><span className="diary-art__spark diary-art__spark--one">✦</span><span className="diary-art__spark diary-art__spark--two">✦</span><div className="diary-art__book"><i /><i /><b /></div><span className="diary-art__leaf diary-art__leaf--one" /><span className="diary-art__leaf diary-art__leaf--two" /></div><div><p className="eyebrow">{formatDiaryDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>Hôm nay vẫn còn một khoảng trống.</h2><p>Không cần viết thật hay. Chỉ cần để lại một dấu nhỏ về ngày hôm nay, theo cách vừa đủ với bạn.</p><div className="diary-empty-hero__actions"><button className="button button--primary" type="button" onClick={() => navigate(`/diary?view=editor&date=${today}`)}>✎ Bắt đầu viết</button><Link className="button button--secondary" to="/journey?view=setup">Nhìn lại một chặng</Link></div></div></div><DiaryMetrics metrics={metrics} /></section>}
    {todayEntry?.status === 'draft' && <><DiaryMetrics metrics={metrics} /><section className="diary-today-card"><div className="diary-today-card__intro"><div className="diary-today-card__heading"><div><p className="eyebrow">{formatDiaryDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>Bản nháp của hôm nay</h2></div><DiaryStatusBadge status={todayEntry.status} /></div>{todayEntry.title ? <h3>{todayEntry.title}</h3> : <h3 className="diary-today-card__empty-title">Chưa thêm tiêu đề</h3>}{!isRichTextEmpty(todayEntry.overallText) ? <p className="diary-today-card__excerpt">{richTextToPlainText(todayEntry.overallText).replace(/\s+/g, ' ').trim()}</p> : <p className="diary-today-card__excerpt">Bạn có thể bắt đầu bằng một prompt hoặc vài dòng ngắn.</p>}{todayEntry.promptResponses.length > 0 && <span className="diary-inline-meta">✦ {todayEntry.promptResponses.length} dòng tự sự thêm</span>}{todayEntry.checkinLinks.length > 0 && <span className="diary-inline-meta">↗ {todayEntry.checkinLinks.length} check-in gắn với ngày này</span>}<div className="diary-today-card__actions"><button className="button button--primary" type="button" onClick={() => navigate(`/diary?view=editor&date=${today}`)}>Tiếp tục viết <span aria-hidden="true">→</span></button><button className="button button--secondary" type="button" onClick={() => navigate('/diary?view=history')}>Xem lịch sử</button><button className="button button--danger button--small" type="button" onClick={() => void remove()}>Xóa bản nháp</button></div></div><div className="diary-today-card__preview"><span aria-hidden="true">{todayEntry.dailyEmotionSnapshot?.emoji ?? '✦'}</span><small>{todayEntry.dailyEmotionSnapshot?.emotion_name_vn ?? 'Một ngày đang được lắng nghe'}</small><b>{todayEntry.images.length ? `${todayEntry.images.length} ảnh` : 'Không gian của riêng bạn'}</b></div></section></>}
    {todayEntry && isDiaryFinished(todayEntry.status) && <DiaryReadView entry={todayEntry} onDelete={() => void remove()} />}
    {todayEntry?.status === 'draft' && <p className="diary-draft-note">Bản nháp đã được giữ lại. Bạn có thể hoàn tất bất cứ lúc nào.</p>}
  </section>
}

const localDraftStorageKey = (date: string): string => `sacky:diary:editor-draft:v2:${date}`

const writeEditorCache = (date: string, draft: DiaryDraft, cachedAt = new Date().toISOString()): boolean => {
  try {
    window.localStorage.setItem(localDraftStorageKey(date), JSON.stringify({ version: 1, cachedAt, draft }))
    return true
  } catch {
    return false
  }
}

const readEditorCache = (date: string) => {
  try {
    return parseDiaryEditorCache(JSON.parse(window.localStorage.getItem(localDraftStorageKey(date)) ?? 'null'), date)
  } catch { return null }
}

const PromptSelectionModal = ({ prompts, selectedIds, responses, onApply, onClose }: { prompts: DiaryPrompt[]; selectedIds: string[]; responses: DiaryPromptResponse[]; onApply: (ids: string[]) => void; onClose: () => void }) => {
  const [pendingIds, setPendingIds] = useState(selectedIds)
  const [query, setQuery] = useState('')
  const customCount = responses.filter((response) => response.promptId === null).length
  const selectedCount = customCount + pendingIds.length
  const visiblePrompts = useMemo(() => prompts.filter((prompt) => `${prompt.textVn} ${prompt.textEn ?? ''}`.toLowerCase().includes(query.toLowerCase())), [prompts, query])
  const toggle = (id: string) => {
    if (pendingIds.includes(id)) {
      const response = responses.find((item) => item.promptId === id)
      if (response && !isRichTextEmpty(response.responseText) && !window.confirm('Prompt này đã có nội dung. Bỏ prompt sẽ xóa phần đã viết, bạn có muốn tiếp tục?')) return
      setPendingIds((current) => current.filter((item) => item !== id))
      return
    }
    if (selectedCount < 6) setPendingIds((current) => [...current, id])
  }
  return <div className="diary-modal-backdrop" role="presentation" onClick={onClose}><section className="diary-modal diary-modal--prompt" role="dialog" aria-modal="true" aria-labelledby="prompt-dialog-title" onClick={(event) => event.stopPropagation()}><button className="diary-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><div className="diary-modal__header"><p className="eyebrow">Những dòng tự sự thêm</p><h2 id="prompt-dialog-title">Chọn prompt cho hôm nay</h2><p>Bạn có thể chọn tối đa 6 prompt. Thứ tự bạn chọn sẽ được giữ nguyên trong bài viết.</p><strong>Đã chọn {selectedCount}/6</strong></div><label className="diary-search"><span aria-hidden="true">⌕</span><input aria-label="Tìm prompt" value={query} placeholder="Tìm prompt…" onChange={(event) => setQuery(event.target.value)} /></label><div className="diary-prompt-selection-grid">{visiblePrompts.map((prompt) => { const selected = pendingIds.includes(prompt.id); const disabled = !selected && selectedCount >= 6; return <button key={prompt.id} type="button" className={`diary-prompt-selection ${selected ? 'is-selected' : ''}`} disabled={disabled} onClick={() => toggle(prompt.id)} style={{ '--prompt-color': prompt.hexColor } as React.CSSProperties}><span>{prompt.emoji}</span><div><strong>{prompt.textVn}</strong>{prompt.description && <small>{prompt.description}</small>}</div><i aria-hidden="true">{selected ? '✓' : '+'}</i></button> })}</div>{visiblePrompts.length === 0 && <div className="diary-subtle-empty">Không tìm thấy prompt phù hợp.</div>}<div className="diary-modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>Hủy</button><button className="button button--primary" type="button" onClick={() => onApply(pendingIds)}>Xong</button></div></section></div>
}

const PromptResponseEditor = ({ responses, onChange, onRemove, onMove, onFocus }: { responses: DiaryPromptResponse[]; onChange: (index: number, patch: Partial<DiaryPromptResponse>) => void; onRemove: (index: number) => void; onMove: (index: number, direction: -1 | 1) => void; onFocus: (index: number) => void }) => <div className="diary-response-list">{responses.map((response, index) => <section className={`diary-response-card ${response.isDone ? 'is-done' : ''}`} key={response.promptSnapshot.id} style={{ '--prompt-color': response.promptSnapshot.hexColor } as React.CSSProperties}><div className="diary-response-card__top"><span className="diary-response-card__emoji">{response.promptSnapshot.emoji}</span><div><span className="section-label">Dòng {index + 1}</span><h3>{response.promptSnapshot.textVn}</h3></div><div className="diary-response-card__actions"><button className="diary-prompt-focus-button" type="button" onClick={() => onFocus(index)} aria-label={`Mở Focus cho ${response.promptSnapshot.textVn}`} title="Mở Focus viết">✦ Focus</button><button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Di chuyển lên">↑</button><button type="button" onClick={() => onMove(index, 1)} disabled={index === responses.length - 1} aria-label="Di chuyển xuống">↓</button><button type="button" onClick={() => onRemove(index)} aria-label={`Bỏ prompt ${response.promptSnapshot.textVn}`}>×</button></div></div><RichTextEditor value={response.responseText} onChange={(value) => onChange(index, { responseText: value })} placeholder="Viết vài dòng nếu bạn muốn…" ariaLabel={`Trả lời: ${response.promptSnapshot.textVn}`} minHeight={195} focusMode /><div className="diary-response-card__footer"><span>{richTextToPlainText(response.responseText).length} ký tự</span><button type="button" className={`diary-tick ${response.isDone ? 'is-done' : ''}`} aria-pressed={response.isDone} onClick={() => onChange(index, { isDone: !response.isDone })}>{response.isDone ? '✓ Đã viết xong' : '○ Đánh dấu đã xong'}</button></div></section>)}</div>

const CheckinPickerModal = ({ localDate, records, links, onApply, onClose }: { localDate: string; records: CheckinRecord[]; links: DiaryCheckinLink[]; onApply: (links: DiaryCheckinLink[]) => void; onClose: () => void }) => {
  const [pendingLinks, setPendingLinks] = useState(links)
  const [query, setQuery] = useState('')
  const visibleRecords = useMemo(() => records.filter((record) => `${getCheckinLabel(record).title} ${getCheckinLabel(record).description}`.toLowerCase().includes(query.toLowerCase())), [records, query])
  const toggle = (record: CheckinRecord) => {
    const existing = pendingLinks.find((link) => link.checkinId === record.id)
    setPendingLinks(existing ? pendingLinks.filter((link) => link.checkinId !== record.id) : [...pendingLinks, { checkinId: record.id, weightPercent: 50, position: pendingLinks.length + 1 }])
  }
  const updateWeight = (id: string, value: number) => setPendingLinks(pendingLinks.map((link) => link.checkinId === id ? { ...link, weightPercent: clampDiaryWeight(value) } : link))
  return <div className="diary-modal-backdrop" role="presentation" onClick={onClose}><section className="diary-modal diary-modal--checkin" role="dialog" aria-modal="true" aria-labelledby="checkin-dialog-title" onClick={(event) => event.stopPropagation()}><button className="diary-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><div className="diary-modal__header"><p className="eyebrow">Check-in trong ngày</p><h2 id="checkin-dialog-title">Chọn Check-in cho nhật ký</h2><p>Chỉ hiển thị những Check-in thuộc {isDiaryDateToday(localDate) ? 'hôm nay' : formatDiaryShortDate(localDate)}.</p></div><label className="diary-search"><span aria-hidden="true">⌕</span><input aria-label="Tìm Check-in" value={query} placeholder="Tìm cảm xúc, ghi chú…" onChange={(event) => setQuery(event.target.value)} /></label><div className="diary-checkin-modal-layout"><div><div className="diary-modal-subheading"><span>Danh sách Check-in</span><small>{records.length} Check-in</small></div><div className="diary-checkin-modal-list">{visibleRecords.map((record) => { const link = pendingLinks.find((item) => item.checkinId === record.id); const label = getCheckinLabel(record); const checkinColor = record.primaryEmotion?.color_hex ?? '#7B879D'; return <div key={record.id} className={`diary-checkin-modal-row ${link ? 'is-selected' : ''}`} style={{ '--checkin-color': checkinColor } as React.CSSProperties}><span className="diary-checkin-option__emoji">{label.emoji}</span><span><strong>{label.title}</strong><small>{formatCheckinTime(record)} · {label.description}</small></span><button type="button" onClick={() => toggle(record)}>{link ? '✓ Đã gắn' : '+ Gắn vào nhật ký'}</button>{link && <label className="diary-weight"><span>Mức đại diện</span><input type="range" min="1" max="100" value={link.weightPercent} style={{ '--weight-percent': `${link.weightPercent}%` } as React.CSSProperties} onChange={(event) => updateWeight(record.id, Number(event.target.value))} aria-label={`Mức đại diện cho ${label.title}`} /><b>{link.weightPercent}%</b></label>}</div> })}</div>{records.length === 0 && <div className="diary-subtle-empty">Chưa có Check-in nào cho ngày này. Bạn vẫn có thể viết mà không cần gắn Check-in.</div>}{records.length > 0 && visibleRecords.length === 0 && <div className="diary-subtle-empty">Không tìm thấy Check-in phù hợp.</div>}</div><aside className="diary-checkin-modal-selected"><div className="diary-modal-subheading"><span>Đã chọn ({pendingLinks.length})</span><small>Những mục này sẽ được lưu cùng bài viết</small></div>{pendingLinks.length === 0 ? <p>Chưa có Check-in nào được chọn.</p> : pendingLinks.map((link) => { const record = records.find((item) => item.id === link.checkinId); const label = record ? getCheckinLabel(record) : null; return <div className="diary-checkin-selected-mini" key={link.checkinId}><span>{label?.emoji ?? '◌'}</span><div><strong>{label?.title ?? 'Check-in đã chọn'}</strong><small>{record ? formatCheckinTime(record) : 'Đang tải'}</small></div><button type="button" onClick={() => setPendingLinks(pendingLinks.filter((item) => item.checkinId !== link.checkinId))} aria-label={`Bỏ ${label?.title ?? 'Check-in'}`}>×</button></div> })}</aside></div><div className="diary-modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>Hủy</button><button className="button button--primary" type="button" onClick={() => onApply(pendingLinks.map((link, index) => ({ ...link, position: index + 1 })))}>Áp dụng</button></div></section></div>
}

const CheckinAttachmentPicker = ({ localDate, records, links, onChange }: { localDate: string; records: CheckinRecord[]; links: DiaryCheckinLink[]; onChange: (links: DiaryCheckinLink[]) => void }) => {
  const [showPicker, setShowPicker] = useState(false)
  const updateWeight = (id: string, value: number) => onChange(links.map((link) => link.checkinId === id ? { ...link, weightPercent: clampDiaryWeight(value) } : link))
  const selected = links.map((link) => ({ link, record: records.find((record) => record.id === link.checkinId) })).filter((item): item is { link: DiaryCheckinLink; record: CheckinRecord } => Boolean(item.record))
  return <div className="diary-checkin-picker"><div className="diary-section-header"><div><span className="section-label">Check-in trong ngày <em>tuỳ chọn</em></span><p>Thêm những Check-in thuộc {isDiaryDateToday(localDate) ? 'hôm nay' : formatDiaryShortDate(localDate)} để bức tranh này đầy đủ hơn.</p></div><div className="diary-section-actions"><span className="diary-count-badge">{links.length} đã gắn</span><button className="button button--secondary button--small" type="button" onClick={() => setShowPicker(true)}>＋ Chọn từ Check-in</button></div></div>{selected.length === 0 ? <div className="diary-subtle-empty">Chưa có Check-in nào được chọn. Phần này hoàn toàn tuỳ chọn.</div> : <div className="diary-checkin-selected-list">{selected.map(({ link, record }) => { const label = getCheckinLabel(record); const checkinColor = record.primaryEmotion?.color_hex ?? '#7B879D'; return <article key={link.checkinId} className="diary-checkin-selected-card" style={{ '--checkin-color': checkinColor } as React.CSSProperties}><div className="diary-checkin-selected-card__top"><span className="diary-checkin-option__emoji">{label.emoji}</span><div><strong>{label.title}</strong><small>{formatCheckinTime(record)} · {label.description}</small></div><button type="button" onClick={() => onChange(links.filter((item) => item.checkinId !== link.checkinId))} aria-label={`Bỏ ${label.title}`}>×</button></div><label className="diary-weight"><span>Mức đại diện</span><input type="range" min="1" max="100" value={link.weightPercent} style={{ '--weight-percent': `${link.weightPercent}%` } as React.CSSProperties} onChange={(event) => updateWeight(record.id, Number(event.target.value))} aria-label={`Mức đại diện cho ${label.title}`} /><b>{link.weightPercent}%</b></label></article> })}</div>}<p className="diary-helper">Mỗi mức đại diện là độc lập; không cần cộng thành 100%.</p>{showPicker && <CheckinPickerModal localDate={localDate} records={records} links={links} onApply={(nextLinks) => { onChange(nextLinks); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}</div>
}

const ImageManager = ({ images, pending, onChange, onPendingChange }: { images: DiaryImage[]; pending: PendingDiaryImage[]; onChange: (images: DiaryImage[]) => void; onPendingChange: (images: PendingDiaryImage[]) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'choose' | 'url'>('choose')
  const [targetSlot, setTargetSlot] = useState(1)
  const [url, setUrl] = useState('')
  const [localError, setLocalError] = useState('')
  const slots = Array.from({ length: 4 }, (_, index) => {
    const position = index + 1
    return { position, pending: pending.find((item) => item.slotOrder === position), image: images.find((item) => item.position === position) }
  })
  const filledSlotCount = slots.filter((slot) => Boolean(slot.image || slot.pending)).length
  const openPicker = (position: number) => { setTargetSlot(position); setPickerMode('choose'); setUrl(''); setLocalError(''); setShowPicker(true) }
  const replaceAtSlot = (position: number, next: PendingDiaryImage) => {
    const existing = pending.find((item) => item.slotOrder === position)
    if (existing?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(existing.previewUrl)
    onPendingChange([...pending.filter((item) => item.slotOrder !== position), next].sort((left, right) => left.slotOrder - right.slotOrder))
  }
  const removeAtSlot = (position: number) => {
    const pendingImage = pending.find((item) => item.slotOrder === position)
    if (pendingImage?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(pendingImage.previewUrl)
    onPendingChange(pending.filter((item) => item.slotOrder !== position))
    onChange(images.filter((item) => item.position !== position).map((item, index) => ({ ...item, position: index + 1 })))
  }
  const handleFile = (file: File | undefined) => {
    if (!file) return
    try {
      validateLocalDiaryImage(file)
      const existing = slots[targetSlot - 1].pending ?? slots[targetSlot - 1].image
      replaceAtSlot(targetSlot, { id: `pending-${Date.now()}-${targetSlot}`, slotOrder: targetSlot, previewUrl: URL.createObjectURL(file), file, caption: existing?.caption ?? '', status: 'selected' })
      setShowPicker(false)
    } catch (reason: unknown) {
      setLocalError(reason instanceof Error ? reason.message : 'Không thể chọn ảnh.')
    }
  }
  const addUrl = () => {
    const value = url.trim()
    try {
      const parsed = new URL(value)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Chỉ hỗ trợ liên kết HTTP hoặc HTTPS.')
      const existing = slots[targetSlot - 1].pending ?? slots[targetSlot - 1].image
      replaceAtSlot(targetSlot, { id: `pending-${Date.now()}-${targetSlot}`, slotOrder: targetSlot, previewUrl: value, sourceUrl: value, caption: existing?.caption ?? '', status: 'selected' })
      setShowPicker(false)
    } catch (reason: unknown) {
      setLocalError(reason instanceof Error ? reason.message : 'Liên kết ảnh không hợp lệ.')
    }
  }
  const updateCaption = (position: number, value: string) => {
    const pendingImage = pending.find((item) => item.slotOrder === position)
    if (pendingImage) onPendingChange(pending.map((item) => item.slotOrder === position ? { ...item, caption: value } : item))
    else onChange(images.map((image) => image.position === position ? { ...image, caption: value } : image))
  }
  const move = (position: number, direction: -1 | 1) => {
    const nextPosition = position + direction
    if (nextPosition < 1 || nextPosition > 4) return
    const nextSlots = slots.map((slot) => slot.pending ? { kind: 'pending' as const, item: slot.pending } : slot.image ? { kind: 'saved' as const, item: slot.image } : null)
    ;[nextSlots[position - 1], nextSlots[nextPosition - 1]] = [nextSlots[nextPosition - 1], nextSlots[position - 1]]
    onChange(nextSlots.flatMap((slot, index) => slot?.kind === 'saved' ? [{ ...slot.item, position: index + 1 }] : []))
    onPendingChange(nextSlots.flatMap((slot, index) => slot?.kind === 'pending' ? [{ ...slot.item, slotOrder: index + 1 }] : []))
  }
  return <div className="diary-image-manager">
    <div className="diary-section-header"><div><span className="section-label">Hình ảnh trong ngày <em>tuỳ chọn</em></span><p>Thêm tối đa 4 ảnh để giữ lại những chi tiết bạn muốn nhớ.</p></div><div className="diary-section-actions"><span className="diary-count-badge">{filledSlotCount}/4</span><button className="button button--secondary button--small" type="button" disabled={filledSlotCount >= 4} onClick={() => openPicker((slots.find((slot) => !slot.image && !slot.pending)?.position) ?? 1)}>＋ Thêm ảnh</button></div></div>
    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { handleFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <div className="diary-image-grid">{slots.map(({ position, image, pending: pendingImage }) => {
      if (!image && !pendingImage) return <button className="diary-image-card diary-image-card--empty" key={`empty-${position}`} type="button" onClick={() => openPicker(position)}><span>＋</span><strong>Thêm ảnh</strong><small>Vị trí {position}</small></button>
      const previewUrl = pendingImage?.previewUrl ?? image?.externalUrl ?? ''
      const caption = pendingImage?.caption ?? image?.caption ?? ''
      const statusLabel = pendingImage?.status === 'compressing' ? 'Đang nén…' : pendingImage?.status === 'uploading' ? 'Đang tải…' : pendingImage?.status === 'saving' ? 'Đang hoàn tất…' : pendingImage?.status === 'error' ? pendingImage.error ?? 'Tải ảnh lỗi' : pendingImage ? 'Đã chọn · sẽ lưu khi bấm Lưu' : ''
      return <figure className={`diary-image-card ${pendingImage ? 'is-pending' : ''}`} key={pendingImage?.id ?? image?.id}><div className="diary-image-card__media"><img src={previewUrl} alt={caption || `Ảnh ${position}`} loading="lazy" /><span>{position}</span>{pendingImage && <div className="diary-image-card__status" role="status">{statusLabel}</div>}<div className="diary-image-card__hover-actions"><button type="button" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')} disabled={!previewUrl}>Xem</button><button type="button" onClick={() => openPicker(position)}>Thay ảnh</button><button type="button" onClick={() => removeAtSlot(position)} className="is-danger">Xóa</button></div></div><input value={caption} maxLength={120} onChange={(event) => updateCaption(position, event.target.value)} placeholder="Chú thích (tuỳ chọn)…" aria-label={`Chú thích ảnh ${position}`} /><figcaption><button type="button" onClick={() => move(position, -1)} disabled={position === 1} aria-label="Di chuyển ảnh sang trái">←</button><button type="button" onClick={() => move(position, 1)} disabled={position === 4} aria-label="Di chuyển ảnh sang phải">→</button></figcaption></figure>
    })}</div>
    {filledSlotCount === 4 && <div className="diary-image-limit">✓ Đã đủ 4 vị trí ảnh cho ngày này</div>}
    <p className="diary-helper">Ảnh sẽ được tối ưu trước khi lưu và vẫn hiển thị trong Diary sau khi tải lại.</p>
    {showPicker && <div className="diary-modal-backdrop" role="presentation" onClick={() => setShowPicker(false)}><section className="diary-modal diary-modal--image" role="dialog" aria-modal="true" aria-labelledby="diary-image-picker-title" onClick={(event) => event.stopPropagation()}><button className="diary-modal__close" type="button" onClick={() => setShowPicker(false)} aria-label="Đóng">×</button><div className="diary-modal__header"><p className="eyebrow">Hình ảnh trong ngày</p><h2 id="diary-image-picker-title">Thêm hình ảnh</h2><p>Chọn ảnh từ máy hoặc thêm bằng một liên kết công khai.</p></div>{pickerMode === 'choose' ? <div className="diary-image-picker-options"><button className="diary-image-picker-option" type="button" onClick={() => fileInputRef.current?.click()}><strong>↑ Tải ảnh từ máy</strong><small>JPEG, PNG hoặc WebP · tối đa 15MB</small></button><span>hoặc</span><button className="diary-image-picker-option" type="button" onClick={() => { setPickerMode('url'); setLocalError('') }}><strong>🔗 Thêm bằng liên kết</strong><small>Ảnh sẽ được lưu thành bản sao trong Diary</small></button></div> : <div className="diary-image-url-picker"><label htmlFor="diary-image-url">Liên kết ảnh</label><input id="diary-image-url" value={url} onChange={(event) => { setUrl(event.target.value); setLocalError('') }} placeholder="https://…" autoFocus />{url.trim() && <img src={url.trim()} alt="Xem trước ảnh" onError={() => setLocalError('Không thể xem trước liên kết này.')} />}{localError && <p className="form-error" role="alert">{localError}</p>}<div className="diary-modal__footer"><button className="button button--secondary" type="button" onClick={() => setPickerMode('choose')}>Quay lại</button><button className="button button--primary" type="button" disabled={!url.trim()} onClick={addUrl}>Thêm</button></div></div>}{pickerMode === 'choose' && localError && <p className="form-error" role="alert">{localError}</p>}</section></div>}
  </div>
}

const FocusWritingLayer = ({ title, date, value, onChange, saveNotice, isSaving, onExit, eyebrow = 'Focus writing', placeholder = 'Bắt đầu viết điều đang ở cùng bạn…', ariaLabel = 'Vùng viết Focus' }: { title: string; date: string; value: string; onChange: (value: string) => void; saveNotice: string; isSaving: boolean; onExit: () => void; eyebrow?: string; placeholder?: string; ariaLabel?: string }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onExit])

  return <div className="diary-focus-layer" role="dialog" aria-modal="true" aria-labelledby="diary-focus-title">
    <header className="diary-focus-header"><div className="diary-focus-header__copy"><span className="eyebrow">{eyebrow}</span><h2 id="diary-focus-title">{title}</h2><p>{formatDiaryDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div className="diary-focus-header__actions"><span className="diary-focus-save-status" role="status"><i aria-hidden="true">●</i>{isSaving ? 'Đang lưu…' : saveNotice || 'Đã lưu'}</span><button className="button button--secondary" type="button" onClick={onExit}>Thoát Focus <span aria-hidden="true">Esc</span></button></div></header>
    <main className="diary-focus-canvas"><RichTextEditor value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} minHeight={460} className="diary-focus-editor" autoFocus focusMode /></main>
  </div>
}

export function DiaryEditorPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const localDate = searchParams.get('date') || getDiaryLocalDate()
  const [draft, setDraft] = useState<DiaryDraft>(() => emptyDiaryDraft(localDate))
  const [prompts, setPrompts] = useState<DiaryPrompt[]>([])
  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState('')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [focusPromptIndex, setFocusPromptIndex] = useState<number | null>(null)
  const [showPromptSelection, setShowPromptSelection] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingDiaryImage[]>([])
  const { reference } = useReferenceData()
  const latestDraftRef = useRef(draft)
  const hasLoadedDraftRef = useRef(false)
  const lastAutosavedSignatureRef = useRef<string | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const autosaveRevisionRef = useRef(0)
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const editorIsLoading = isLoading || loadedDate !== localDate

  useLayoutEffect(() => {
    latestDraftRef.current = draft
  }, [draft])

  useEffect(() => {
    let isMounted = true
    lastAutosavedSignatureRef.current = null
    void Promise.all([getDiaryEntry(localDate), listDiaryPrompts()]).then(([entry, nextPrompts]) => {
      const cached = readEditorCache(localDate)
      let nextDraft: DiaryDraft = entry ? { ...entry, id: entry.id, userId: entry.userId } : emptyDiaryDraft(localDate)
      const shouldUseCachedDraft = Boolean(cached && (!entry || !entry.updatedAt || Date.parse(cached.cachedAt) > Date.parse(entry.updatedAt)))
      if (shouldUseCachedDraft && cached) nextDraft = cached.draft
      if (isMounted) {
        const loadedDraft = { ...nextDraft, promptResponses: shouldUseCachedDraft ? nextDraft.promptResponses : getPromptResponses(entry, nextPrompts) }
        latestDraftRef.current = loadedDraft
        lastAutosavedSignatureRef.current = getDiaryDraftSignature(loadedDraft)
        setDraft(loadedDraft)
        setPendingImages([])
        setPrompts(nextPrompts)
        setLoadedDate(localDate)
        setIsLoading(false)
      }
    }).catch((reason: unknown) => { if (isMounted) { setError(reason instanceof Error ? reason.message : 'Không thể mở trình biên tập.'); setLoadedDate(localDate); setIsLoading(false) } })
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
    if (!editorIsLoading) hasLoadedDraftRef.current = true
  }, [editorIsLoading])

  useEffect(() => {
    if (editorIsLoading) return
    const timer = window.setTimeout(() => {
      if (writeEditorCache(localDate, draft)) setSaveNotice('Đã lưu an toàn trên thiết bị')
      else setSaveNotice('')
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft, editorIsLoading, localDate])

  useEffect(() => {
    if (editorIsLoading || lastAutosavedSignatureRef.current === null) return
    const signature = getDiaryDraftSignature(draft)
    if (signature === lastAutosavedSignatureRef.current || !hasDiaryDraftContent(draft)) return

    autosaveRevisionRef.current += 1
    const revision = autosaveRevisionRef.current
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null
      if (revision !== autosaveRevisionRef.current) return
      const snapshot = latestDraftRef.current
      const snapshotSignature = getDiaryDraftSignature(snapshot)
      if (snapshotSignature === lastAutosavedSignatureRef.current || !hasDiaryDraftContent(snapshot)) return
      autosaveQueueRef.current = autosaveQueueRef.current.then(async () => {
        if (revision !== autosaveRevisionRef.current) return
        const saved = await saveDiary({ ...snapshot, status: isDiaryFinished(snapshot.status) ? 'done' : 'draft' })
        lastAutosavedSignatureRef.current = snapshotSignature
        const current = latestDraftRef.current
        const currentSignature = getDiaryDraftSignature(current)
        const nextDraft = currentSignature === snapshotSignature
          ? { ...saved }
          : { ...current, id: saved.id, userId: saved.userId, createdAt: saved.createdAt, updatedAt: saved.updatedAt, completedAt: saved.completedAt }
        latestDraftRef.current = nextDraft
        setDraft(nextDraft)
        writeEditorCache(localDate, nextDraft)
        if (currentSignature === snapshotSignature) setSaveNotice('Đã tự động lưu')
      }).catch((reason: unknown) => {
        if (revision === autosaveRevisionRef.current) {
          setSaveNotice('Chưa đồng bộ')
          setError(reason instanceof Error ? reason.message : 'Không thể tự động lưu nhật ký.')
        }
      })
    }, 900)
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [draft, editorIsLoading, localDate])

  useEffect(() => () => {
    if (hasLoadedDraftRef.current) writeEditorCache(localDate, latestDraftRef.current)
  }, [localDate])

  const updateDraft = (patch: Partial<DiaryDraft>) => {
    const nextDraft = { ...latestDraftRef.current, ...patch }
    latestDraftRef.current = nextDraft
    setDraft(nextDraft)
    setError(null)
    setSaveNotice('Đang lưu…')
  }
  const emotions = reference?.emotions ?? []
  const selectedIds = draft.promptResponses.map((response) => response.promptId).filter((id): id is string => Boolean(id))
  const applyPromptSelection = (ids: string[]) => {
    const existing = new Map(draft.promptResponses.filter((response) => response.promptId).map((response) => [response.promptId as string, response]))
    const customResponses = draft.promptResponses.filter((response) => response.promptId === null)
    const canonicalResponses = ids.flatMap((id) => {
      const response = existing.get(id)
      if (response) return [response]
      const prompt = prompts.find((item) => item.id === id)
      return prompt ? [{ promptId: id, promptSnapshot: prompt, position: 0, responseText: '', isDone: false }] : []
    })
    updateDraft({ promptResponses: [...customResponses, ...canonicalResponses].map((response, index) => ({ ...response, position: index + 1 })) })
    setShowPromptSelection(false)
  }
  const updateResponse = (index: number, patch: Partial<DiaryPromptResponse>) => updateDraft({ promptResponses: draft.promptResponses.map((response, responseIndex) => responseIndex === index ? { ...response, ...patch } : response) })
  const removeResponse = (index: number) => { const response = draft.promptResponses[index]; if (response && !isRichTextEmpty(response.responseText) && !window.confirm('Prompt này đã có nội dung. Bỏ prompt sẽ xóa phần đã viết, bạn có muốn tiếp tục?')) return; updateDraft({ promptResponses: draft.promptResponses.filter((_, responseIndex) => responseIndex !== index).map((item, position) => ({ ...item, position: position + 1 })) }) }
  const moveResponse = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= draft.promptResponses.length) return; const next = [...draft.promptResponses]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; updateDraft({ promptResponses: next.map((item, position) => ({ ...item, position: position + 1 })) }) }
  const selectEmotion = (emotion: Emotion | null) => updateDraft({ dailyEmotionId: emotion?.emotion_id ?? null, dailyEmotionSnapshot: emotion ? { emotion_id: emotion.emotion_id, emotion_name_vn: emotion.emotion_name_vn, emotion_name_en: emotion.emotion_name_en, emoji: emotion.emoji, color_hex: emotion.color_hex, description_vn: emotion.description_vn } : null })
  const persist = async (target: 'draft' | 'done') => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    autosaveRevisionRef.current += 1
    setIsSaving(true); setError(null)
    let shell: DiaryEntry | null = null
    const uploadedPendingIds = new Set<string>()
    try {
      await autosaveQueueRef.current
      const currentDraft = latestDraftRef.current
      const hasPendingImages = pendingImages.length > 0
      shell = await saveDiary({ ...currentDraft, status: hasPendingImages ? 'draft' : target === 'done' ? 'done' : isDiaryFinished(currentDraft.status) ? currentDraft.status : 'draft' }, target === 'done' ? { completionSource: 'user' } : {})
      let saved = shell
      if (hasPendingImages) {
        latestDraftRef.current = { ...shell }
        setDraft({ ...shell })
        for (const pendingImage of [...pendingImages].sort((left, right) => left.slotOrder - right.slotOrder)) {
          setPendingImages((current) => current.map((item) => item.id === pendingImage.id ? { ...item, status: 'compressing', error: undefined } : item))
          try {
            const uploaded = await uploadDiaryMedia({ diaryId: shell.id, slotOrder: pendingImage.slotOrder, file: pendingImage.file, sourceUrl: pendingImage.sourceUrl, caption: pendingImage.caption, onStatus: (status) => setPendingImages((current) => current.map((item) => item.id === pendingImage.id ? { ...item, status } : item)) })
            uploadedPendingIds.add(pendingImage.id)
            saved = { ...saved, images: [...saved.images.filter((image) => image.position !== uploaded.position), uploaded].sort((left, right) => left.position - right.position) }
            latestDraftRef.current = { ...latestDraftRef.current, images: saved.images }
            setDraft(latestDraftRef.current)
            setPendingImages((current) => current.map((item) => item.id === pendingImage.id ? { ...item, status: 'uploading', error: undefined } : item))
          } catch (reason: unknown) {
            const message = reason instanceof Error ? reason.message : 'Không thể tải ảnh lên.'
            setPendingImages((current) => current.map((item) => item.id === pendingImage.id ? { ...item, status: 'error', error: message } : item))
            throw new Error(message)
          }
        }
        const finalImages = saved.images
        setPendingImages((current) => current.map((item) => uploadedPendingIds.has(item.id) ? { ...item, status: 'saving', error: undefined } : item))
        saved = await saveDiary({ ...saved, status: target === 'done' ? 'done' : isDiaryFinished(shell.status) ? shell.status : 'draft', images: finalImages }, { skipMediaSync: true, ...(target === 'done' ? { completionSource: 'user' as const } : {}) })
        pendingImages.forEach((item) => { if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl) })
        setPendingImages([])
      }
      lastAutosavedSignatureRef.current = getDiaryDraftSignature(saved)
      if (target === 'done') window.localStorage.removeItem(localDraftStorageKey(localDate))
      else writeEditorCache(localDate, saved)
      if (target === 'done') navigate('/diary')
      else {
        latestDraftRef.current = { ...saved }
        setDraft(latestDraftRef.current)
        setSaveNotice('Đã lưu bản nháp')
        navigate(`/diary?view=editor&date=${localDate}`, { replace: true })
      }
    } catch (reason: unknown) {
      const uploadedPending = pendingImages.filter((item) => uploadedPendingIds.has(item.id))
      uploadedPending.forEach((item) => { if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl) })
      if (uploadedPendingIds.size) setPendingImages((current) => current.filter((item) => !uploadedPendingIds.has(item.id)))
      setError(reason instanceof Error ? reason.message : 'Không thể lưu nhật ký.')
    } finally { setIsSaving(false) }
  }

  if (editorIsLoading) return <section className="diary-page"><DiaryState>Đang chuẩn bị trang viết…</DiaryState></section>
  if (error && !draft.localDate) return <section className="diary-page"><DiaryState error={error}> </DiaryState></section>
  const previewEntry = mapDraftToEntry(draft)
  const isBackfill = !isDiaryDateToday(localDate)
  const focusedPrompt = focusPromptIndex === null ? null : draft.promptResponses[focusPromptIndex] ?? null
  return <section className="diary-page diary-page--editor" aria-labelledby="diary-editor-title">
    <div className="diary-editor-heading"><div><Link className="diary-back-link" to={isBackfill ? '/diary?view=history' : '/diary'}>← Quay lại</Link><p className="eyebrow">{isBackfill ? 'Viết bù' : 'Diary hôm nay'}</p><h1 id="diary-editor-title">{isBackfill ? 'Giữ lại một ngày đã qua' : 'Viết nhật ký'}</h1><p className="diary-date-context">{formatDiaryDate(localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{isBackfill && ' · Bạn đang viết cho ngày này'}</p></div><div className="diary-editor-actions"><span className="diary-autosave" role="status"><i aria-hidden="true">●</i>{saveNotice || 'Bản nháp tự động'}</span><button className="button button--secondary" type="button" onClick={() => setIsFocusMode(true)}>Focus</button><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void persist('draft')}>{isDiaryFinished(draft.status) ? 'Lưu thay đổi' : 'Lưu nháp'}</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void persist('done')}>✓ {isSaving ? 'Đang lưu…' : 'Hoàn tất'}</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="diary-editor-layout"><main className="diary-editor-main"><section className="diary-editor-card diary-editor-card--writing"><div className="diary-field"><label htmlFor="diary-title">Tiêu đề <em>tuỳ chọn</em></label><input id="diary-title" maxLength={120} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Một tiêu đề để nhớ về ngày hôm nay…" /><small>{draft.title.length}/120</small></div><div className="diary-field"><label>Tổng quan <em>tuỳ chọn</em></label>{isFocusMode ? <button className="diary-focus-inline-entry" type="button" onClick={() => setIsFocusMode(true)}>Focus mode đang mở ở phía trước</button> : <RichTextEditor value={draft.overallText} onChange={(value) => updateDraft({ overallText: value })} placeholder="Hôm nay của bạn như thế nào? Điều gì đã xảy ra, bạn đã nghĩ gì, cảm nhận gì?" ariaLabel="Tổng quan nhật ký" minHeight={380} focusMode />}<small>{richTextWordCount(draft.overallText)} từ</small></div></section><DayRecordContextCard localDate={localDate} entry={draft.id ? previewEntry : null} compact /><section className="diary-editor-card"><div className="diary-section-header"><div><span className="section-label">Những dòng tự sự thêm</span><p>Chọn prompt nếu bạn muốn nhìn ngày hôm nay từ một góc khác.</p></div><button className="button button--secondary button--small" type="button" onClick={() => setShowPromptSelection(true)}>＋ {draft.promptResponses.length ? 'Thêm / sửa prompt' : 'Chọn prompt'}</button></div>{draft.promptResponses.length === 0 ? <div className="diary-subtle-empty diary-subtle-empty--prompt">Chưa có prompt nào được chọn. Phần này hoàn toàn tuỳ chọn.</div> : <PromptResponseEditor responses={draft.promptResponses} onChange={updateResponse} onRemove={removeResponse} onMove={moveResponse} onFocus={setFocusPromptIndex} />}</section><section className="diary-editor-card"><EmotionPicker selected={draft.dailyEmotionId} emotions={emotions} onSelect={selectEmotion} /></section><section className="diary-editor-card"><CheckinAttachmentPicker localDate={localDate} records={records} links={draft.checkinLinks} onChange={(links) => updateDraft({ checkinLinks: links })} /></section><section className="diary-editor-card"><ImageManager images={draft.images} pending={pendingImages} onChange={(images) => updateDraft({ images })} onPendingChange={setPendingImages} /></section><div className="diary-editor-footer"><Link className="button button--secondary" to={isBackfill ? '/diary?view=history' : '/diary'}>← Quay lại</Link><div><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void persist('draft')}>{isDiaryFinished(draft.status) ? 'Lưu thay đổi' : 'Lưu nháp'}</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void persist('done')}>✓ Hoàn tất nhật ký</button></div></div></main><DiarySummary entry={previewEntry} checkins={records} /></div>
    {showPromptSelection && <PromptSelectionModal prompts={prompts} selectedIds={selectedIds} responses={draft.promptResponses} onApply={applyPromptSelection} onClose={() => setShowPromptSelection(false)} />}
    {isFocusMode && <FocusWritingLayer title={draft.title || 'Viết nhật ký'} date={localDate} value={draft.overallText} onChange={(value) => updateDraft({ overallText: value })} saveNotice={saveNotice} isSaving={isSaving} onExit={() => setIsFocusMode(false)} />}
    {focusedPrompt && focusPromptIndex !== null && <FocusWritingLayer title={focusedPrompt.promptSnapshot.textVn} eyebrow="Mảnh tự sự" date={localDate} value={focusedPrompt.responseText} onChange={(value) => updateResponse(focusPromptIndex, { responseText: value })} placeholder="Viết điều prompt này đang gợi lên…" ariaLabel={`Vùng viết: ${focusedPrompt.promptSnapshot.textVn}`} saveNotice={saveNotice} isSaving={isSaving} onExit={() => setFocusPromptIndex(null)} />}
  </section>
}

const DiaryReadPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const localDate = searchParams.get('date') ?? getDiaryLocalDate()
  const [entry, setEntry] = useState<DiaryEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    void getDiaryEntry(localDate).then((next) => { if (mounted) { setEntry(next); setError(null) } }).catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không thể mở nhật ký.') }).finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [localDate])
  if (isLoading) return <section className="diary-page diary-page--read"><DiaryState>Đang mở nhật ký…</DiaryState></section>
  if (error) return <section className="diary-page diary-page--read"><DiaryState error={error}> </DiaryState></section>
  if (!entry) return <section className="diary-page diary-page--read"><DiaryState>Chưa có Nhật ký ngày cho ngày này.</DiaryState><Link className="button button--secondary" to={`/diary?view=editor&date=${localDate}`}>Viết nhật ký</Link></section>
  return <section className="diary-page diary-page--read" aria-labelledby="diary-read-title"><div className="diary-editor-heading"><div><Link className="diary-back-link" to="/diary?view=history">← Quay lại lịch sử</Link><p className="eyebrow">Daily Diary</p><h1 id="diary-read-title">{formatDiaryDate(entry.localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h1></div><button className="button button--secondary" type="button" onClick={() => navigate(`/diary?view=editor&date=${entry.localDate}`)}>✎ Chỉnh sửa</button></div><DiaryReadView entry={entry} onEdit={() => navigate(`/diary?view=editor&date=${entry.localDate}`)} onDelete={() => navigate('/diary?view=history')} /></section>
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
  return <section className="diary-calendar"><div className="diary-calendar__header"><div><span className="section-label">Lịch viết</span><h2>{formatDiaryMonth(new Date(`${month}-01T12:00:00+07:00`))}</h2></div><div><button type="button" onClick={() => onMoveMonth(-1)} aria-label="Tháng trước">‹</button><button type="button" onClick={() => onMoveMonth(1)} aria-label="Tháng sau">›</button></div></div><div className="diary-weekdays">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}</div><div className="diary-calendar__grid">{days.map((date) => { const entry = byDate.get(date); const inMonth = date.startsWith(month); return <button key={date} type="button" className={`diary-calendar-day ${inMonth ? '' : 'is-outside'} ${selectedDate === date ? 'is-selected' : ''} ${entry ? statusClass(entry.status) : ''}`} onClick={() => onSelect(date)}><span>{Number(date.slice(8, 10))}</span>{entry && <i aria-label={statusLabel(entry.status)} />}</button> })}</div><div className="diary-calendar__legend"><span><i className="is-done" /> Đã hoàn tất</span><span><i className="is-draft" /> Bản nháp</span></div></section>
}

const HistoryDetail = ({ date, entry, onEdit, onDelete }: { date: string; entry: DiaryEntry | null; onEdit: () => void; onDelete: () => void }) => {
  if (!entry) return <section className="diary-history-detail diary-history-detail--missing"><div className="diary-empty-hero__art" aria-hidden="true"><span>✦</span><i>◌</i></div><p className="eyebrow">{formatDiaryDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>Chưa viết ngày này</h2><p>Mỗi ngày là một cơ hội để nhìn lại. Bạn có thể viết bù mà không cần quay về hôm nay.</p><button className="button button--primary" type="button" onClick={onEdit}>✎ Viết bù</button></section>
  return <DiaryReadView entry={entry} onEdit={onEdit} onDelete={onDelete} emotionSize="small" historyDetail />
}

export function DiaryHistoryPage() {
  const navigate = useNavigate()
  const { entries, isLoading, error, refresh } = useDiaryEntries()
  const today = getDiaryLocalDate()
  const [month, setMonth] = useState(monthDateKey(new Date()).slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
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
    <DiaryPageHeader title="Lịch sử nhật ký" description="Nhìn lại những điều bạn đã viết cho từng ngày."><div className="diary-header-actions"><Link className="button button--secondary button--small" to="/journey?view=setup">Nhìn lại một chặng</Link><Link className="button button--primary button--small" to="/diary">Viết nhật ký hôm nay</Link></div></DiaryPageHeader>
    <div className="diary-history-layout"><div className="diary-history-calendar-column"><DiaryCalendar month={month} entries={entries} selectedDate={selectedDate} onSelect={setSelectedDate} onMoveMonth={changeMonth} /></div><HistoryDetail date={selectedDate} entry={selectedEntry} onEdit={() => navigate(`/diary?view=editor&date=${selectedDate}`)} onDelete={() => void deleteSelected()} /></div>
  </section>
}

export function DiaryPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const mode = getMode(searchParams)
  // A direct /diary route must always land in the Today state; query params only extend it.
  if (location.pathname !== '/diary') return <DiaryTodayPage />
  if (mode === 'day-record') return <DayRecordPage />
  if (mode === 'journey-setup' || mode === 'journey-editor' || mode === 'journey-read') return <JourneyPage />
  if (mode === 'editor') return <DiaryEditorPage />
  if (mode === 'read') return <DiaryReadPage />
  if (mode === 'history') return <DiaryHistoryPage />
  return <DiaryTodayPage />
}
