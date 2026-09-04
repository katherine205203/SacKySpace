import { receiptLabel } from '../utils'
import type { DiaryConversionLink, GiftQuestionAnswer, GiftRecord } from '../types'

type GiftReadPanelProps = {
  gift: GiftRecord
  answer: GiftQuestionAnswer | null
  answerSaveNotice: string
  isConverting: boolean
  isSavingAnswer?: boolean
  onAnswerChange: (patch: Partial<GiftQuestionAnswer>) => void
  onSaveAnswer?: () => void
  onReceipt: (status: 'received' | 'declined') => Promise<void>
  onConvert: () => void
  conversionLink?: DiaryConversionLink | null
  onViewDiary?: () => void
  onClose: () => void
}

export function GiftReadPanel({ gift, answer, answerSaveNotice, isConverting, isSavingAnswer = false, onAnswerChange, onSaveAnswer, onReceipt, onConvert, conversionLink = null, onViewDiary, onClose }: GiftReadPanelProps) {
  const hasAnswer = Boolean(answer?.answerText.trim())
  return <div className="gift-read-backdrop" role="presentation" onClick={onClose}><section className="gift-read-panel" role="dialog" aria-modal="true" aria-labelledby="gift-read-title" onClick={(event) => event.stopPropagation()}><button className="gift-modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button><p className="eyebrow">{gift.type === 'question' ? 'Câu hỏi từ hôm qua' : 'Lời nhắn từ hôm qua'}</p><h2 id="gift-read-title">{gift.type === 'question' ? gift.questionText : 'Một lời nhắn dành cho hôm nay'}</h2>{gift.emotionSnapshot && <span className="gift-read-emotion">{gift.emotionSnapshot.emoji} {gift.emotionSnapshot.emotion_name_vn}</span>}{gift.type === 'question' && <div className="gift-answer"><label htmlFor="gift-answer">Câu trả lời của mình</label><textarea id="gift-answer" rows={7} value={answer?.answerText ?? ''} onChange={(event) => onAnswerChange({ answerText: event.target.value, answeredAt: event.target.value.trim() ? new Date().toISOString() : null })} placeholder="Không cần thật hay. Chỉ cần thật với mình." /><div className="gift-answer__footer"><label><input type="checkbox" checked={answer?.isDone ?? false} onChange={(event) => onAnswerChange({ isDone: event.target.checked })} /> Mình đã trả lời xong</label><small>{answerSaveNotice || 'Tự động lưu'}</small></div><div className="gift-answer__actions"><button className="button button--secondary button--small" type="button" onClick={onSaveAnswer} disabled={!onSaveAnswer || !hasAnswer || isSavingAnswer}>{isSavingAnswer ? 'Đang lưu…' : 'Lưu câu trả lời'}</button>{hasAnswer && (conversionLink ? <><button className="button button--primary button--small" type="button" onClick={onViewDiary} disabled={!onViewDiary}>✓ Đã đưa vào nhật ký · Xem nhật ký</button><button className="button button--secondary button--small" type="button" onClick={onConvert} disabled={isConverting}>{isConverting ? 'Đang cập nhật…' : 'Cập nhật câu trả lời'}</button></> : <button className="button button--primary button--small" type="button" onClick={onConvert} disabled={isConverting}>{isConverting ? 'Đang chuyển…' : 'Đưa vào nhật ký'}</button>)}</div></div>}{gift.type === 'message' && <div className="gift-message-read"><span className="section-label">Lời nhắn dành cho hôm nay</span><p>{gift.messageText}</p></div>}<div className="gift-read-receipt"><span>Phản hồi món quà</span><button type="button" className={gift.receiptStatus === 'received' ? 'is-selected' : ''} onClick={() => void onReceipt('received')}>Mình đã nhận được quà rồi</button><button type="button" className={gift.receiptStatus === 'declined' ? 'is-selected' : ''} onClick={() => void onReceipt('declined')}>Không nhận nữa đâu!</button><small>{gift.receiptStatus === 'pending' ? 'Bạn có thể đổi lựa chọn bất cứ lúc nào.' : receiptLabel(gift.receiptStatus)}</small></div></section></div>
}
