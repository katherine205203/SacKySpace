import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUiContent } from '../../../services/uiContent'
import { DiaryPromptLimitError, convertGiftQuestionToDiary, getGiftAnswer, getGiftDiaryConversion, saveGiftAnswer, setGiftOpened, setGiftReceipt } from '../../gift/services/giftRepository'
import { GiftBoxArt } from '../../gift/components/GiftBoxArt'
import { GiftReadPanel } from '../../gift/components/GiftReadPanel'
import { getGiftLocalDate, giftUserError } from '../../gift/utils'
import type { DiaryConversionLink, GiftHomeProjection, GiftQuestionAnswer, GiftRecord } from '../../gift/types'

type PersonalSurfacesProps = {
  futureLetter: { availableCount: number; availableTitle: string | null }
  gift?: GiftHomeProjection
  onGiftChanged?: () => void
}

export function PersonalSurfaces({ futureLetter, gift, onGiftChanged }: PersonalSurfacesProps) {
  const sectionTitle = useUiContent('home.landing.for_me_title')
  return <section className="home-v2__card home-v2__personal" aria-labelledby="personal-title">
    <h2 id="personal-title">{sectionTitle}</h2>
    <div className="home-v2__personal-grid"><FutureMeSurface projection={futureLetter} /><GiftSurface projection={gift} onChanged={onGiftChanged} /></div>
  </section>
}

function FutureMeSurface({ projection }: { projection: { availableCount: number; availableTitle: string | null } }) {
  const title = useUiContent('home.landing.future_letter_title')
  const copy = projection.availableCount > 0 ? `${projection.availableCount} thư đang chờ mở${projection.availableTitle ? ` · ${projection.availableTitle}` : ''}` : 'Chưa có thư đang chờ mở'
  return <Link className="home-v2__personal-surface home-v2__future-me" to="/future-letter"><div><h3>{title}</h3><p>{copy}</p></div><div className="home-v2__envelope" aria-hidden="true"><span className="home-v2__seal">S</span></div><span className="home-v2__surface-arrow" aria-hidden="true">→</span></Link>
}

const fallbackGiftStyle = { id: 'home-gift', name: 'Món quà nhiều màu', palette: ['#56D6B1', '#FF806B'], ribbon: '#FF806B', shape: 'square' as const, config: { seal: '✦' } }
const emptyAnswer = (giftId: string): GiftQuestionAnswer => ({ giftId, answerText: '', isDone: false, answeredAt: null, updatedAt: new Date().toISOString() })

function GiftSurface({ projection, onChanged }: { projection?: GiftHomeProjection; onChanged?: () => void }) {
  const navigate = useNavigate()
  const gift = projection?.gift ?? null
  const [isOpening, setIsOpening] = useState(false)
  const [selectedGift, setSelectedGift] = useState<GiftRecord | null>(null)
  const [answer, setAnswer] = useState<GiftQuestionAnswer | null>(projection?.answer ?? null)
  const [conversionLink, setConversionLink] = useState<DiaryConversionLink | null>(null)
  const [answerSaveNotice, setAnswerSaveNotice] = useState('')
  const [isSavingAnswer, setIsSavingAnswer] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionLimitOpen, setConversionLimitOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOpened = Boolean(gift?.openedAt || selectedGift?.openedAt)
  const style = gift?.boxStyleSnapshot ?? fallbackGiftStyle

  if (!gift) return <Link className="home-v2__personal-surface home-v2__gift" to="/gift-for-tmr"><div><h3>A Gift for Myself</h3><p>Chưa có quà đang chờ mở</p></div><div className="home-v2__gift-art" aria-hidden="true"><span>🎁</span></div><span className="home-v2__surface-arrow" aria-hidden="true">→</span></Link>

  const showGift = (nextGift: GiftRecord, existingAnswer = projection?.answer ?? null) => {
    const openedGift = { ...nextGift, openedAt: nextGift.openedAt ?? new Date().toISOString() }
    setSelectedGift(openedGift)
    setAnswer(nextGift.type === 'question' ? existingAnswer ?? emptyAnswer(nextGift.id) : null)
    setConversionLink(null)
    setAnswerSaveNotice('')
    setConversionLimitOpen(false)
    if (nextGift.type === 'question') {
      void getGiftAnswer(nextGift.id).then((saved) => setAnswer(saved ?? existingAnswer ?? emptyAnswer(nextGift.id))).catch(() => undefined)
      void getGiftDiaryConversion(nextGift.id).then(setConversionLink).catch(() => setConversionLink(null))
    }
  }

  const openGift = () => {
    if (isOpening) return
    if (gift.openedAt) { showGift(gift); return }
    setIsOpening(true)
    window.setTimeout(() => {
      void setGiftOpened(gift.id).then((saved) => { showGift(saved); onChanged?.() }).catch((reason: unknown) => setError(giftUserError(reason, 'Không thể mở món quà lúc này.'))).finally(() => setIsOpening(false))
    }, 700)
  }

  const saveAnswerNow = async () => {
    if (!selectedGift || selectedGift.type !== 'question' || !answer?.answerText.trim()) return
    setIsSavingAnswer(true)
    try { setAnswer(await saveGiftAnswer(selectedGift.id, answer.answerText, answer.isDone)); setAnswerSaveNotice('Đã lưu câu trả lời') } catch (reason: unknown) { setAnswerSaveNotice(giftUserError(reason, 'Chưa lưu được — nội dung vẫn còn ở đây.')) } finally { setIsSavingAnswer(false) }
  }

  const convertToDiary = async () => {
    if (!selectedGift || !answer) return
    setIsConverting(true)
    try { const result = await convertGiftQuestionToDiary(selectedGift, answer); setConversionLink(result.link); setAnswerSaveNotice('Đã đưa câu trả lời vào nhật ký'); onChanged?.() } catch (reason: unknown) { if (reason instanceof DiaryPromptLimitError) setConversionLimitOpen(true); setAnswerSaveNotice(giftUserError(reason, 'Chưa thể đưa vào nhật ký.')) } finally { setIsConverting(false) }
  }

  const updateReceipt = async (status: 'received' | 'declined') => {
    if (!selectedGift) return
    try { setSelectedGift(await setGiftReceipt(selectedGift.id, status)); onChanged?.() } catch (reason: unknown) { setAnswerSaveNotice(giftUserError(reason, 'Chưa lưu được phản hồi.')) }
  }

  return <>
    <article className={`home-v2__personal-surface home-v2__gift home-v2__gift--delivered ${isOpened ? 'is-opened' : ''}`} aria-labelledby="home-gift-title">
      <div><h3 id="home-gift-title">A Gift for Myself</h3><p>{isOpened ? 'Bạn có thể mở lại món quà này bất cứ lúc nào' : 'Một món quà đang đợi bạn mở'}</p></div>
      <button className={`home-v2__gift-box-trigger ${isOpening ? 'is-opening' : ''}`} type="button" onClick={openGift} disabled={isOpening} aria-label={isOpening ? 'Đang mở quà' : isOpened ? 'Mở lại món quà' : 'Mở món quà'}><GiftBoxArt style={style} opened={isOpened} /></button>
      <span className={`home-v2__gift-badge ${isOpened ? 'is-opened' : ''}`}>{isOpened ? 'Đã mở' : 'Chưa mở'}</span>
    </article>
    {error && <p className="home-v2__gift-error" role="alert">{error}</p>}
    {selectedGift && <GiftReadPanel gift={selectedGift} answer={answer} answerSaveNotice={answerSaveNotice} isConverting={isConverting} isSavingAnswer={isSavingAnswer} conversionLink={conversionLink} onViewDiary={() => navigate(`/diary?view=read&date=${selectedGift.deliveredAt ? getGiftLocalDate(new Date(selectedGift.deliveredAt)) : gift.creationLocalDate}`)} onAnswerChange={(patch) => setAnswer((current) => ({ ...emptyAnswer(selectedGift.id), ...current, ...patch }))} onSaveAnswer={() => void saveAnswerNow()} onReceipt={updateReceipt} onConvert={() => void convertToDiary()} onClose={() => setSelectedGift(null)} />}
    {conversionLimitOpen && <div className="gift-read-backdrop" role="presentation" onClick={() => setConversionLimitOpen(false)}><section className="gift-read-panel gift-limit-panel" role="dialog" aria-modal="true" aria-labelledby="home-gift-limit-title" onClick={(event) => event.stopPropagation()}><button className="gift-modal__close" type="button" onClick={() => setConversionLimitOpen(false)} aria-label="Đóng">×</button><p className="eyebrow">Giữ nguyên những dòng bạn đã chọn</p><h2 id="home-gift-limit-title">Diary đã đủ 6 prompt</h2><p>Hãy bỏ hoặc thay một prompt trước. Mình không xoá prompt nào tự động.</p><div className="gift-limit-panel__actions"><button className="button button--secondary" type="button" onClick={() => setConversionLimitOpen(false)}>Để sau</button><button className="button button--primary" type="button" onClick={() => { setConversionLimitOpen(false); setSelectedGift(null); navigate(`/diary?view=editor&date=${gift.deliveredAt ? getGiftLocalDate(new Date(gift.deliveredAt)) : gift.creationLocalDate}`) }}>Mở Diary để thay prompt</button></div></section></div>}
  </>
}
