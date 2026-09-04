import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DiaryPromptLimitError, getGiftAnswer, saveGiftAnswer, setGiftOpened, setGiftReceipt, convertGiftQuestionToDiary } from '../services/giftRepository'
import { formatGiftDate, formatGiftDateTime, getGiftLocalDate, giftUserError } from '../utils'
import type { GiftHomeProjection, GiftQuestionAnswer, GiftRecord } from '../types'
import { GiftBoxArt } from './GiftBoxArt'
import { GiftReadPanel } from './GiftReadPanel'

type GiftDeliveryCardProps = { projection: GiftHomeProjection; onChanged?: () => void }

const emptyAnswer = (giftId: string): GiftQuestionAnswer => ({ giftId, answerText: '', isDone: false, answeredAt: null, updatedAt: new Date().toISOString() })

export function GiftDeliveryCard({ projection, onChanged }: GiftDeliveryCardProps) {
  const gift = projection.gift
  const navigate = useNavigate()
  const [isOpening, setIsOpening] = useState(false)
  const [selectedGift, setSelectedGift] = useState<GiftRecord | null>(null)
  const [answer, setAnswer] = useState<GiftQuestionAnswer | null>(projection.answer)
  const [answerSaveNotice, setAnswerSaveNotice] = useState('')
  const [isSavingAnswer, setIsSavingAnswer] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionLimitOpen, setConversionLimitOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedGift || selectedGift.type !== 'question' || answer === null || !answer.answerText.trim()) return
    const timer = window.setTimeout(() => {
      void saveGiftAnswer(selectedGift.id, answer.answerText, answer.isDone).then((saved) => { setAnswer(saved); setAnswerSaveNotice('Đã lưu') }).catch(() => setAnswerSaveNotice('Chưa lưu được — nội dung vẫn còn ở đây.'))
    }, 550)
    return () => window.clearTimeout(timer)
  }, [answer, selectedGift])

  if (!gift) return null
  const style = gift.boxStyleSnapshot ?? { id: gift.boxStyleId, name: 'Món quà nhiều màu', palette: ['#56D6B1', '#FF806B'], ribbon: '#FF806B', shape: 'square' as const, config: { seal: '✦' } }
  const opened = Boolean(gift.openedAt) && !isOpening

  const showGift = (nextGift: GiftRecord, existingAnswer = projection.answer) => {
    const openedGift = { ...nextGift, openedAt: nextGift.openedAt ?? new Date().toISOString() }
    setSelectedGift(openedGift)
    setAnswer(nextGift.type === 'question' ? existingAnswer : null)
    setAnswerSaveNotice('')
    setConversionLimitOpen(false)
    if (nextGift.type === 'question') void getGiftAnswer(nextGift.id).then((saved) => setAnswer(saved ?? existingAnswer ?? emptyAnswer(nextGift.id))).catch(() => setAnswer(existingAnswer ?? emptyAnswer(nextGift.id)))
  }

  const open = async () => {
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
    try {
      const result = await convertGiftQuestionToDiary(selectedGift, answer)
      setSelectedGift(null)
      navigate(`/diary?view=editor&date=${result.diary.localDate}`)
    } catch (reason: unknown) {
      if (reason instanceof DiaryPromptLimitError) setConversionLimitOpen(true)
      setAnswerSaveNotice(giftUserError(reason, 'Chưa thể đưa vào nhật ký.'))
    } finally { setIsConverting(false) }
  }

  const updateAnswer = (patch: Partial<GiftQuestionAnswer>) => setAnswer((current) => ({ ...emptyAnswer(selectedGift?.id ?? gift.id), ...current, ...patch }))
  const updateReceipt = async (status: 'received' | 'declined') => {
    if (!selectedGift) return
    try { const updated = await setGiftReceipt(selectedGift.id, status); setSelectedGift(updated); onChanged?.() } catch (reason: unknown) { setAnswerSaveNotice(giftUserError(reason, 'Chưa lưu được phản hồi.')) }
  }

  return <section className={`gift-delivery-card ${opened ? 'is-opened' : ''}`} aria-labelledby="gift-delivery-title">
    <div className="gift-delivery-card__copy"><p className="eyebrow">Gift for Tomorrow · Hôm nay</p><h2 id="gift-delivery-title">Có một món quà đang đợi bạn.</h2><p>Được gửi từ chính bạn của ngày hôm qua, dành cho ngày hôm nay.</p>{opened ? <div className="gift-delivery-card__message"><span className="gift-delivery-card__type">{gift.type === 'question' ? 'Một câu hỏi để gặp lại mình' : 'Một lời nhắn dịu dàng'}</span><strong>{gift.type === 'question' ? gift.questionText : gift.messageText}</strong>{gift.emotionSnapshot && <small>{gift.emotionSnapshot.emoji} {gift.emotionSnapshot.emotion_name_vn}</small>}<button className="button button--secondary button--small" type="button" onClick={() => showGift(gift)}>Xem lại quà</button></div> : <button className="button button--primary" type="button" onClick={() => void open()} disabled={isOpening}>{isOpening ? 'Đang mở…' : 'Mở quà'} <span aria-hidden="true">→</span></button>}<small className="gift-delivery-card__time">Đến lúc {gift.deliveredAt ? formatGiftDateTime(gift.deliveredAt) : formatGiftDate(gift.creationLocalDate)}</small></div>
    <div className={`gift-delivery-card__art ${isOpening ? 'is-opening' : ''}`}><GiftBoxArt style={style} opened={opened} /></div>
    <div className="gift-receipt" aria-label="Phản hồi món quà"><span>Bạn thấy món quà này thế nào?</span><div><button type="button" className={gift.receiptStatus === 'received' ? 'is-selected' : ''} onClick={() => void (selectedGift ? updateReceipt('received') : setGiftReceipt(gift.id, 'received').then(() => onChanged?.()).catch((reason: unknown) => setError(giftUserError(reason, 'Không thể lưu phản hồi.'))))}>Mình đã nhận được quà rồi</button><button type="button" className={gift.receiptStatus === 'declined' ? 'is-selected' : ''} onClick={() => void (selectedGift ? updateReceipt('declined') : setGiftReceipt(gift.id, 'declined').then(() => onChanged?.()).catch((reason: unknown) => setError(giftUserError(reason, 'Không thể lưu phản hồi.'))))}>Không nhận nữa đâu!</button></div>{gift.receiptStatus !== 'pending' && <small>{gift.receiptStatus === 'received' ? 'Đã nhận' : 'Không nhận'} · Bạn có thể đổi lựa chọn bất cứ lúc nào</small>}</div>
    {error && <p className="gift-inline-error" role="alert">{error}</p>}
    {selectedGift && <GiftReadPanel gift={selectedGift} answer={answer} answerSaveNotice={answerSaveNotice} isConverting={isConverting} isSavingAnswer={isSavingAnswer} onAnswerChange={updateAnswer} onSaveAnswer={() => void saveAnswerNow()} onReceipt={updateReceipt} onConvert={() => void convertToDiary()} onClose={() => setSelectedGift(null)} />}
    {conversionLimitOpen && <div className="gift-read-backdrop" role="presentation" onClick={() => setConversionLimitOpen(false)}><section className="gift-read-panel gift-limit-panel" role="dialog" aria-modal="true" aria-labelledby="gift-delivery-limit-title" onClick={(event) => event.stopPropagation()}><button className="gift-modal__close" type="button" onClick={() => setConversionLimitOpen(false)} aria-label="Đóng">×</button><p className="eyebrow">Giữ nguyên những dòng bạn đã chọn</p><h2 id="gift-delivery-limit-title">Diary đã đủ 6 prompt</h2><p>Hãy bỏ hoặc thay một prompt trước. Mình không xoá prompt nào tự động.</p><div className="gift-limit-panel__actions"><button className="button button--secondary" type="button" onClick={() => setConversionLimitOpen(false)}>Để sau</button><button className="button button--primary" type="button" onClick={() => { setConversionLimitOpen(false); setSelectedGift(null); navigate(`/diary?view=editor&date=${selectedGift?.deliveredAt ? getGiftLocalDate(new Date(selectedGift.deliveredAt)) : gift.creationLocalDate}`) }}>Mở Diary để thay prompt</button></div></section></div>}
  </section>
}
