import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listCheckins } from '../checkin/services/checkinRepository'
import { useReferenceData } from '../checkin/hooks/useReferenceData'
import type { CheckinRecord, Emotion } from '../checkin/types'
import { listActionReflections, listActions } from '../actionspace/actionService'
import type { ActionRecord, ActionReflection } from '../actionspace/types'
import { useUiContent } from '../../services/uiContent'
import { PageHeading } from '../../components/PageHeading'
import { EmotionPicker } from './components/DiaryPickers'
import { createEmptyJourneyDraft, getJourneyEntry, listDiaryEntries, listJourneyEntries, saveJourney } from './services/diaryRepository'
import type { DiaryCheckinLink, DiaryEntry, JourneyCoverage, JourneyDraft, JourneyEntry } from './types'
import { addDiaryDays, clampDiaryWeight, DIARY_TIME_ZONE, formatDiaryDate, formatDiaryShortDate, getDiaryLocalDate } from './utils'
import { getJourneyCoverage, getJourneyDays, journeyDateFor, journeyDateInRange } from './journeyUtils'
import { isRichTextEmpty, richTextToPlainText, RichTextEditor, RichTextRenderer } from '../../components/richText'
import { useAutosave } from '../../hooks/useAutosave'

const formatRange = (rangeStart: string, rangeEnd: string): string => `${formatDiaryShortDate(rangeStart)} → ${formatDiaryShortDate(rangeEnd)}`
const getDateFor = journeyDateFor

const getCheckinLabel = (record: CheckinRecord): { title: string; emoji: string; description: string; color: string } => {
  const note = richTextToPlainText(record.note).trim()
  if (record.checkinType === 'unknown') return { title: 'Mình còn đang mơ hồ', emoji: record.unknownPrompt?.emoji ?? '◌', description: note || 'Chưa có ghi chú', color: 'var(--color-text-soft)' }
  return {
    title: record.primaryEmotion?.emotion_name_vn ?? 'Check-in cảm xúc',
    emoji: record.primaryEmotion?.emoji ?? '◉',
    description: note || record.primaryEmotion?.emotion_name_en || 'Không có ghi chú',
    color: record.primaryEmotion?.color_hex ?? 'var(--color-text-soft)',
  }
}

const formatTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: DIARY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
const isDiaryUserDone = (entry: DiaryEntry): boolean => entry.status === 'done'

const useJourneyContext = (rangeStart: string, rangeEnd: string) => {
  const { reference } = useReferenceData()
  const [dailyEntries, setDailyEntries] = useState<DiaryEntry[]>([])
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [actions, setActions] = useState<ActionRecord[]>([])
  const [reflections, setReflections] = useState<ActionReflection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!reference) return
    let mounted = true
    void Promise.all([listDiaryEntries(), listCheckins(reference), listActions()]).then(async ([nextDaily, nextCheckins, nextActions]) => {
      const reflectionResult = await listActionReflections(nextActions.map((action) => action.id))
      if (!mounted) return
      setDailyEntries(nextDaily)
      setCheckins(nextCheckins.filter((record) => journeyDateInRange(journeyDateFor(record.occurredAt), rangeStart, rangeEnd)))
      setActions(nextActions)
      setReflections(reflectionResult.reflections)
      setError(null)
    }).catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu cho chặng này.') }).finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [rangeEnd, rangeStart, reference])
  return { dailyEntries, checkins, actions, reflections, emotions: reference?.emotions ?? [], coverage: getJourneyCoverage(rangeStart, rangeEnd, dailyEntries, checkins, actions), isLoading, error }
}

const useJourneyEntries = () => {
  const [journeys, setJourneys] = useState<JourneyEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    void listJourneyEntries().then((next) => {
      if (!mounted) return
      setJourneys(next)
      setError(null)
    }).catch((reason: unknown) => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử Journey.')
    }).finally(() => {
      if (mounted) setIsLoading(false)
    })
    return () => { mounted = false }
  }, [])
  return { journeys, isLoading, error }
}

const JourneyOrb = ({ color = 'var(--color-violet)', emoji }: { color?: string; emoji?: string }) => <span className="journey-orb" style={{ '--journey-orb-color': color } as CSSProperties}>{emoji ?? '✦'}</span>

const JourneyState = ({ children, error }: { children: ReactNode; error?: string | null }) => <div className="diary-state journey-state" role={error ? 'alert' : 'status'}><span className="diary-state__mark" aria-hidden="true">{error ? '!' : '✦'}</span><p>{error ?? children}</p></div>

const JourneyCoverageCard = ({ coverage, dailyEntries, rangeStart, rangeEnd, preview = false }: { coverage: JourneyCoverage; dailyEntries: DiaryEntry[]; rangeStart: string; rangeEnd: string; preview?: boolean }) => {
  const days = getJourneyDays(rangeStart, rangeEnd)
  const dailyDates = new Set(dailyEntries.filter((entry) => journeyDateInRange(entry.localDate, rangeStart, rangeEnd)).map((entry) => entry.localDate))
  return <section className={`diary-editor-card journey-coverage-card ${preview ? 'journey-coverage-card--preview' : ''}`}><div className="journey-coverage-card__heading"><div><span className="section-label">{preview ? 'Xem trước chặng của bạn' : 'Khoảng thời gian đã chọn'}</span><strong>{coverage.dayCount} ngày</strong></div><span className="journey-range-copy">{formatRange(rangeStart, rangeEnd)}</span></div><div className="journey-day-strip" aria-label="Mức độ bao phủ nhật ký ngày">{days.slice(0, 42).map((day) => <i className={dailyDates.has(day) ? 'is-covered' : ''} key={day} title={formatDiaryShortDate(day)} />)}</div><div className="journey-coverage-stats"><span><b>{coverage.dailyDiaryCount}</b> Nhật ký ngày</span><span><b>{coverage.checkinCount}</b> Check-in</span><span><b>{coverage.completedActionCount}</b> việc đã làm</span></div></section>
}

const JourneyEntryCard = ({ journey }: { journey: JourneyEntry }) => <Link className="journey-history-item" to={`/journey?view=read&id=${journey.id}`}><JourneyOrb color={journey.primaryEmotionSnapshot?.color_hex} emoji={journey.primaryEmotionSnapshot?.emoji ?? '✦'} /><span><small>{formatRange(journey.rangeStart, journey.rangeEnd)} · {getJourneyDays(journey.rangeStart, journey.rangeEnd).length} ngày</small><strong>{journey.title || 'Một chặng đã giữ lại'}</strong><em>{journey.primaryEmotionSnapshot ? `${journey.primaryEmotionSnapshot.emoji} ${journey.primaryEmotionSnapshot.emotion_name_vn}` : 'Chưa chọn cảm xúc đại diện'}</em><p>{isRichTextEmpty(journey.overallText) ? 'Chưa thêm phần tổng quan.' : richTextToPlainText(journey.overallText).replace(/\s+/g, ' ').trim()}</p></span><span className={`journey-status journey-status--${journey.status}`}>{journey.status === 'done' ? 'Đã hoàn tất' : 'Bản nháp'}</span></Link>

const JourneyLandingPage = () => {
  const { journeys, isLoading, error } = useJourneyEntries()
  const recentJourneys = useMemo(() => [...journeys].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 3), [journeys])
  if (isLoading) return <section className="diary-page journey-page"><JourneyState>Đang mở không gian Journey…</JourneyState></section>
  if (error) return <section className="diary-page journey-page"><JourneyState error={error}> </JourneyState></section>
  return <section className="diary-page journey-page journey-page--landing" aria-labelledby="journey-landing-title"><PageHeading className="journey-page-header" eyebrow="Journey" title="Nhìn lại một chặng" description="Có những đoạn đường chỉ cần một khoảng lặng để mình nhận ra đã đi xa đến đâu." actions={<Link className="button button--primary" to="/journey?view=setup">Nhìn lại một chặng <span aria-hidden="true">→</span></Link>} titleId="journey-landing-title" /><div className="journey-landing-layout"><section className="diary-editor-card journey-card journey-landing-intro"><div className="journey-landing-intro__art" aria-hidden="true"><span>✦</span><i /><b /><em>◌</em></div><div className="journey-landing-intro__copy"><span className="section-label">Một khoảng để ngoảnh lại</span><h2>Không cần đi nhanh. Chỉ cần nhận ra mình đã đi.</h2><p>Chọn vài ngày, giữ lại những điều có ý nghĩa, rồi viết cho chặng đường ấy một cái tên. Journey là trang giấy rộng hơn cho những thay đổi nhỏ đang diễn ra trong bạn.</p><Link className="text-button" to="/journey?view=setup">Bắt đầu từ một khoảng ngày →</Link></div></section><section className="diary-editor-card journey-card journey-recent-list"><div className="journey-card__heading"><div><span className="section-label">Những chặng gần đây</span><h2>Điều mình đã giữ lại</h2></div><Link className="text-button" to="/journey?view=history">Xem tất cả →</Link></div>{recentJourneys.length === 0 ? <div className="journey-recent-empty"><strong>Chặng đầu tiên vẫn đang chờ bạn.</strong><p>Khi sẵn sàng, hãy chọn một khoảng ngày để bắt đầu viết.</p></div> : <div className="journey-history-list">{recentJourneys.map((journey) => <JourneyEntryCard key={journey.id} journey={journey} />)}</div>}</section></div><Link className="text-button journey-landing-history-link" to="/journey?view=history">Mở lịch sử Journey →</Link></section>
}

const JourneyHistoryPage = () => {
  const { journeys, isLoading, error } = useJourneyEntries()
  const sortedJourneys = useMemo(() => [...journeys].sort((left, right) => right.rangeEnd.localeCompare(left.rangeEnd) || right.updatedAt.localeCompare(left.updatedAt)), [journeys])
  if (isLoading) return <section className="diary-page journey-page"><JourneyState>Đang mở lịch sử Journey…</JourneyState></section>
  if (error) return <section className="diary-page journey-page"><JourneyState error={error}> </JourneyState></section>
  return <section className="diary-page journey-page journey-page--history" aria-labelledby="journey-history-title"><PageHeading className="journey-page-header" eyebrow="Journey" title="Lịch sử Journey" description="Các chặng được lưu độc lập, kể cả khi khoảng thời gian của chúng trùng nhau." actions={<Link className="button button--primary" to="/journey?view=setup">Nhìn lại một chặng <span aria-hidden="true">→</span></Link>} titleId="journey-history-title" /><section className="diary-editor-card journey-card journey-history-surface"><div className="journey-card__heading"><div><span className="section-label">Journey</span><h2>{sortedJourneys.length} chặng đã lưu</h2></div><Link className="diary-back-link" to="/journey">← Về Journey</Link></div>{sortedJourneys.length === 0 ? <div className="diary-subtle-empty">Chưa có Journey nào. Bạn có thể bắt đầu bằng một khoảng ngày bất kỳ.</div> : <div className="journey-history-list">{sortedJourneys.map((journey) => <JourneyEntryCard key={journey.id} journey={journey} />)}</div>}</section></section>
}

const JourneySetupPage = () => {
  const navigate = useNavigate()
  const today = getDiaryLocalDate()
  const eyebrow = useUiContent('diary.journey.setup.eyebrow')
  const title = useUiContent('diary.journey.setup.title')
  const subtitle = useUiContent('diary.journey.setup.subtitle')
  const startLabel = useUiContent('diary.journey.setup.start')
  const [rangeStart, setRangeStart] = useState(addDiaryDays(today, -6))
  const [rangeEnd, setRangeEnd] = useState(today)
  const { dailyEntries, coverage, isLoading, error } = useJourneyContext(rangeStart, rangeEnd)
  const invalid = !rangeStart || !rangeEnd || rangeStart > rangeEnd
  return <section className="diary-page journey-page journey-page--setup" aria-labelledby="journey-setup-title"><PageHeading className="journey-page-header" eyebrow={eyebrow} title={title} description={`${subtitle} Bạn có thể chọn ví dụ 5, 10 hoặc 20 ngày.`} actions={<Link className="diary-back-link" to="/journey">← Quay lại Journey</Link>} titleId="journey-setup-title" />{error && <p className="form-error" role="alert">{error}</p>}<div className="journey-setup-layout"><div className="journey-setup-main"><section className="diary-editor-card journey-card journey-range-card"><div className="journey-card__heading"><div><span className="section-label">Chọn khoảng thời gian</span><h2>Từ ngày nào đến ngày nào?</h2></div><span className="journey-card__hint">Bạn có thể chọn bất kỳ khoảng hợp lệ nào</span></div><div className="journey-date-fields"><label className="diary-field">Từ ngày<input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label><span aria-hidden="true">→</span><label className="diary-field">Đến ngày<input type="date" value={rangeEnd} min={rangeStart} onChange={(event) => setRangeEnd(event.target.value)} /></label></div>{invalid && <p className="form-error">Ngày bắt đầu cần nằm trước hoặc bằng ngày kết thúc.</p>}<div className="journey-selected-range"><JourneyOrb color="var(--color-violet)" emoji="▣" /><div><small>Khoảng thời gian đã chọn</small><strong>{invalid ? 'Chưa chọn khoảng hợp lệ' : `${coverage.dayCount} ngày`}</strong></div><span>{!invalid && <>{coverage.dailyDiaryCount} nhật ký ngày&nbsp; · &nbsp;{coverage.checkinCount} Check-in&nbsp; · &nbsp;{coverage.completedActionCount} việc đã làm</>}</span></div></section><section className="diary-editor-card journey-card journey-includes-card"><div className="journey-card__heading"><div><span className="section-label">Chặng nhật ký sẽ bao gồm</span><h2>Những lớp dữ liệu để bạn tự chọn và nhìn lại</h2></div></div><div className="journey-includes-list"><div><JourneyOrb color="var(--color-violet)" emoji="▣" /><span><strong>Nhật ký ngày</strong><small>Chỉ những bài bạn chủ động chọn để giữ lại.</small></span></div><div><JourneyOrb color="var(--color-green)" emoji="✓" /><span><strong>Check-in đã chọn</strong><small>Chọn từng Check-in trong khoảng thời gian này.</small></span></div><div><JourneyOrb color="var(--color-pink)" emoji="♡" /><span><strong>Cảm xúc chính</strong><small>Một cảm xúc đại diện do bạn lựa chọn, không có cường độ.</small></span></div><div><JourneyOrb color="var(--color-mango)" emoji="✎" /><span><strong>Suy ngẫm kết chặng</strong><small>Một không gian riêng để bạn viết điều muốn mang theo.</small></span></div></div></section><div className="journey-setup-actions"><Link className="button button--secondary" to="/journey">Hủy</Link><button className="button button--primary" type="button" disabled={invalid || isLoading} onClick={() => navigate(`/journey?view=editor&from=${rangeStart}&to=${rangeEnd}`)}>{startLabel} <span aria-hidden="true">→</span></button></div></div><JourneyCoverageCard coverage={coverage} dailyEntries={dailyEntries} rangeStart={rangeStart} rangeEnd={rangeEnd} preview /></div></section>
}

type JourneyAttachmentPickerProps = {
  rangeStart: string
  rangeEnd: string
  dailyEntries: DiaryEntry[]
  checkins: CheckinRecord[]
  selectedDailyIds: string[]
  links: DiaryCheckinLink[]
  onApply: (dailyIds: string[], links: DiaryCheckinLink[]) => void
  onClose: () => void
}

const JourneyAttachmentPicker = ({ rangeStart, rangeEnd, dailyEntries, checkins, selectedDailyIds, links, onApply, onClose }: JourneyAttachmentPickerProps) => {
  const [tab, setTab] = useState<'daily' | 'checkin'>('daily')
  const [pendingDailyIds, setPendingDailyIds] = useState(() => selectedDailyIds.filter((id) => dailyEntries.some((entry) => entry.id === id && isDiaryUserDone(entry))))
  const [pendingLinks, setPendingLinks] = useState(links)
  const toggleDaily = (id: string) => {
    const entry = dailyEntries.find((item) => item.id === id)
    if (!entry || !isDiaryUserDone(entry)) return
    setPendingDailyIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }
  const toggleCheckin = (record: CheckinRecord) => setPendingLinks((current) => current.some((item) => item.checkinId === record.id) ? current.filter((item) => item.checkinId !== record.id) : [...current, { checkinId: record.id, weightPercent: 50, position: current.length + 1 }])
  const updateWeight = (id: string, value: number) => setPendingLinks((current) => current.map((item) => item.checkinId === id ? { ...item, weightPercent: clampDiaryWeight(value) } : item))
  const selectedDaily = pendingDailyIds.map((id) => dailyEntries.find((entry) => entry.id === id)).filter((entry): entry is DiaryEntry => Boolean(entry))
  return <div className="diary-modal-backdrop journey-modal-backdrop" role="presentation" onClick={onClose}><section className="diary-modal diary-modal--journey journey-modal" role="dialog" aria-modal="true" aria-labelledby="journey-attachment-title" onClick={(event) => event.stopPropagation()}><button className="diary-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><header className="diary-modal__header journey-modal__header"><div className="journey-modal__icon"><JourneyOrb color="var(--color-violet)" emoji="▣" /></div><div><p className="eyebrow">Nhật ký chặng · {formatRange(rangeStart, rangeEnd)}</p><h2 id="journey-attachment-title">Chọn nội dung để giữ lại</h2><p>Chọn những nhật ký ngày đã hoàn tất và Check-in bạn muốn đính kèm vào nhật ký chặng.</p></div></header><div className="journey-modal-layout"><div className="journey-modal-main"><div className="journey-modal-tabs" role="tablist"><button className={tab === 'daily' ? 'is-active' : ''} type="button" role="tab" aria-selected={tab === 'daily'} onClick={() => setTab('daily')}>▣ &nbsp; Nhật ký ngày</button><button className={tab === 'checkin' ? 'is-active' : ''} type="button" role="tab" aria-selected={tab === 'checkin'} onClick={() => setTab('checkin')}>♧ &nbsp; Check-in</button></div>{tab === 'daily' ? <div className="journey-attachment-list"><div className="journey-list-heading"><span>Danh sách nhật ký ngày</span><small>{dailyEntries.filter(isDiaryUserDone).length}/{dailyEntries.length} bài đã hoàn tất</small></div>{dailyEntries.length === 0 && <div className="diary-subtle-empty">Chưa có Nhật ký ngày nào trong khoảng này. Bạn vẫn có thể viết một reflection riêng.</div>}{dailyEntries.map((entry) => { const selected = pendingDailyIds.includes(entry.id); const selectable = isDiaryUserDone(entry); return <button className={`journey-attachment-row ${selected ? 'is-selected' : ''} ${selectable ? '' : 'is-disabled'}`} disabled={!selectable} type="button" key={entry.id} onClick={() => toggleDaily(entry.id)}><JourneyOrb color={entry.dailyEmotionSnapshot?.color_hex} emoji={entry.dailyEmotionSnapshot?.emoji ?? '✦'} /><span><small>{formatDiaryDate(entry.localDate, { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}</small><strong>{entry.title}</strong><em>{entry.overallText}</em></span><b>{selected ? '✓ Đã chọn' : selectable ? '+ Chọn' : 'Cần hoàn tất'}</b></button>})}</div> : <div className="journey-attachment-list"><div className="journey-list-heading"><span>Danh sách Check-in</span><small>{checkins.length} Check-in trong chặng</small></div>{checkins.length === 0 && <div className="diary-subtle-empty">Chưa có Check-in nào trong khoảng này.</div>}{checkins.map((record) => { const label = getCheckinLabel(record); const link = pendingLinks.find((item) => item.checkinId === record.id); return <div className={`journey-attachment-row journey-attachment-row--checkin ${link ? 'is-selected' : ''}`} style={{ '--journey-attachment-color': label.color } as CSSProperties} key={record.id}><JourneyOrb color={label.color} emoji={label.emoji} /><span><small>{formatDiaryShortDate(getDateFor(record.occurredAt))} · {formatTime(record.occurredAt)}</small><strong>{label.title}</strong><em>{label.description}</em></span><button className="button button--secondary button--small" type="button" onClick={() => toggleCheckin(record)}>{link ? '✓ Đã chọn' : '+ Chọn'}</button>{link && <label className="journey-inline-weight"><input type="range" min="1" max="100" value={link.weightPercent} style={{ '--weight-percent': `${link.weightPercent}%` } as CSSProperties} onChange={(event) => updateWeight(record.id, Number(event.target.value))} aria-label={`Mức đại diện cho ${label.title}`} /><b>{link.weightPercent}%</b></label>}</div>})}<p className="diary-helper">Mỗi mức phân bổ độc lập, không cần cộng thành 100%.</p></div>}</div><aside className="journey-selected-rail"><div className="journey-selected-rail__heading"><strong>Đã chọn ({pendingDailyIds.length + pendingLinks.length})</strong><button className="text-button" type="button" onClick={() => { setPendingDailyIds([]); setPendingLinks([]) }}>Xóa tất cả</button></div><div className="journey-selected-group"><strong>▣ Nhật ký ngày ({selectedDaily.length})</strong>{selectedDaily.length === 0 ? <small>Chưa chọn bài nào</small> : selectedDaily.map((entry) => <div key={entry.id}><JourneyOrb color={entry.dailyEmotionSnapshot?.color_hex} emoji={entry.dailyEmotionSnapshot?.emoji ?? '✦'} /><span>{entry.title}</span><button type="button" onClick={() => toggleDaily(entry.id)} aria-label={`Bỏ ${entry.title}`}>×</button></div>)}</div><div className="journey-selected-group"><strong>♧ Check-in ({pendingLinks.length})</strong>{pendingLinks.length === 0 ? <small>Chưa chọn Check-in nào</small> : pendingLinks.map((link) => { const record = checkins.find((item) => item.id === link.checkinId); const label = record ? getCheckinLabel(record) : null; return <div key={link.checkinId}><JourneyOrb color={label?.color} emoji={label?.emoji ?? '◌'} /><span>{label?.title ?? 'Check-in'}</span><button type="button" onClick={() => setPendingLinks((current) => current.filter((item) => item.checkinId !== link.checkinId))} aria-label={`Bỏ ${label?.title ?? 'Check-in'}`}>×</button></div>})}</div></aside></div><footer className="diary-modal__footer journey-modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>Hủy</button><button className="button button--primary" type="button" onClick={() => onApply(pendingDailyIds, pendingLinks.map((link, index) => ({ ...link, position: index + 1 })))}>Áp dụng</button></footer></section></div>
}

const JourneyAttachmentSummary = ({ entry, dailyEntries, checkins, onOpen }: { entry: JourneyDraft; dailyEntries: DiaryEntry[]; checkins: CheckinRecord[]; onOpen: () => void }) => {
  const selectedDaily = entry.selectedDailyDiaryIds.map((id) => dailyEntries.find((item) => item.id === id)).filter((item): item is DiaryEntry => Boolean(item))
  const selectedCheckins = entry.checkinLinks.map((link) => ({ link, record: checkins.find((item) => item.id === link.checkinId) })).filter((item): item is { link: DiaryCheckinLink; record: CheckinRecord } => Boolean(item.record))
  return <section className="diary-editor-card journey-card journey-keep-card"><div className="journey-card__heading"><div><span className="section-label">Những điều mình muốn giữ lại</span><p>Không tự động gắn toàn bộ dữ liệu trong chặng — bạn chọn điều có ý nghĩa với mình.</p></div><button className="button button--secondary button--small" type="button" onClick={onOpen}>Chọn nội dung</button></div><div className="journey-keep-grid"><article><div className="journey-keep-heading"><strong>Nhật ký ngày đã chọn</strong><span>{selectedDaily.length}</span></div>{selectedDaily.length ? <div className="journey-mini-orbs">{selectedDaily.slice(0, 7).map((item) => <JourneyOrb key={item.id} color={item.dailyEmotionSnapshot?.color_hex} emoji={item.dailyEmotionSnapshot?.emoji ?? '✦'} />)}{selectedDaily.length > 7 && <b>+{selectedDaily.length - 7}</b>}</div> : <p>Chưa chọn bài nào</p>}<button className="text-button" type="button" onClick={onOpen}>Xem và chọn →</button></article><article><div className="journey-keep-heading"><strong>Check-in đã chọn</strong><span>{selectedCheckins.length}</span></div>{selectedCheckins.length ? <div className="journey-mini-checkins">{selectedCheckins.slice(0, 4).map(({ link, record }) => { const label = getCheckinLabel(record); return <span key={link.checkinId} title={`${label.title} · ${link.weightPercent}%`}><JourneyOrb color={label.color} emoji={label.emoji} />{link.weightPercent}%</span> })}</div> : <p>Chưa chọn Check-in nào</p>}<button className="text-button" type="button" onClick={onOpen}>Xem và chọn →</button></article></div></section>
}

const JourneyRecordBrief = ({ coverage, onDetail }: { coverage: JourneyCoverage; onDetail?: () => void }) => <section className="diary-editor-card journey-record-brief"><div className="journey-record-brief__icon"><JourneyOrb color="var(--color-violet)" emoji="◷" /></div><div><span className="section-label">Những ngày trong chặng này</span><strong>{coverage.dayCount} ngày · {coverage.checkinCount} Check-in · {coverage.dailyDiaryCount} Nhật ký ngày · {coverage.completedActionCount} việc đã làm</strong><small>Chỉ là factual context để hỗ trợ nhớ lại, không phải diễn giải.</small></div>{onDetail && <button className="button button--secondary button--small" type="button" onClick={onDetail}>Xem chi tiết →</button>}</section>

const JourneySummaryRail = ({ entry }: { entry: JourneyDraft | JourneyEntry }) => {
  const items = [{ label: 'Tiêu đề', done: Boolean(entry.title.trim()) }, { label: 'Tổng quan chặng', done: !isRichTextEmpty(entry.overallText) }, { label: 'Cảm xúc chính', done: Boolean(entry.primaryEmotionId) }, { label: 'Nhật ký ngày đã chọn', done: entry.selectedDailyDiaryIds.length > 0 }, { label: 'Check-in đã chọn', done: entry.checkinLinks.length > 0 }, { label: 'Mang theo điều gì?', done: !isRichTextEmpty(entry.closingThought) }]
  const progress = Math.round(items.filter((item) => item.done).length / items.length * 100)
  return <aside className="diary-summary journey-summary-rail"><div className="journey-summary-rail__heading"><strong>Tổng kết chặng</strong><span className={`journey-status journey-status--${entry.status}`}>{entry.status === 'done' ? 'Đã hoàn tất' : 'Bản nháp'}</span></div><div className="journey-summary-rail__range">{formatRange(entry.rangeStart, entry.rangeEnd)}<small>{getJourneyDays(entry.rangeStart, entry.rangeEnd).length} ngày</small></div><div className="journey-progress"><div><span>Tiến độ hoàn thiện</span><b>{progress}%</b></div><i><em style={{ width: `${progress}%` }} /></i></div><div className="journey-checklist">{items.map((item) => <span key={item.label}><i className={item.done ? 'is-done' : ''}>{item.done ? '✓' : '○'}</i>{item.label}</span>)}</div><div className="journey-summary-note">✦ {entry.status === 'done' ? 'Chặng này đã được giữ lại cho bạn.' : 'Hoàn tất để lưu chặng vào nhật ký hành trình của bạn.'}</div></aside>
}

const journeyEditorStorageKey = (id: string | undefined, rangeStart: string, rangeEnd: string): string => `sacky:diary:journey:editor:v1:${id ?? `${rangeStart}:${rangeEnd}`}`
const journeyDraftSignature = (draft: JourneyDraft): string => JSON.stringify({
  title: draft.title,
  overallText: draft.overallText,
  primaryEmotionId: draft.primaryEmotionId,
  selectedDailyDiaryIds: draft.selectedDailyDiaryIds,
  checkinLinks: draft.checkinLinks,
  closingThought: draft.closingThought,
  rangeStart: draft.rangeStart,
  rangeEnd: draft.rangeEnd,
})

const JourneyEditorPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const journeyId = searchParams.get('id') ?? undefined
  const initialStart = searchParams.get('from') ?? addDiaryDays(getDiaryLocalDate(), -6)
  const initialEnd = searchParams.get('to') ?? getDiaryLocalDate()
  const [draft, setDraft] = useState<JourneyDraft>(() => createEmptyJourneyDraft(initialStart, initialEnd))
  const [isLoading, setIsLoading] = useState(Boolean(journeyId))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState('')
  const [showAttachments, setShowAttachments] = useState(false)
  const autosavedSignatureRef = useRef('')
  const { flush: flushJourneyAutosave, schedule: scheduleJourneyAutosave } = useAutosave(async (nextDraft: JourneyDraft) => {
    const saved = await saveJourney(nextDraft)
    autosavedSignatureRef.current = journeyDraftSignature(nextDraft)
    setDraft((current) => journeyDraftSignature(current) === journeyDraftSignature(nextDraft) ? { ...current, ...saved } : current)
    setSaveNotice('Đã tự động lưu')
  }, { delay: 850 })
  const { dailyEntries: allDailyEntries, checkins: allCheckins, actions, emotions } = useJourneyContext(draft.rangeStart, draft.rangeEnd)
  const dailyEntries = allDailyEntries.filter((entry) => journeyDateInRange(entry.localDate, draft.rangeStart, draft.rangeEnd))
  const checkins = allCheckins
  const coverage = getJourneyCoverage(draft.rangeStart, draft.rangeEnd, allDailyEntries, checkins, actions)

  useEffect(() => {
    let mounted = true
    const cacheKey = journeyEditorStorageKey(journeyId, initialStart, initialEnd)
    void Promise.resolve(journeyId ? getJourneyEntry(journeyId) : null).then((entry) => {
      let nextDraft: JourneyDraft = entry ? { ...entry } : createEmptyJourneyDraft(initialStart, initialEnd)
      try {
        const cached = JSON.parse(window.localStorage.getItem(cacheKey) ?? 'null') as JourneyDraft | null
        if (cached && (!entry || (cached.updatedAt ?? '') > entry.updatedAt)) nextDraft = cached
      } catch { /* Ignore an invalid device draft. */ }
      if (mounted) {
        autosavedSignatureRef.current = journeyDraftSignature(nextDraft)
        setDraft(nextDraft)
        setIsLoading(false)
      }
    }).catch((reason: unknown) => { if (mounted) { setError(reason instanceof Error ? reason.message : 'Không thể mở trình biên tập chặng.'); setIsLoading(false) } })
    return () => { mounted = false }
  }, [initialEnd, initialStart, journeyId])

  useEffect(() => {
    if (isLoading) return
    const timer = window.setTimeout(() => { try { window.localStorage.setItem(journeyEditorStorageKey(journeyId, draft.rangeStart, draft.rangeEnd), JSON.stringify(draft)); setSaveNotice('Đã lưu an toàn trên thiết bị') } catch { setSaveNotice('') } }, 350)
    return () => window.clearTimeout(timer)
  }, [draft, isLoading, journeyId])

  useEffect(() => {
    if (isLoading || !draft.title.trim() || isRichTextEmpty(draft.overallText)) return
    const signature = journeyDraftSignature(draft)
    if (signature === autosavedSignatureRef.current) return
    scheduleJourneyAutosave(draft)
  }, [draft, isLoading, scheduleJourneyAutosave])

  const updateDraft = (patch: Partial<JourneyDraft>) => { setDraft((current) => ({ ...current, ...patch })); setError(null); setSaveNotice('Đang lưu…') }
  const selectEmotion = (emotion: Emotion | null) => updateDraft({ primaryEmotionId: emotion?.emotion_id ?? null, primaryEmotionSnapshot: emotion ? { emotion_id: emotion.emotion_id, emotion_name_vn: emotion.emotion_name_vn, emotion_name_en: emotion.emotion_name_en, emoji: emotion.emoji, color_hex: emotion.color_hex } : null })
  const persist = async (status: 'draft' | 'done') => {
    if (!draft.title.trim()) { setError('Hãy thêm tiêu đề trước khi lưu.'); return }
    if (isRichTextEmpty(draft.overallText)) { setError('Hãy viết một chút cho phần tổng quan chặng trước khi lưu.'); return }
    setIsSaving(true); setError(null)
    try {
      await flushJourneyAutosave().catch(() => undefined)
      const saved = await saveJourney({ ...draft, status })
      window.localStorage.removeItem(journeyEditorStorageKey(journeyId, draft.rangeStart, draft.rangeEnd))
      if (status === 'done') navigate(`/journey?view=read&id=${saved.id}`)
      else { setDraft(saved); setSaveNotice('Đã lưu bản nháp'); navigate(`/journey?view=editor&id=${saved.id}`, { replace: true }) }
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể lưu nhật ký chặng.') } finally { setIsSaving(false) }
  }
  if (isLoading) return <section className="diary-page journey-page"><JourneyState>Đang mở không gian viết chặng của bạn…</JourneyState></section>
  return <section className="diary-page journey-page journey-page--editor" aria-labelledby="journey-editor-title"><div className="diary-editor-heading journey-editor-heading"><div><Link className="diary-back-link" to="/journey?view=setup">← Quay lại</Link><p className="eyebrow">Nhật ký chặng</p><h1 id="journey-editor-title">{formatRange(draft.rangeStart, draft.rangeEnd)} <span>· {coverage.dayCount} ngày</span></h1></div><div className="journey-editor-actions"><span className="diary-autosave"><i aria-hidden="true">●</i>{saveNotice || 'Bản nháp tự động'}</span><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void persist('draft')}>Lưu nháp</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void persist('done')}>{isSaving ? 'Đang lưu…' : 'Hoàn tất'}</button></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="journey-editor-layout"><main className="journey-editor-main"><section className="diary-editor-card journey-card journey-writing-card"><div className="diary-field"><label htmlFor="journey-title">Tiêu đề <em>*</em></label><input id="journey-title" maxLength={120} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Một cái tên cho chặng này…" /><small>{draft.title.length}/120</small></div><div className="diary-field"><label>Tổng quan chặng <em>*</em></label><RichTextEditor value={draft.overallText} onChange={(value) => updateDraft({ overallText: value })} placeholder="Nhìn lại khoảng thời gian này: điều gì đã thay đổi, điều gì ở lại, bạn đã đi qua như thế nào?" ariaLabel="Tổng quan chặng" minHeight={170} /><small>{richTextToPlainText(draft.overallText).length} ký tự</small></div></section><section className="diary-editor-card journey-card"><EmotionPicker selected={draft.primaryEmotionId} emotions={emotions} label="Cảm xúc chính của chặng" title="Chọn cảm xúc chính cho chặng" onSelect={selectEmotion} /></section><JourneyAttachmentSummary entry={draft} dailyEntries={dailyEntries} checkins={checkins} onOpen={() => setShowAttachments(true)} /><JourneyRecordBrief coverage={coverage} /><section className="diary-editor-card journey-card journey-closing-card"><div className="journey-closing-copy"><span className="section-label">Mang theo điều gì? <em>(Lời nhắn gửi cho chính mình)</em></span><p>Một điều bạn muốn tiếp tục giữ nhịp sau khi chặng này khép lại.</p></div><div className="diary-field"><RichTextEditor value={draft.closingThought} onChange={(value) => updateDraft({ closingThought: value })} maxLength={800} placeholder="Hãy viết tiếp tục dịu dàng với bản thân…" ariaLabel="Điều muốn mang theo" minHeight={115} /><small>{richTextToPlainText(draft.closingThought).length}/800</small></div></section><div className="journey-editor-footer"><Link className="button button--secondary" to="/journey">← Quay lại Journey</Link><div><button className="button button--secondary" type="button" disabled={isSaving} onClick={() => void persist('draft')}>Lưu nháp</button><button className="button button--primary" type="button" disabled={isSaving} onClick={() => void persist('done')}>Hoàn tất nhật ký chặng</button></div></div></main><JourneySummaryRail entry={draft} /></div>{showAttachments && <JourneyAttachmentPicker rangeStart={draft.rangeStart} rangeEnd={draft.rangeEnd} dailyEntries={dailyEntries} checkins={checkins} selectedDailyIds={draft.selectedDailyDiaryIds} links={draft.checkinLinks} onApply={(dailyIds, links) => { updateDraft({ selectedDailyDiaryIds: dailyIds, checkinLinks: links }); setShowAttachments(false) }} onClose={() => setShowAttachments(false)} />}</section>
}

type JourneyRecordKind = 'diary' | 'checkin' | 'action'
type JourneyRecordEvent = { id: string; date: string; time: string; kind: JourneyRecordKind; title: string; description: string; emoji: string; color: string; dailyEntry?: DiaryEntry; reflection?: ActionReflection }

const JourneyDiaryQuickView = ({ entry, checkins, onClose }: { entry: DiaryEntry; checkins: CheckinRecord[]; onClose: () => void }) => {
  const linkedCheckins = entry.checkinLinks.map((link) => ({ link, record: checkins.find((record) => record.id === link.checkinId) })).filter((item): item is { link: DiaryCheckinLink; record: CheckinRecord } => Boolean(item.record))
  return <div className="diary-modal-backdrop journey-quick-view-backdrop" role="presentation" onClick={onClose}><section className="diary-modal journey-quick-view" role="dialog" aria-modal="true" aria-labelledby="journey-quick-view-title" onClick={(event) => event.stopPropagation()}><button className="diary-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><header className="diary-modal__header"><p className="eyebrow">Daily Diary · {formatDiaryDate(entry.localDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2 id="journey-quick-view-title">{entry.title || 'Nhật ký ngày'}</h2><span className="diary-status"><span aria-hidden="true">✓</span>{entry.status === 'draft' ? 'Bản nháp' : 'Đã hoàn tất'}</span></header><div className="journey-quick-view__body"><section><span className="section-label">Tổng quan</span>{isRichTextEmpty(entry.overallText) ? <p>Chưa thêm tổng quan.</p> : <RichTextRenderer value={entry.overallText} />}</section>{entry.dailyEmotionSnapshot && <section className="journey-quick-view__emotion"><span className="section-label">Cảm xúc chính</span><div><JourneyOrb color={entry.dailyEmotionSnapshot.color_hex} emoji={entry.dailyEmotionSnapshot.emoji} /><span><strong>{entry.dailyEmotionSnapshot.emotion_name_vn}</strong><small>{entry.dailyEmotionSnapshot.emotion_name_en}</small></span></div></section>}{entry.promptResponses.length > 0 && <section><span className="section-label">Những dòng tự sự thêm</span><div className="journey-quick-view__prompts">{entry.promptResponses.map((response) => <article key={response.promptId}><span>{response.promptSnapshot.emoji}</span><div><strong>{response.promptSnapshot.textVn}</strong>{isRichTextEmpty(response.responseText) ? <p>Chưa thêm câu trả lời.</p> : <RichTextRenderer value={response.responseText} />}</div></article>)}</div></section>}{linkedCheckins.length > 0 && <section><span className="section-label">Check-in đã chọn</span><div className="journey-quick-view__checkins">{linkedCheckins.map(({ link, record }) => { const label = getCheckinLabel(record); return <div key={link.checkinId}><JourneyOrb color={label.color} emoji={label.emoji} /><span><strong>{label.title}</strong><small>{link.weightPercent}% · {label.description}</small></span></div> })}</div></section>}{entry.images.length > 0 && <section><span className="section-label">Hình ảnh</span><div className="journey-quick-view__images">{entry.images.map((image) => <figure key={image.id}><img src={image.externalUrl} alt={image.caption || `Ảnh trong nhật ký ${entry.localDate}`} loading="lazy" /><figcaption>{image.caption}</figcaption></figure>)}</div></section>}</div><footer className="diary-modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>Đóng</button><Link className="button button--primary" to={`/diary?view=read&date=${entry.localDate}`} onClick={onClose}>Mở nhật ký</Link></footer></section></div>
}

const JourneyRecordDetail = ({ rangeStart, rangeEnd, dailyEntries, checkins, actions, reflections }: { rangeStart: string; rangeEnd: string; dailyEntries: DiaryEntry[]; checkins: CheckinRecord[]; actions: ActionRecord[]; reflections: ActionReflection[] }) => {
  const events = useMemo<JourneyRecordEvent[]>(() => {
    const diaryEvents = dailyEntries.filter((entry) => journeyDateInRange(entry.localDate, rangeStart, rangeEnd)).map((entry) => ({ id: `diary-${entry.id}`, date: entry.localDate, time: entry.updatedAt || entry.createdAt, kind: 'diary' as const, title: entry.title || 'Nhật ký ngày', description: isRichTextEmpty(entry.overallText) ? 'Chưa thêm tổng quan.' : richTextToPlainText(entry.overallText).replace(/\s+/g, ' ').trim(), emoji: entry.dailyEmotionSnapshot?.emoji ?? '▣', color: entry.dailyEmotionSnapshot?.color_hex ?? 'var(--color-violet)', dailyEntry: entry }))
    const checkinEvents = checkins.filter((record) => journeyDateInRange(journeyDateFor(record.occurredAt), rangeStart, rangeEnd)).map((record) => { const label = getCheckinLabel(record); return { id: `checkin-${record.id}`, date: journeyDateFor(record.occurredAt), time: record.occurredAt, kind: 'checkin' as const, title: label.title, description: label.description, emoji: label.emoji, color: label.color } })
    const actionEvents = actions.filter((action) => action.status === 'completed' && action.completedAt && journeyDateInRange(journeyDateFor(action.completedAt), rangeStart, rangeEnd)).map((action) => ({ id: `action-${action.id}`, date: journeyDateFor(action.completedAt as string), time: action.completedAt as string, kind: 'action' as const, title: action.title, description: action.note || 'Đã hoàn tất việc này.', emoji: '✓', color: 'var(--color-green)', reflection: reflections.find((reflection) => reflection.actionId === action.id) }))
    return [...diaryEvents, ...checkinEvents, ...actionEvents].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time))
  }, [actions, checkins, dailyEntries, rangeEnd, rangeStart, reflections])
  const [filter, setFilter] = useState<'all' | JourneyRecordKind>('all')
  const visibleEvents = useMemo(() => filter === 'all' ? events : events.filter((event) => event.kind === filter), [events, filter])
  const groups = useMemo(() => [...new Set(visibleEvents.map((event) => event.date))].map((date) => ({ date, events: visibleEvents.filter((event) => event.date === date) })), [visibleEvents])
  const [expansion, setExpansion] = useState<{ key: string; days: Set<string> }>({ key: '', days: new Set() })
  const [quickView, setQuickView] = useState<DiaryEntry | null>(null)
  const groupKey = `${filter}:${groups.map((group) => group.date).join(',')}`
  const expandedDays = expansion.key === groupKey ? expansion.days : new Set(groups.slice(0, 14).map((group) => group.date))
  const toggleDay = (date: string) => setExpansion({ key: groupKey, days: new Set(expandedDays.has(date) ? [...expandedDays].filter((item) => item !== date) : [...expandedDays, date]) })
  return <section className="diary-editor-card journey-detail-card"><div className="journey-detail-card__heading"><div><span className="section-label">Chi tiết factual record</span><h2>Những ngày trong chặng này</h2></div><span>{formatRange(rangeStart, rangeEnd)}</span></div><div className="journey-record-filters" role="tablist" aria-label="Lọc factual record"><button className={filter === 'all' ? 'is-active' : ''} type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>Tất cả</button><button className={filter === 'diary' ? 'is-active' : ''} type="button" role="tab" aria-selected={filter === 'diary'} onClick={() => setFilter('diary')}>Diary</button><button className={filter === 'checkin' ? 'is-active' : ''} type="button" role="tab" aria-selected={filter === 'checkin'} onClick={() => setFilter('checkin')}>Check-in</button><button className={filter === 'action' ? 'is-active' : ''} type="button" role="tab" aria-selected={filter === 'action'} onClick={() => setFilter('action')}>Việc nhỏ</button></div>{groups.length === 0 && <p>Chưa có dữ liệu factual trong khoảng này.</p>}<div className="journey-record-days">{groups.map((group) => <section className="journey-record-day" key={group.date}><button className="journey-record-day__toggle" type="button" aria-expanded={expandedDays.has(group.date)} onClick={() => toggleDay(group.date)}><span><strong>{formatDiaryDate(group.date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong><small>{group.events.length} mục</small></span><b aria-hidden="true">{expandedDays.has(group.date) ? '−' : '+'}</b></button>{expandedDays.has(group.date) && <div className="journey-record-day__events">{group.events.map((event) => { const content = <><time>{formatTime(event.time)}</time><JourneyOrb color={event.color} emoji={event.emoji} /><span className="journey-record-event__body"><small>{event.kind === 'diary' ? 'Diary' : event.kind === 'checkin' ? 'Check-in' : 'Việc nhỏ'}</small><strong>{event.title}</strong><em>{event.description}</em>{event.reflection && <b>Reflection: {event.reflection.outcomeSnapshot ?? event.reflection.outcomeId}{event.reflection.note ? ` · ${event.reflection.note}` : ''}</b>}</span></>; return event.kind === 'diary' && event.dailyEntry ? <button className="journey-record-event journey-record-event--button" type="button" key={event.id} onClick={() => setQuickView(event.dailyEntry ?? null)}>{content}</button> : <article className="journey-record-event" key={event.id}>{content}</article> })}</div>}</section>)}</div>{quickView && <JourneyDiaryQuickView entry={quickView} checkins={checkins} onClose={() => setQuickView(null)} />}</section>
}

const JourneyReadPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const journeyId = searchParams.get('id') ?? ''
  const [entry, setEntry] = useState<JourneyEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const { dailyEntries, checkins, actions, reflections, isLoading: contextLoading, error } = useJourneyContext(entry?.rangeStart ?? getDiaryLocalDate(), entry?.rangeEnd ?? getDiaryLocalDate())
  useEffect(() => { let mounted = true; void getJourneyEntry(journeyId).then((next) => { if (mounted) setEntry(next) }).finally(() => { if (mounted) setIsLoading(false) }); return () => { mounted = false } }, [journeyId])
  if (isLoading || contextLoading) return <section className="diary-page journey-page"><JourneyState>Đang mở lại chặng của bạn…</JourneyState></section>
  if (error) return <section className="diary-page journey-page"><JourneyState error={error}> </JourneyState></section>
  if (!entry) return <section className="diary-page journey-page"><JourneyState error="Không tìm thấy nhật ký chặng này."> </JourneyState></section>
  const selectedDaily = entry.selectedDailyDiaryIds.map((id) => dailyEntries.find((item) => item.id === id)).filter((item): item is DiaryEntry => Boolean(item))
  const selectedCheckins = entry.checkinLinks.map((link) => ({ link, record: checkins.find((item) => item.id === link.checkinId) })).filter((item): item is { link: DiaryCheckinLink; record: CheckinRecord } => Boolean(item.record))
  const coverage = getJourneyCoverage(entry.rangeStart, entry.rangeEnd, dailyEntries, checkins, actions)
  return <section className="diary-page journey-page journey-page--read" aria-labelledby="journey-read-title"><div className="diary-editor-heading journey-read-heading"><div><Link className="diary-back-link" to="/journey">← Quay lại nhật ký chặng</Link><p className="eyebrow">Nhật ký chặng</p><h1 id="journey-read-title">{formatRange(entry.rangeStart, entry.rangeEnd)} <span>· {coverage.dayCount} ngày</span></h1><span className={`journey-status journey-status--${entry.status}`}>{entry.status === 'done' ? '✓ Đã hoàn tất' : 'Bản nháp'}</span></div><button className="button button--secondary" type="button" onClick={() => navigate(`/journey?view=editor&id=${entry.id}`)}>✎ Chỉnh sửa</button></div><div className="journey-read-layout"><main className="journey-read-main"><section className="diary-editor-card journey-card journey-overall-read"><span className="section-label">Tổng quan hành trình</span>{isRichTextEmpty(entry.overallText) ? <p>Chưa thêm tổng quan.</p> : <RichTextRenderer value={entry.overallText} />}</section>{entry.primaryEmotionSnapshot && <section className="diary-editor-card journey-card journey-read-emotion"><span className="section-label">Cảm xúc chính của chặng</span><div><JourneyOrb color={entry.primaryEmotionSnapshot.color_hex} emoji={entry.primaryEmotionSnapshot.emoji} /><span><strong>{entry.primaryEmotionSnapshot.emotion_name_vn}</strong><small>{entry.primaryEmotionSnapshot.emotion_name_en}</small></span></div></section>}<section className="diary-editor-card journey-card journey-read-attachments"><div className="journey-card__heading"><span className="section-label">Những điều mình muốn giữ lại</span><span>{selectedDaily.length + selectedCheckins.length} mục</span></div><div className="journey-read-attachment-columns"><div><strong>Nhật ký ngày ({selectedDaily.length})</strong>{selectedDaily.length === 0 ? <small>Không có attachment</small> : selectedDaily.map((item) => <div key={item.id}><JourneyOrb color={item.dailyEmotionSnapshot?.color_hex} emoji={item.dailyEmotionSnapshot?.emoji ?? '✦'} /><span>{formatDiaryDate(item.localDate, { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}</span></div>)}</div><div><strong>Check-in ({selectedCheckins.length})</strong>{selectedCheckins.length === 0 ? <small>Không có attachment</small> : selectedCheckins.map(({ link, record }) => { const label = getCheckinLabel(record); return <div key={link.checkinId}><JourneyOrb color={label.color} emoji={label.emoji} /><span><b>{label.title}</b><small>{formatTime(record.occurredAt)} · {link.weightPercent}%</small></span><i><em style={{ width: `${link.weightPercent}%` }} /></i></div> })}</div></div></section><section className="diary-editor-card journey-card journey-closing-read"><span className="section-label">Mang theo điều gì?</span>{isRichTextEmpty(entry.closingThought) ? <p>Bạn chưa thêm lời nhắn cho chặng này.</p> : <RichTextRenderer value={entry.closingThought} />}<span aria-hidden="true">❞</span></section><JourneyRecordBrief coverage={coverage} onDetail={() => setShowDetail((value) => !value)} />{showDetail && <JourneyRecordDetail rangeStart={entry.rangeStart} rangeEnd={entry.rangeEnd} dailyEntries={dailyEntries} checkins={checkins} actions={actions} reflections={reflections} />}</main><div className="journey-read-side"><JourneySummaryRail entry={entry} /><section className="diary-editor-card journey-side-coverage"><span className="section-label">Những ngày trong chặng này</span><div><strong>{coverage.dayCount}</strong><small>Ngày</small><strong>{coverage.checkinCount}</strong><small>Check-in</small><strong>{coverage.dailyDiaryCount}</strong><small>Nhật ký ngày</small></div><button className="text-button" type="button" onClick={() => setShowDetail((value) => !value)}>Xem chi tiết →</button></section></div></div></section>
}

export function JourneyPage() {
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view')
  if (view === 'editor' || view === 'journey-editor') return <JourneyEditorPage />
  if (view === 'read' || view === 'journey-read') return <JourneyReadPage />
  if (view === 'setup' || view === 'journey-setup') return <JourneySetupPage />
  if (view === 'history' || view === 'journey-history') return <JourneyHistoryPage />
  return <JourneyLandingPage />
}
