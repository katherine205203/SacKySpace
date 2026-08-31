import type { GiftHistoryFilter, GiftRecord, GiftStatus } from './types'

export const GIFT_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const GIFT_CUTOFF_HOUR = 23
export const GIFT_CUTOFF_MINUTE = 30
export const GIFT_DELIVERY_HOUR = 3

export const getGiftLocalDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: GIFT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const fromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export const addGiftDays = (dateKey: string, amount: number): string => {
  const date = fromDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export const getGiftCutoffAt = (localDate: string, localTime = '23:30'): Date => new Date(`${localDate}T${localTime}:00+07:00`)
export const getGiftDeliveryAt = (localDate: string): Date => new Date(`${addGiftDays(localDate, 1)}T03:00:00+07:00`)

export const isGiftEditable = (gift: Pick<GiftRecord, 'status' | 'lockedAt'>, now = new Date()): boolean =>
  gift.status === 'draft' || (gift.status === 'sent' && (!gift.lockedAt || now < new Date(gift.lockedAt)))

export const deriveGiftStatus = (gift: Pick<GiftRecord, 'status' | 'deliverAt'>, now = new Date()): GiftStatus =>
  gift.status === 'sent' && gift.deliverAt && now >= new Date(gift.deliverAt) ? 'delivered' : gift.status

export const isGiftOnHome = (gift: Pick<GiftRecord, 'status' | 'deliveredAt' | 'deliverAt'>, now = new Date(), expiryLocalTime = '23:30'): boolean => {
  const status = deriveGiftStatus(gift, now)
  if (status !== 'delivered' || !gift.deliveredAt) return false
  const deliveryDate = getGiftLocalDate(new Date(gift.deliveredAt))
  return now < getGiftCutoffAt(deliveryDate, expiryLocalTime)
}

export const isGiftInHistory = (gift: Pick<GiftRecord, 'status' | 'deliveredAt'>, now = new Date(), expiryLocalTime = '23:30'): boolean => {
  if (gift.status !== 'delivered' || !gift.deliveredAt) return false
  return !isGiftOnHome({ ...gift, deliverAt: gift.deliveredAt }, now, expiryLocalTime)
}

export const isGiftFilterMatch = (gift: GiftRecord, filter: GiftHistoryFilter): boolean => {
  if (filter === 'all') return true
  if (filter === 'question' || filter === 'message') return gift.type === filter
  if (filter === 'unopened') return gift.openedAt === null
  return gift.receiptStatus === filter
}

export const formatGiftDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: GIFT_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value.length === 10 ? `${value}T12:00:00+07:00` : value}`))
export const formatGiftDateTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { timeZone: GIFT_TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

export const createGiftId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `gift-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const statusLabel = (status: GiftStatus): string => ({ draft: 'Bản nháp', sent: 'Đã gửi', delivered: 'Đã đến' })[status]
export const receiptLabel = (status: GiftRecord['receiptStatus']): string => ({ pending: 'Chưa phản hồi', received: 'Đã nhận', declined: 'Không nhận' })[status]

export const giftUserError = (reason: unknown, fallback: string): string => {
  const message = reason instanceof Error ? reason.message : ''
  if (!message || /relation|column|schema|PGRST|postgres|function|permission|foreign key|violates/i.test(message)) return fallback
  return message
}
