import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getDiaryEntry } from '../services/diaryRepository'
import { applyDayRecordSnapshots, isDayRecordLocked, listDayRecordSnapshots, loadLiveDayRecord, saveDayRecordSnapshots } from '../services/dayRecord'
import type { DayRecord, DayRecordFact, DayRecordItem, DayRecordSnapshot, DiaryEntry } from '../types'
import { DIARY_TIME_ZONE, formatDiaryDate } from '../utils'
import { isRichTextEmpty, RichTextRenderer } from '../../../components/richText'

type DayRecordFilter = 'all' | 'checkin' | 'action'

const formatTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: DIARY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

const toFact = ({ key: _key, changedAfterLock: _changedAfterLock, sourceMissing: _sourceMissing, snapshot: _snapshot, ...fact }: DayRecordItem): DayRecordFact => fact

const toSnapshots = (diaryId: string, facts: readonly DayRecordFact[], lockedAt: string): DayRecordSnapshot[] => facts.map((fact) => ({
  diaryId,
  sourceType: fact.kind,
  sourceId: fact.sourceId,
  occurredAt: fact.occurredAt,
  payload: fact,
  lockedAt,
}))

const useDayRecord = (localDate: string, entry: DiaryEntry | null) => {
  const [record, setRecord] = useState<DayRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const capturedLockedAtRef = useRef<string | null>(null)
  const entryId = entry?.id ?? null

  const refresh = useCallback(async () => {
    try {
      const live = await loadLiveDayRecord(localDate)
      let snapshots = entryId ? await listDayRecordSnapshots(entryId) : []
      let lockedAt = capturedLockedAtRef.current ?? snapshots[0]?.lockedAt ?? null
      if (entryId && isDayRecordLocked(localDate) && !lockedAt) {
        const nextLockedAt = new Date().toISOString()
        const facts = live.items.map(toFact)
        await saveDayRecordSnapshots(entryId, facts, nextLockedAt)
        lockedAt = nextLockedAt
        capturedLockedAtRef.current = nextLockedAt
        snapshots = toSnapshots(entryId, facts, nextLockedAt)
      }
      setRecord(applyDayRecordSnapshots(live, snapshots, lockedAt))
      setError(null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải Day Record.')
    } finally {
      setIsLoading(false)
    }
  }, [entryId, localDate])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 30_000)
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  return { record, isLoading, error, refresh }
}

const DayRecordMeta = ({ record }: { record: DayRecord }) => <span className={`day-record-state day-record-state--${record.state}`}><i aria-hidden="true">{record.state === 'live' ? '●' : '✓'}</i>{record.state === 'live' ? 'Ngày vẫn đang được ghi nhận' : 'Ngày đã khép lại'}</span>

export function DayRecordContextCard({ localDate, entry, compact = false }: { localDate: string; entry: DiaryEntry | null; compact?: boolean }) {
  const { record, isLoading } = useDayRecord(localDate, entry)
  const state = record?.state ?? (isDayRecordLocked(localDate) ? 'locked' : 'live')
  const summary = isLoading ? 'Đang nhìn lại ngày này…' : `${record?.checkinCount ?? 0} Check-in · ${record?.completedActionCount ?? 0} việc đã làm`
  return <section className={`day-record-context ${compact ? 'day-record-context--compact' : ''}`} aria-label="Ngày này đã diễn ra">
    <div className="day-record-context__mark" aria-hidden="true">◷</div>
    <div className="day-record-context__copy"><span className="section-label">Ngày này đã diễn ra</span><strong>{summary}</strong><span className={`day-record-state day-record-state--${state}`}><i aria-hidden="true">{state === 'live' ? '●' : '✓'}</i>{state === 'live' ? 'Ngày vẫn đang được ghi nhận' : 'Ngày đã khép lại'}</span></div>
    <Link className="day-record-context__link" to={`/diary?view=day-record&date=${localDate}`}>Xem chi tiết <span aria-hidden="true">→</span></Link>
  </section>
}

const DayRecordRichText = ({ value, className = '' }: { value: string | null | undefined; className?: string }) => {
  if (isRichTextEmpty(value)) return null
  return <RichTextRenderer value={value} className={`day-record-rich-text ${className}`.trim()} />
}

const FactDetails = ({ item, historical = false }: { item: DayRecordFact; historical?: boolean }) => {
  return <div className="day-record-fact-details">
    <p>{historical ? 'Khi ngày kết thúc' : 'Hiện tại'}</p>
    <strong>{item.title}</strong>
    <DayRecordRichText value={item.description} />
    {item.intensity && <small>Cường độ {item.intensity}/5</small>}
    {item.secondaryEmotions?.length ? <small>Cảm xúc phụ: {item.secondaryEmotions.join(' · ')}</small> : null}
    {item.unknownPrompt && <small>Prompt: {item.unknownPrompt}</small>}
    {item.sourceLabel && <small>{item.sourceLabel}</small>}
    {item.reflectionLabel && <div className="day-record-fact-details__reflection"><small>Reflection: {item.reflectionLabel}</small><DayRecordRichText value={item.reflectionNote} /></div>}
  </div>
}

const DayRecordTimelineItem = ({ item }: { item: DayRecordItem }) => {
  const [expanded, setExpanded] = useState(false)
  const typeLabel = item.kind === 'checkin' ? 'Check-in' : 'Việc nhỏ'
  return <article className={`day-record-item day-record-item--${item.kind}`} style={{ '--record-color': item.color } as CSSProperties}>
    <time>{formatTime(item.occurredAt)}</time>
    <span className="day-record-item__rail" aria-hidden="true" />
    <div className="day-record-item__body"><div className="day-record-item__heading"><span className="day-record-item__emoji" aria-hidden="true">{item.emoji}</span><div><span className="day-record-item__type">{typeLabel}</span><h2>{item.kind === 'checkin' ? item.title.replace('Check-in · ', '') : item.title}</h2>{item.titleEn && <small>{item.titleEn}</small>}</div></div>
      <DayRecordRichText value={item.description} />
      {item.intensity && <span className="day-record-chip">Cường độ {item.intensity}/5</span>}
      {item.secondaryEmotions?.length ? <span className="day-record-chip">Cảm xúc phụ: {item.secondaryEmotions.join(' · ')}</span> : null}
      {item.unknownPrompt && <span className="day-record-chip">{item.unknownPrompt}</span>}
      {item.sourceLabel && <span className="day-record-source">{item.sourceLabel}</span>}
      {item.reflectionLabel && <div className="day-record-reflection"><span>Reflection</span><strong>{item.reflectionLabel}</strong><DayRecordRichText value={item.reflectionNote} /></div>}
      {item.changedAfterLock && <div className="day-record-change"><button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>Đã cập nhật sau khi ngày kết thúc <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>{expanded && <div className="day-record-change__compare">{item.snapshot && <FactDetails item={item.snapshot} historical />}{item.sourceMissing ? <div className="day-record-fact-details"><p>Hiện tại</p><strong>Nguồn này không còn trong Sắc Ký</strong><span>Nội dung khi ngày kết thúc vẫn được giữ lại ở trên.</span></div> : <FactDetails item={item} />}</div>}</div>}
    </div>
  </article>
}

export function DayRecordPage() {
  const [searchParams] = useSearchParams()
  const localDate = searchParams.get('date') ?? getLocalDateFallback()
  const [entry, setEntry] = useState<DiaryEntry | null>(null)
  const [filter, setFilter] = useState<DayRecordFilter>('all')
  const { record, isLoading, error, refresh } = useDayRecord(localDate, entry)

  useEffect(() => {
    let mounted = true
    void getDiaryEntry(localDate).then((next) => { if (mounted) setEntry(next) }).catch(() => { if (mounted) setEntry(null) })
    return () => { mounted = false }
  }, [localDate])

  const visibleItems = useMemo(() => record?.items.filter((item) => filter === 'all' || item.kind === filter) ?? [], [filter, record])
  return <section className="diary-page day-record-page" aria-labelledby="day-record-title">
    <header className="day-record-page__header"><div><Link className="diary-back-link" to={`/diary?view=editor&date=${localDate}`}>← Quay lại Diary</Link><p className="eyebrow">Day Record</p><h1 id="day-record-title">Ngày này đã diễn ra</h1><p>{formatDiaryDate(localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>{record && <DayRecordMeta record={record} />}</header>
    {error && <div className="day-record-error" role="alert"><span>{error}</span><button className="button button--secondary button--small" type="button" onClick={() => void refresh()}>Thử lại</button></div>}
    <div className="day-record-summary"><span><strong>{record?.checkinCount ?? 0}</strong> Check-in</span><span><strong>{record?.completedActionCount ?? 0}</strong> việc đã làm</span><span>{record?.state === 'live' ? 'Nội dung sẽ tự cập nhật khi ngày còn mở.' : 'Phiên bản hiện tại được ưu tiên hiển thị.'}</span></div>
    <div className="day-record-filter" role="tablist" aria-label="Lọc Day Record">{([{ value: 'all', label: 'Tất cả' }, { value: 'checkin', label: 'Check-in' }, { value: 'action', label: 'Việc nhỏ' }] as const).map((option) => <button className={filter === option.value ? 'is-active' : ''} key={option.value} type="button" role="tab" aria-selected={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div>
    {isLoading && !record ? <div className="day-record-loading" role="status">Đang xếp lại những điều đã diễn ra…</div> : visibleItems.length ? <div className="day-record-timeline">{visibleItems.map((item) => <DayRecordTimelineItem item={item} key={item.key} />)}</div> : <div className="day-record-empty">Chưa có Check-in hoặc việc đã hoàn tất trong ngày này.</div>}
  </section>
}

const getLocalDateFallback = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: DIARY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
