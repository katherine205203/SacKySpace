import { useState } from 'react'
import { Link } from 'react-router-dom'
import { setGiftOpened, setGiftReceipt } from '../services/giftRepository'
import { formatGiftDate, formatGiftDateTime, giftUserError } from '../utils'
import type { GiftHomeProjection } from '../types'
import { GiftBoxArt } from './GiftBoxArt'

type GiftDeliveryCardProps = { projection: GiftHomeProjection; onChanged?: () => void }

export function GiftDeliveryCard({ projection, onChanged }: GiftDeliveryCardProps) {
  const gift = projection.gift
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!gift) return null
  const style = gift.boxStyleSnapshot ?? { id: gift.boxStyleId, name: 'Món quà nhiều màu', palette: ['#56D6B1', '#FF806B'], ribbon: '#FF806B', shape: 'square' as const, config: { seal: '✦' } }
  const opened = Boolean(gift.openedAt) && !isOpening
  const open = async () => {
    if (gift.openedAt || isOpening) return
    setIsOpening(true)
    window.setTimeout(() => {
      void setGiftOpened(gift.id).then(() => { setIsOpening(false); onChanged?.() }).catch((reason: unknown) => { setIsOpening(false); setError(giftUserError(reason, 'Không thể mở món quà lúc này.')) })
    }, 1100)
  }
  const setReceipt = async (status: 'received' | 'declined') => {
    try { await setGiftReceipt(gift.id, status); onChanged?.() } catch (reason: unknown) { setError(giftUserError(reason, 'Không thể lưu phản hồi.')) }
  }
  return <section className={`gift-delivery-card ${opened ? 'is-opened' : ''}`} aria-labelledby="gift-delivery-title">
    <div className="gift-delivery-card__copy"><p className="eyebrow">Gift for Tomorrow · Hôm nay</p><h2 id="gift-delivery-title">Có một món quà đang đợi bạn.</h2><p>Được gửi từ chính bạn của ngày hôm qua, dành cho ngày hôm nay.</p>{opened ? <div className="gift-delivery-card__message"><span className="gift-delivery-card__type">{gift.type === 'question' ? 'Một câu hỏi để gặp lại mình' : 'Một lời nhắn dịu dàng'}</span><strong>{gift.type === 'question' ? gift.questionText : gift.messageText}</strong>{gift.emotionSnapshot && <small>{gift.emotionSnapshot.emoji} {gift.emotionSnapshot.emotion_name_vn}</small>}{gift.type === 'question' && <Link className="button button--secondary button--small" to="/gift-for-tmr">Viết câu trả lời</Link>}</div> : <button className="button button--primary" type="button" onClick={() => void open()} disabled={isOpening}>{isOpening ? 'Đang mở…' : 'Mở quà'} <span aria-hidden="true">→</span></button>}<small className="gift-delivery-card__time">Đến lúc {gift.deliveredAt ? formatGiftDateTime(gift.deliveredAt) : formatGiftDate(gift.creationLocalDate)}</small></div>
    <div className={`gift-delivery-card__art ${isOpening ? 'is-opening' : ''}`}><GiftBoxArt style={style} opened={opened} /></div>
    <div className="gift-receipt" aria-label="Phản hồi món quà"><span>Bạn thấy món quà này thế nào?</span><div><button type="button" className={gift.receiptStatus === 'received' ? 'is-selected' : ''} onClick={() => void setReceipt('received')}>Mình đã nhận được quà rồi</button><button type="button" className={gift.receiptStatus === 'declined' ? 'is-selected' : ''} onClick={() => void setReceipt('declined')}>Không nhận nữa đâu!</button></div>{gift.receiptStatus !== 'pending' && <small>{gift.receiptStatus === 'received' ? 'Đã nhận' : 'Không nhận'} · Bạn có thể đổi lựa chọn bất cứ lúc nào</small>}</div>
    {error && <p className="gift-inline-error" role="alert">{error}</p>}
  </section>
}
