import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getReferenceData } from '../checkin/services/referenceRepository'
import { getPublishedRuntimeValue } from '../../services/runtimeConfig'
import type { Emotion } from '../checkin/types'
import { getGiftAnswer, listGiftBoxStyles, listGifts, saveGiftAnswer, sendGift, setGiftOpened, setGiftReceipt, rememberGiftDraft, saveGiftDraft, convertGiftQuestionToDiary } from './services/giftRepository'
import { GiftBoxArt } from './components/GiftBoxArt'
import { createGiftId, formatGiftDate, formatGiftDateTime, getGiftLocalDate, giftUserError, isGiftEditable, isGiftFilterMatch, isGiftInHistory, isGiftOnHome, receiptLabel, statusLabel } from './utils'
import type { GiftBoxStyle, GiftDraft, GiftHistoryFilter, GiftQuestionAnswer, GiftRecord, GiftType } from './types'
import './gift.css'

type EditorStep = 'type' | 'decorate' | 'preview'

const fallbackStyles: GiftBoxStyle[] = [
  { id: 'box-mint-coral', name: 'Mầm xanh & san hô', palette: ['#56D6B1', '#FF806B'], ribbon: '#FF806B', shape: 'square', config: { seal: '✦' } },
  { id: 'box-sun-blue', name: 'Nắng vàng & xanh trời', palette: ['#FFD15C', '#5C8DFF'], ribbon: '#5C8DFF', shape: 'round', config: { seal: '☼' } },
  { id: 'box-pink-orange', name: 'Hồng đào & cam ấm', palette: ['#FF8FB3', '#FF9B54'], ribbon: '#FF9B54', shape: 'tall', config: { seal: '♡' } },
  { id: 'box-green-yellow', name: 'Lá non & vàng dịu', palette: ['#75C96B', '#F4C95D'], ribbon: '#75C96B', shape: 'square', config: { seal: '❋' } },
]

const draftFromGift = (gift: GiftRecord): GiftDraft => ({ id: gift.id, type: gift.type, questionText: gift.questionText ?? '', messageText: gift.messageText ?? '', emotionId: gift.emotionId, emotionSnapshot: gift.emotionSnapshot, boxStyleId: gift.boxStyleId, boxStyleSnapshot: gift.boxStyleSnapshot })

function GiftPageState({ children, error, onRetry }: { children?: ReactNode; error?: string | null; onRetry?: () => void }) {
  if (!error && children) return <>{children}</>
  return <section className="gift-page gift-page--state" role={error ? 'alert' : 'status'}><span className="gift-page__state-mark" aria-hidden="true">{error ? '!' : '✦'}</span><h1>{error ? 'Chưa thể mở Gift for Tomorrow' : 'Đang mở Gift for Tomorrow…'}</h1><p>{error ?? 'Mình đang chuẩn bị một khoảng nhỏ cho ngày mai.'}</p>{error && onRetry && <button className="button button--secondary" type="button" onClick={onRetry}>Thử lại</button>}</section>
}

export function GiftPage() {
  const [searchParams] = useSearchParams()
  const [gifts, setGifts] = useState<GiftRecord[]>([])
  const [styles, setStyles] = useState<GiftBoxStyle[]>(fallbackStyles)
  const [emotions, setEmotions] = useState<Emotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ step: EditorStep; draft: GiftDraft } | null>(null)
  const [saveNotice, setSaveNotice] = useState('')
  const [selectedGift, setSelectedGift] = useState<GiftRecord | null>(null)
  const [answer, setAnswer] = useState<GiftQuestionAnswer | null>(null)
  const [answerSaveNotice, setAnswerSaveNotice] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [giftTimes, setGiftTimes] = useState({ cutoff: '23:30', delivery: '03:00' })
  const draftRevisionRef = useRef(0)
  const view = searchParams.get('view') === 'history' ? 'history' : 'home'
  const today = getGiftLocalDate()
  const stylesById = useMemo(() => new Map(styles.map((style) => [style.id, style])), [styles])
  const homeGift = useMemo(() => gifts.find((gift) => isGiftOnHome(gift, new Date(), giftTimes.cutoff)) ?? null, [gifts, giftTimes.cutoff])
  const todayGift = useMemo(() => gifts.find((gift) => gift.creationLocalDate === today) ?? null, [gifts, today])
  const history = useMemo(() => gifts.filter((gift) => isGiftInHistory(gift, new Date(), giftTimes.cutoff)).sort((left, right) => right.creationLocalDate.localeCompare(left.creationLocalDate)), [gifts, giftTimes.cutoff])

  const refresh = async () => {
    setIsLoading(true)
    try {
      const [nextGifts, nextStyles, reference, cutoff, delivery] = await Promise.all([listGifts(), listGiftBoxStyles(), getReferenceData(), getPublishedRuntimeValue('gift.cutoff_local_time', '23:30'), getPublishedRuntimeValue('gift.delivery_local_time', '03:00')])
      setGifts(nextGifts); setStyles(nextStyles.length ? nextStyles : fallbackStyles); setEmotions(reference.emotions); setGiftTimes({ cutoff, delivery }); setError(null)
    } catch (reason: unknown) { setError(giftUserError(reason, 'Không thể tải Gift for Tomorrow.')) } finally { setIsLoading(false) }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const openEditor = (gift?: GiftRecord, type: GiftType = 'question') => {
    setError(null)
    const now = new Date().toISOString()
    const existing = gift ?? { id: createGiftId(), userId: '', creationLocalDate: today, type, status: 'draft' as const, questionText: null, messageText: null, emotionId: null, emotionSnapshot: null, boxStyleId: styles[0]?.id ?? fallbackStyles[0].id, boxStyleSnapshot: null, sentAt: null, lockedAt: null, deliverAt: null, deliveredAt: null, openedAt: null, receiptStatus: 'pending' as const, createdAt: now, updatedAt: now }
    const style = existing.boxStyleSnapshot ?? stylesById.get(existing.boxStyleId) ?? styles[0] ?? fallbackStyles[0]
    const nextGift = { ...existing, boxStyleSnapshot: style }
    rememberGiftDraft(nextGift)
    draftRevisionRef.current += 1
    setEditor({ step: 'type', draft: draftFromGift(nextGift) })
  }

  const updateDraft = (patch: Partial<GiftDraft>) => { draftRevisionRef.current += 1; setEditor((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : current); setSaveNotice('Đang lưu bản nháp…') }
  useEffect(() => {
    if (!editor?.draft.id) return
    const draft = editor.draft
    const revision = draftRevisionRef.current
    const timer = window.setTimeout(() => { void saveGiftDraft(draft).then((saved) => { if (revision === draftRevisionRef.current) { setGifts((current) => [saved, ...current.filter((gift) => gift.id !== saved.id)]); setSaveNotice('Đã tự động lưu') } }).catch((reason: unknown) => { if (revision === draftRevisionRef.current) setSaveNotice(giftUserError(reason, 'Chưa lưu được bản nháp — nội dung vẫn còn ở đây.')) }) }, 650)
    return () => window.clearTimeout(timer)
  }, [editor?.draft])

  const continueEditor = () => {
    if (!editor) return
    if (editor.step === 'type') {
      if (editor.draft.type === 'question' && !editor.draft.questionText.trim()) { setSaveNotice('Hãy viết câu hỏi trước khi tiếp tục.'); return }
      if (editor.draft.type === 'message' && !editor.draft.messageText.trim()) { setSaveNotice('Hãy viết lời nhắn trước khi tiếp tục.'); return }
      setEditor({ ...editor, step: 'decorate' })
    } else if (editor.step === 'decorate') setEditor({ ...editor, step: 'preview' })
  }
  const send = async () => {
    if (!editor) return
    setSaveNotice('Đang gửi…')
    try { const sent = await sendGift(editor.draft); setEditor(null); setGifts((current) => [sent, ...current.filter((gift) => gift.id !== sent.id)]); void refresh() } catch (reason: unknown) { setSaveNotice(giftUserError(reason, 'Không thể gửi món quà. Nội dung của bạn vẫn được giữ lại.')) }
  }

  const closeEditor = () => {
    if (editor) void saveGiftDraft(editor.draft).catch(() => undefined)
    draftRevisionRef.current += 1
    setEditor(null)
  }

  const openDeliveredGift = (gift: GiftRecord) => {
    const openedAt = gift.openedAt ?? new Date().toISOString()
    const openedGift = { ...gift, openedAt }
    setSelectedGift(openedGift)
    setGifts((items) => items.map((item) => item.id === gift.id ? openedGift : item))
    setAnswer(null)
    setAnswerSaveNotice('')
    if (!gift.openedAt) void setGiftOpened(gift.id).then((saved) => { setSelectedGift((current) => current?.id === saved.id ? { ...current, ...saved } : current); setGifts((items) => items.map((item) => item.id === saved.id ? saved : item)) }).catch((reason: unknown) => setError(giftUserError(reason, 'Không thể lưu trạng thái đã mở.')))
    if (gift.type === 'question') void getGiftAnswer(gift.id).then(setAnswer).catch(() => setAnswerSaveNotice('Chưa tải được câu trả lời cũ.'))
  }

  useEffect(() => {
    if (!selectedGift || selectedGift.type !== 'question' || answer === null) return
    const timer = window.setTimeout(() => { void saveGiftAnswer(selectedGift.id, answer.answerText, answer.isDone).then((saved) => { setAnswer(saved); setAnswerSaveNotice('Đã lưu') }).catch(() => setAnswerSaveNotice('Chưa lưu được — nội dung vẫn còn ở đây.')) }, 550)
    return () => window.clearTimeout(timer)
  }, [answer, selectedGift])

  const convertToDiary = async () => {
    if (!selectedGift || !answer) return
    setIsConverting(true)
    try { await convertGiftQuestionToDiary(selectedGift, answer); setAnswerSaveNotice('Đã chuyển câu trả lời sang Diary') } catch (reason: unknown) { setAnswerSaveNotice(giftUserError(reason, 'Chưa thể chuyển sang Diary.')) } finally { setIsConverting(false) }
  }

  if (isLoading && gifts.length === 0) return <GiftPageState />
  if (error && gifts.length === 0) return <GiftPageState error={error} onRetry={() => void refresh()} />
  return <section className="gift-page" aria-labelledby="gift-page-title">
    {error && <p className="gift-page__error" role="alert">{error} <button className="text-button" type="button" onClick={() => void refresh()}>Thử lại</button></p>}
    <header className="gift-page__header"><div><p className="eyebrow">Sắc Ký · Gift for Tomorrow</p><h1 id="gift-page-title">Một món quà cho ngày mai.</h1><p>Gửi cho mình một điều nhỏ hôm nay. Ngày mai, mình sẽ nhận lại nó.</p></div><div className="gift-page__header-actions"><Link className={`gift-page__tab ${view === 'home' ? 'is-active' : ''}`} to="/gift-for-tmr">Hôm nay</Link><Link className={`gift-page__tab ${view === 'history' ? 'is-active' : ''}`} to="/gift-for-tmr?view=history">Gift History</Link></div></header>
    {view === 'history' ? <GiftHistory gifts={history} onOpen={(gift) => void openDeliveredGift(gift)} /> : <GiftHome todayGift={todayGift} homeGift={homeGift} stylesById={stylesById} cutoffTime={giftTimes.cutoff} deliveryTime={giftTimes.delivery} onCreate={(type) => openEditor(undefined, type)} onEdit={(gift) => openEditor(gift)} onOpen={(gift) => void openDeliveredGift(gift)} />}
    {selectedGift && <GiftReadPanel gift={selectedGift} answer={answer} answerSaveNotice={answerSaveNotice} isConverting={isConverting} onAnswerChange={(patch) => setAnswer((current) => ({ giftId: selectedGift.id, answerText: '', isDone: false, answeredAt: null, updatedAt: new Date().toISOString(), ...current, ...patch }))} onReceipt={async (status) => { try { const updated = await setGiftReceipt(selectedGift.id, status); setSelectedGift(updated); setGifts((items) => items.map((item) => item.id === updated.id ? updated : item)) } catch (reason: unknown) { setAnswerSaveNotice(giftUserError(reason, 'Chưa lưu được phản hồi.')) } }} onConvert={() => void convertToDiary()} onClose={() => setSelectedGift(null)} />}
    {editor && <GiftComposer editor={editor} styles={styles} emotions={emotions} cutoffTime={giftTimes.cutoff} deliveryTime={giftTimes.delivery} saveNotice={saveNotice} onClose={closeEditor} onUpdate={updateDraft} onContinue={continueEditor} onBack={() => setEditor((current) => current ? { ...current, step: current.step === 'preview' ? 'decorate' : 'type' } : current)} onSend={() => void send()} />}
  </section>
}

function GiftHome({ todayGift, homeGift, stylesById, cutoffTime, deliveryTime, onCreate, onEdit, onOpen }: { todayGift: GiftRecord | null; homeGift: GiftRecord | null; stylesById: Map<string, GiftBoxStyle>; cutoffTime: string; deliveryTime: string; onCreate: (type: GiftType) => void; onEdit: (gift: GiftRecord) => void; onOpen: (gift: GiftRecord) => void }) {
  const isSent = todayGift?.status === 'sent'
  const isDraft = todayGift?.status === 'draft'
  const canEdit = todayGift ? isGiftEditable(todayGift) : false
  return <div className="gift-home-layout"><section className="gift-hero"><div className="gift-hero__copy"><p className="eyebrow">Mỗi ngày một món quà</p><h2>{homeGift ? 'Món quà hôm nay đã đến.' : isSent ? 'Món quà cho ngày mai đã sẵn sàng.' : isDraft ? 'Bạn đang có một món quà đang viết.' : 'Hôm nay, bạn muốn gửi điều gì?'}</h2><p>{homeGift ? 'Mở nó khi bạn thấy đúng lúc. Không cần phản hồi ngay.' : isSent ? `Đã gửi · ${todayGift?.deliverAt ? formatGiftDateTime(todayGift.deliverAt) : `${deliveryTime} ngày mai`}` : isDraft ? 'Nội dung vẫn còn ở đây. Mình có thể tiếp tục bất cứ lúc nào trước giờ khóa.' : 'Một câu hỏi để gặp lại mình, hoặc một lời nhắn để tự ôm lấy mình.'}</p>{homeGift ? <button className="button button--primary" type="button" onClick={() => onOpen(homeGift)}>Mở quà <span aria-hidden="true">→</span></button> : isSent ? <button className="button button--secondary" type="button" disabled={!canEdit} onClick={() => todayGift && onEdit(todayGift)}>{canEdit ? `Chỉnh sửa trước ${cutoffTime}` : `Đã khóa sau ${cutoffTime}`}</button> : isDraft ? <button className="button button--primary" type="button" onClick={() => todayGift && onEdit(todayGift)}>Tiếp tục viết <span aria-hidden="true">→</span></button> : <div className="gift-hero__actions"><button className="button button--primary" type="button" onClick={() => onCreate('question')}>Gửi một câu hỏi <span aria-hidden="true">→</span></button><button className="button button--secondary" type="button" onClick={() => onCreate('message')}>Gửi lời nhắn</button></div>}<small>Chỉ gửi cho ngày mai · Khóa lúc {cutoffTime} · Đến lúc {deliveryTime}</small></div><div className="gift-hero__art"><GiftBoxArt style={homeGift?.boxStyleSnapshot ?? todayGift?.boxStyleSnapshot ?? stylesById.get(todayGift?.boxStyleId ?? '') ?? [...stylesById.values()][0]} /></div></section><section className="gift-ritual-card"><div><span className="section-label">Một nhịp nhỏ</span><h3>Viết · Trang trí · Xem lại · Gửi</h3><p>Món quà này chỉ dành cho ngày mai.</p></div><div className="gift-ritual-steps"><span><b>01</b> Viết</span><span><b>02</b> Chọn hộp</span><span><b>03</b> Gửi</span></div></section><section className="gift-empty-history"><div><span className="section-label">Lịch sử quà tặng</span><h3>Những món quà bạn đã gửi cho mình</h3><p>Quà chưa mở vẫn ở đây. Bạn có thể quay lại bất cứ lúc nào.</p></div><Link className="button button--secondary button--small" to="/gift-for-tmr?view=history">Xem lịch sử →</Link></section></div>
}

function GiftComposer({ editor, styles, emotions, cutoffTime, deliveryTime, saveNotice, onClose, onUpdate, onContinue, onBack, onSend }: { editor: { step: EditorStep; draft: GiftDraft }; styles: GiftBoxStyle[]; emotions: Emotion[]; cutoffTime: string; deliveryTime: string; saveNotice: string; onClose: () => void; onUpdate: (patch: Partial<GiftDraft>) => void; onContinue: () => void; onBack: () => void; onSend: () => void }) {
  const { step, draft } = editor
  const style = draft.boxStyleSnapshot ?? styles.find((item) => item.id === draft.boxStyleId) ?? styles[0]
  return <div className="gift-modal-backdrop" role="presentation"><section className="gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-composer-title"><button className="gift-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><div className="gift-modal__header"><div><p className="eyebrow">Gift for Tomorrow</p><h2 id="gift-composer-title">{step === 'type' ? 'Viết điều muốn gửi' : step === 'decorate' ? 'Chọn một chiếc hộp' : 'Xem lại trước khi gửi'}</h2><p>Quà cho ngày mai · bản nháp tự động lưu</p></div><div className="gift-stepper" aria-label="Các bước"><span className={step === 'type' ? 'is-active' : 'is-done'}>01 Viết</span><span className={step === 'decorate' ? 'is-active' : step === 'preview' ? 'is-done' : ''}>02 Trang trí</span><span className={step === 'preview' ? 'is-active' : ''}>03 Gửi</span></div></div><div className="gift-modal__scroll">{step === 'type' && <div className="gift-compose-grid"><div className="gift-compose-form"><div className="gift-type-switch" role="tablist" aria-label="Loại quà"><button type="button" className={draft.type === 'question' ? 'is-active' : ''} onClick={() => onUpdate({ type: 'question' })}>✦ Câu hỏi</button><button type="button" className={draft.type === 'message' ? 'is-active' : ''} onClick={() => onUpdate({ type: 'message' })}>♡ Lời nhắn</button></div>{draft.type === 'question' ? <label className="gift-field"><span>Câu hỏi dành cho mình <em>*</em></span><textarea autoFocus rows={7} maxLength={600} value={draft.questionText} onChange={(event) => onUpdate({ questionText: event.target.value })} placeholder="Ngày mai, mình muốn hỏi bản thân điều gì?" /><small>{draft.questionText.length}/600 · Câu trả lời sẽ được lưu riêng khi bạn mở quà.</small></label> : <label className="gift-field"><span>Lời nhắn <em>*</em></span><textarea autoFocus rows={7} maxLength={800} value={draft.messageText} onChange={(event) => onUpdate({ messageText: event.target.value })} placeholder="Một điều bạn muốn nói với mình của ngày mai…" /><small>{draft.messageText.length}/800</small></label>}{draft.type === 'message' && <div className="gift-emotion-picker"><div><span className="section-label">Cảm xúc đi kèm <small>tuỳ chọn</small></span><p>Chọn một cảm xúc làm màu nền cho lời nhắn.</p></div><div className="gift-emotion-list">{emotions.slice(0, 18).map((emotion) => <button key={emotion.emotion_id} type="button" className={draft.emotionId === emotion.emotion_id ? 'is-selected' : ''} style={{ '--emotion-color': emotion.color_hex } as React.CSSProperties} onClick={() => onUpdate({ emotionId: emotion.emotion_id, emotionSnapshot: { emotion_id: emotion.emotion_id, emotion_name_vn: emotion.emotion_name_vn, emoji: emotion.emoji, color_hex: emotion.color_hex } })}>{emotion.emoji} {emotion.emotion_name_vn}</button>)}</div>{draft.emotionId && <button className="text-button" type="button" onClick={() => onUpdate({ emotionId: null, emotionSnapshot: null })}>Bỏ chọn cảm xúc</button>}</div>}</div><aside className="gift-compose-aside"><GiftBoxArt style={style} /><span className="section-label">Ngày nhận</span><strong>Ngày mai · {deliveryTime}</strong><p>Không cần chọn ngày khác. Mỗi ngày chỉ có một món quà.</p></aside></div>}{step === 'decorate' && <div className="gift-decorate-grid"><div><span className="section-label">Chọn kiểu hộp</span><div className="gift-style-grid">{styles.map((item) => <button key={item.id} type="button" className={draft.boxStyleId === item.id ? 'is-selected' : ''} onClick={() => onUpdate({ boxStyleId: item.id, boxStyleSnapshot: item })}><GiftBoxArt style={item} /><strong>{item.name}</strong><small>{draft.boxStyleId === item.id ? 'Đang chọn' : 'Chọn hộp này'}</small></button>)}</div></div><aside className="gift-decorate-preview"><span className="section-label">Xem trước hộp</span><GiftBoxArt style={style} /><strong>{style.name}</strong><p>Trang trí chỉ thay đổi hộp quà và dấu niêm. Nội dung vẫn là của bạn.</p></aside></div>}{step === 'preview' && <div className="gift-preview-grid"><div className="gift-preview-card"><span className="section-label">Món quà của bạn</span><GiftBoxArt style={style} /><span className="gift-preview-card__type">{draft.type === 'question' ? 'Câu hỏi' : 'Lời nhắn'}</span><strong>{draft.type === 'question' ? draft.questionText : draft.messageText}</strong>{draft.emotionSnapshot && <small>{draft.emotionSnapshot.emoji} {draft.emotionSnapshot.emotion_name_vn}</small>}</div><div className="gift-preview-copy"><span className="section-label">Lịch gửi</span><h3>Ngày mai · {deliveryTime}</h3><p>Món quà có thể chỉnh sửa đến {cutoffTime} hôm nay. Sau khi gửi, bạn không thể xóa hoặc hủy.</p></div></div>}</div><footer className="gift-modal__footer"><div><span className="gift-autosave" role="status">● {saveNotice || 'Bản nháp tự động'}</span><button className="button button--secondary" type="button" onClick={onClose}>Đóng, viết tiếp sau</button></div><div>{step !== 'type' && <button className="button button--secondary" type="button" onClick={onBack}>← Quay lại</button>}{step !== 'preview' ? <button className="button button--primary" type="button" onClick={onContinue}>Tiếp tục <span aria-hidden="true">→</span></button> : <button className="button button--primary" type="button" onClick={onSend}>Gửi cho ngày mai <span aria-hidden="true">→</span></button>}</div></footer></section></div>
}

function GiftHistory({ gifts, onOpen }: { gifts: GiftRecord[]; onOpen: (gift: GiftRecord) => void }) {
  const [filter, setFilter] = useState<GiftHistoryFilter>('all')
  const visible = gifts.filter((gift) => isGiftFilterMatch(gift, filter))
  return <div className="gift-history-layout"><section className="gift-history-main"><div className="gift-history-overview"><div><p className="eyebrow">Gift History</p><h2>Những điều mình đã gửi cho mình.</h2><p>Không có món quà nào bị xóa khỏi ký ức. Quà chưa mở vẫn ở đây.</p></div><div className="gift-history-metrics"><span><strong>{gifts.length}</strong>Tổng quà</span><span><strong>{gifts.filter((gift) => gift.openedAt).length}</strong>Đã mở</span><span><strong>{gifts.filter((gift) => gift.receiptStatus === 'received').length}</strong>Đã nhận</span></div></div><div className="gift-history-toolbar" role="tablist" aria-label="Bộ lọc Gift History">{(['all', 'question', 'message', 'unopened', 'received', 'declined'] as const).map((value) => <button key={value} className={filter === value ? 'is-active' : ''} type="button" onClick={() => setFilter(value)}>{value === 'all' ? 'Tất cả' : value === 'question' ? 'Câu hỏi' : value === 'message' ? 'Lời nhắn' : value === 'unopened' ? 'Chưa mở' : value === 'received' ? 'Đã nhận' : 'Không nhận'}</button>)}</div>{visible.length === 0 && <div className="gift-history-empty"><span aria-hidden="true">◇</span><p>Chưa có món quà nào trong bộ lọc này.</p></div>}<div className="gift-history-grid">{visible.map((gift) => <GiftHistoryCard key={gift.id} gift={gift} onOpen={onOpen} />)}</div></section></div>
}

function GiftHistoryCard({ gift, onOpen }: { gift: GiftRecord; onOpen: (gift: GiftRecord) => void }) {
  const style = gift.boxStyleSnapshot ?? fallbackStyles.find((item) => item.id === gift.boxStyleId) ?? fallbackStyles[0]
  const isOpened = Boolean(gift.openedAt)
  return <article className="gift-history-card"><div className="gift-history-card__art"><GiftBoxArt style={style} opened={isOpened} /></div><div className="gift-history-card__body"><div><span className="gift-history-card__type">{gift.type === 'question' ? '✦ Câu hỏi' : '♡ Lời nhắn'}</span><span className={`gift-status gift-status--${gift.status}`}>{statusLabel(gift.status)}</span></div><h3>{gift.type === 'question' ? gift.questionText : gift.messageText}</h3><p>{gift.deliveredAt ? `Đến ${formatGiftDateTime(gift.deliveredAt)}` : `Tạo ${formatGiftDate(gift.creationLocalDate)}`}</p><div className="gift-history-card__meta"><span>{isOpened ? 'Đã mở' : 'Chưa mở'}</span><span>{receiptLabel(gift.receiptStatus)}</span></div></div>{gift.status === 'delivered' && <button className="button button--secondary button--small" type="button" onClick={() => onOpen(gift)}>{isOpened ? 'Xem lại' : 'Mở quà'}</button>}</article>
}

function GiftReadPanel({ gift, answer, answerSaveNotice, isConverting, onAnswerChange, onReceipt, onConvert, onClose }: { gift: GiftRecord; answer: GiftQuestionAnswer | null; answerSaveNotice: string; isConverting: boolean; onAnswerChange: (patch: Partial<GiftQuestionAnswer>) => void; onReceipt: (status: 'received' | 'declined') => Promise<void>; onConvert: () => void; onClose: () => void }) {
  return <div className="gift-read-backdrop" role="presentation" onClick={onClose}><section className="gift-read-panel" role="dialog" aria-modal="true" aria-labelledby="gift-read-title" onClick={(event) => event.stopPropagation()}><button className="gift-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><p className="eyebrow">{gift.type === 'question' ? 'Câu hỏi từ hôm qua' : 'Lời nhắn từ hôm qua'}</p><h2 id="gift-read-title">{gift.type === 'question' ? gift.questionText : gift.messageText}</h2>{gift.emotionSnapshot && <span className="gift-read-emotion">{gift.emotionSnapshot.emoji} {gift.emotionSnapshot.emotion_name_vn}</span>}{gift.type === 'question' && <div className="gift-answer"><label htmlFor="gift-answer">Câu trả lời của mình</label><textarea id="gift-answer" rows={7} value={answer?.answerText ?? ''} onChange={(event) => onAnswerChange({ answerText: event.target.value, answeredAt: event.target.value.trim() ? new Date().toISOString() : null })} placeholder="Không cần thật hay. Chỉ cần thật với mình." /><div className="gift-answer__footer"><label><input type="checkbox" checked={answer?.isDone ?? false} onChange={(event) => onAnswerChange({ isDone: event.target.checked })} /> Mình đã trả lời xong</label><small>{answerSaveNotice || 'Tự động lưu'}</small></div>{answer?.answerText.trim() && <button className="button button--secondary button--small" type="button" onClick={onConvert} disabled={isConverting}>{isConverting ? 'Đang chuyển…' : 'Chuyển câu trả lời sang Diary'}</button>}</div>}<div className="gift-read-receipt"><span>Phản hồi món quà</span><button type="button" className={gift.receiptStatus === 'received' ? 'is-selected' : ''} onClick={() => void onReceipt('received')}>Mình đã nhận được quà rồi</button><button type="button" className={gift.receiptStatus === 'declined' ? 'is-selected' : ''} onClick={() => void onReceipt('declined')}>Không nhận nữa đâu!</button><small>{gift.receiptStatus === 'pending' ? 'Bạn có thể đổi lựa chọn bất cứ lúc nào.' : receiptLabel(gift.receiptStatus)}</small></div></section></div>
}
