import { supabase } from '../../../services/supabase/client'
import { getPublishedRuntimeValue } from '../../../services/runtimeConfig'
import { getDiaryEntry, saveDiary } from '../../diary/services/diaryRepository'
import { createEmptyDiaryDraft } from '../../diary/services/diaryRepository'
import type { DiaryEntry, DiaryPrompt } from '../../diary/types'
import { createGiftId, getGiftLocalDate, isGiftOnHome } from '../utils'
import type { DiaryConversionLink, GiftBoxStyle, GiftDraft, GiftHomeProjection, GiftQuestionAnswer, GiftReceiptStatus, GiftRecord, GiftType } from '../types'

type GiftRow = {
  id: string
  user_id: string
  creation_local_date: string
  type: GiftType
  status: GiftRecord['status']
  question_text: string | null
  message_text: string | null
  emotion_id: string | null
  emotion_snapshot: GiftRecord['emotionSnapshot']
  box_style_id: string
  box_style_snapshot: GiftBoxStyle | null
  sent_at: string | null
  locked_at: string | null
  deliver_at: string | null
  delivered_at: string | null
  opened_at: string | null
  receipt_status: GiftReceiptStatus
  created_at: string
  updated_at: string
}

type GiftAnswerRow = { gift_id: string; answer_text: string; is_done: boolean; answered_at: string | null; updated_at: string }
type GiftConversionRow = { gift_id: string; diary_id: string; diary_prompt_response_id: string | null; converted_at: string }
type StyleRow = { id: string; name: string; palette: string[]; ribbon: string; shape: GiftBoxStyle['shape']; config: Record<string, unknown> }

let giftDraftQueue: Promise<void> = Promise.resolve()
const knownGifts = new Map<string, GiftRecord>()

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Bạn cần đăng nhập để dùng Gift for Tomorrow.')
  return data.user.id
}

const selectGift = 'id, user_id, creation_local_date, type, status, question_text, message_text, emotion_id, emotion_snapshot, box_style_id, box_style_snapshot, sent_at, locked_at, deliver_at, delivered_at, opened_at, receipt_status, created_at, updated_at'

const mapGift = (row: GiftRow): GiftRecord => ({
  id: row.id, userId: row.user_id, creationLocalDate: row.creation_local_date, type: row.type, status: row.status,
  questionText: row.question_text, messageText: row.message_text, emotionId: row.emotion_id, emotionSnapshot: row.emotion_snapshot,
  boxStyleId: row.box_style_id, boxStyleSnapshot: row.box_style_snapshot, sentAt: row.sent_at, lockedAt: row.locked_at,
  deliverAt: row.deliver_at, deliveredAt: row.delivered_at, openedAt: row.opened_at, receiptStatus: row.receipt_status,
  createdAt: row.created_at, updatedAt: row.updated_at,
})

const mapAnswer = (row: GiftAnswerRow): GiftQuestionAnswer => ({ giftId: row.gift_id, answerText: row.answer_text, isDone: row.is_done, answeredAt: row.answered_at, updatedAt: row.updated_at })
const mapConversion = (row: GiftConversionRow): DiaryConversionLink => ({ giftId: row.gift_id, diaryId: row.diary_id, diaryPromptResponseId: row.diary_prompt_response_id, convertedAt: row.converted_at })

export const listGiftBoxStyles = async (): Promise<GiftBoxStyle[]> => {
  const { data, error } = await supabase.from('gift_box_styles').select('id, name, palette, ribbon, shape, config').eq('active', true).order('sort_order')
  if (error) throw error
  return ((data ?? []) as StyleRow[]).map((row) => ({ id: row.id, name: row.name, palette: row.palette, ribbon: row.ribbon, shape: row.shape, config: row.config ?? {} }))
}

export const syncGiftLifecycle = async (): Promise<void> => {
  const { error } = await supabase.rpc('sync_gift_lifecycle')
  if (error) throw error
}

export const listGifts = async (): Promise<GiftRecord[]> => {
  const userId = await currentUserId()
  await syncGiftLifecycle()
  const { data, error } = await supabase.from('gifts').select(selectGift).eq('user_id', userId).order('creation_local_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  const records = ((data ?? []) as GiftRow[]).map(mapGift)
  records.forEach((gift) => knownGifts.set(gift.id, gift))
  return records
}

export const getTodayGift = async (): Promise<GiftRecord | null> => (await listGifts()).find((gift) => gift.creationLocalDate === getGiftLocalDate() && gift.status !== 'delivered') ?? null

export const createGiftDraft = async (type: GiftType = 'question'): Promise<GiftRecord> => {
  const userId = await currentUserId()
  const localDate = getGiftLocalDate()
  const existing = [...knownGifts.values()].find((gift) => gift.userId === userId && gift.creationLocalDate === localDate)
  if (existing) return existing
  const now = new Date().toISOString()
  const draft: GiftRecord = { id: createGiftId(), userId, creationLocalDate: localDate, type, status: 'draft', questionText: null, messageText: null, emotionId: null, emotionSnapshot: null, boxStyleId: 'box-mint-coral', boxStyleSnapshot: null, sentAt: null, lockedAt: null, deliverAt: null, deliveredAt: null, openedAt: null, receiptStatus: 'pending', createdAt: now, updatedAt: now }
  knownGifts.set(draft.id, draft)
  enqueueGiftDraft(draft)
  return draft
}

const giftDraftPayload = (gift: GiftRecord) => ({ id: gift.id, user_id: gift.userId, creation_local_date: gift.creationLocalDate, type: gift.type, status: gift.status, question_text: gift.questionText, message_text: gift.messageText, emotion_id: gift.emotionId, emotion_snapshot: gift.emotionSnapshot, box_style_id: gift.boxStyleId, box_style_snapshot: gift.boxStyleSnapshot })

const enqueueGiftDraft = (gift: GiftRecord): void => {
  giftDraftQueue = giftDraftQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const { data, error } = await supabase.from('gifts').upsert(giftDraftPayload(gift), { onConflict: 'id' }).select(selectGift).single()
        if (error) throw error
        if (data) knownGifts.set(gift.id, mapGift(data as GiftRow))
      } catch { /* The local draft remains available until the next successful sync. */ }
    })
}

export const flushGiftDraftPersistence = async (): Promise<void> => { await giftDraftQueue.catch(() => undefined) }
export const rememberGiftDraft = (gift: GiftRecord): void => { knownGifts.set(gift.id, gift) }

export const saveGiftDraft = async (draft: GiftDraft): Promise<GiftRecord> => {
  const userId = await currentUserId()
  const existing = draft.id ? knownGifts.get(draft.id) : null
  const gift = existing ?? await createGiftDraft(draft.type)
  if (gift.status !== 'draft' && !(gift.status === 'sent' && (!gift.lockedAt || new Date() < new Date(gift.lockedAt)))) throw new Error('Món quà này đã khóa và không thể sửa nữa.')
  const next: GiftRecord = { ...gift, userId, type: draft.type, questionText: draft.type === 'question' ? draft.questionText : null, messageText: draft.type === 'message' ? draft.messageText : null, emotionId: draft.emotionId, emotionSnapshot: draft.emotionSnapshot, boxStyleId: draft.boxStyleId, boxStyleSnapshot: draft.boxStyleSnapshot, updatedAt: new Date().toISOString() }
  knownGifts.set(next.id, next)
  enqueueGiftDraft(next)
  return next
}

export const sendGift = async (draft: GiftDraft): Promise<GiftRecord> => {
  if (draft.type === 'question' && !draft.questionText.trim()) throw new Error('Hãy viết câu hỏi trước khi gửi.')
  if (draft.type === 'message' && !draft.messageText.trim()) throw new Error('Hãy viết lời nhắn trước khi gửi.')
  const gift = await saveGiftDraft(draft)
  await flushGiftDraftPersistence()
  const { data, error } = await supabase.rpc('send_gift', { p_gift_id: gift.id, p_question_text: draft.type === 'question' ? draft.questionText.trim() : null, p_message_text: draft.type === 'message' ? draft.messageText.trim() : null, p_emotion_id: draft.emotionId, p_emotion_snapshot: draft.emotionSnapshot, p_box_style_id: draft.boxStyleId, p_box_style_snapshot: draft.boxStyleSnapshot })
  if (error) throw error
  return mapGift(data as GiftRow)
}

export const getGiftAnswer = async (giftId: string): Promise<GiftQuestionAnswer | null> => {
  const { data, error } = await supabase.from('gift_question_answers').select('gift_id, answer_text, is_done, answered_at, updated_at').eq('gift_id', giftId).maybeSingle()
  if (error) throw error
  return data ? mapAnswer(data as GiftAnswerRow) : null
}

export const saveGiftAnswer = async (giftId: string, answerText: string, isDone: boolean): Promise<GiftQuestionAnswer> => {
  const { data, error } = await supabase.from('gift_question_answers').upsert({ gift_id: giftId, answer_text: answerText, is_done: isDone, answered_at: answerText.trim() ? new Date().toISOString() : null }, { onConflict: 'gift_id' }).select('gift_id, answer_text, is_done, answered_at, updated_at').single()
  if (error) throw error
  return mapAnswer(data as GiftAnswerRow)
}

export const getGiftDiaryConversion = async (giftId: string): Promise<DiaryConversionLink | null> => {
  const { data, error } = await supabase.from('gift_diary_conversion_links').select('gift_id, diary_id, diary_prompt_response_id, converted_at').eq('gift_id', giftId).maybeSingle()
  if (error) throw error
  return data ? mapConversion(data as GiftConversionRow) : null
}

export const setGiftOpened = async (giftId: string): Promise<GiftRecord> => {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('gifts').update({ opened_at: new Date().toISOString() }).eq('id', giftId).eq('user_id', userId).eq('status', 'delivered').select(selectGift).single()
  if (error) throw error
  return mapGift(data as GiftRow)
}

export const setGiftReceipt = async (giftId: string, receiptStatus: Exclude<GiftReceiptStatus, 'pending'>): Promise<GiftRecord> => {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('gifts').update({ receipt_status: receiptStatus }).eq('id', giftId).eq('user_id', userId).eq('status', 'delivered').select(selectGift).single()
  if (error) throw error
  return mapGift(data as GiftRow)
}

export class DiaryPromptLimitError extends Error {
  readonly code = 'DIARY_PROMPT_LIMIT'

  constructor() {
    super('Diary đã có đủ 6 prompt. Hãy bỏ hoặc thay một prompt trước khi thêm Quà cho ngày mai.')
    this.name = 'DiaryPromptLimitError'
  }
}

const giftPrompt = (gift: GiftRecord): DiaryPrompt => ({
  id: `gift:${gift.id}`,
  code: 'gift_for_tomorrow',
  textVn: gift.questionText?.trim() || 'Câu hỏi từ Quà cho ngày mai',
  textEn: 'Gift for Tomorrow',
  emoji: gift.emotionSnapshot?.emoji ?? '🎁',
  hexColor: gift.emotionSnapshot?.color_hex ?? '#743CFF',
  description: 'Từ Quà cho ngày mai',
  source: 'gift_for_tomorrow',
  sourceGiftId: gift.id,
})

export const convertGiftQuestionToDiary = async (gift: GiftRecord, answer: GiftQuestionAnswer): Promise<{ diary: DiaryEntry; link: DiaryConversionLink; created: boolean }> => {
  if (gift.type !== 'question') throw new Error('Chỉ câu hỏi mới có thể chuyển sang Diary.')
  if (!answer.answerText.trim()) throw new Error('Hãy viết câu trả lời trước khi chuyển sang Diary.')
  const deliveryDate = gift.deliveredAt ? getGiftLocalDate(new Date(gift.deliveredAt)) : getGiftLocalDate()
  const existing = await getDiaryEntry(deliveryDate)
  const prompt = giftPrompt(gift)
  const existingGiftResponse = existing?.promptResponses.find((response) => response.promptSnapshot.sourceGiftId === gift.id)
  if (existing && existingGiftResponse) {
    const nextResponse = { ...existingGiftResponse, responseText: answer.answerText.trim(), isDone: answer.isDone }
    const diary = existingGiftResponse.responseText === nextResponse.responseText && existingGiftResponse.isDone === nextResponse.isDone
      ? existing
      : await saveDiary({ ...existing, promptResponses: existing.promptResponses.map((response) => response.promptSnapshot.sourceGiftId === gift.id ? nextResponse : response) })
    const { data: linkRow, error } = await supabase.from('gift_diary_conversion_links').upsert({ gift_id: gift.id, diary_id: diary.id, diary_prompt_response_id: null }, { onConflict: 'gift_id' }).select('gift_id, diary_id, diary_prompt_response_id, converted_at').single()
    if (error) throw error
    return { diary, created: false, link: mapConversion(linkRow as GiftConversionRow) }
  }
  if (existing && existing.promptResponses.length >= 6) throw new DiaryPromptLimitError()
  const base = existing ?? createEmptyDiaryDraft(deliveryDate)
  const diary = await saveDiary({
    ...base,
    status: existing?.status ?? 'draft',
    promptResponses: [...base.promptResponses, { promptId: null, promptSnapshot: prompt, position: base.promptResponses.length + 1, responseText: answer.answerText.trim(), isDone: answer.isDone }],
  })
  const { data: linkRow, error } = await supabase.from('gift_diary_conversion_links').upsert({ gift_id: gift.id, diary_id: diary.id, diary_prompt_response_id: null }, { onConflict: 'gift_id' }).select('gift_id, diary_id, diary_prompt_response_id, converted_at').single()
  if (error) throw error
  return { diary, created: !existing, link: mapConversion(linkRow as GiftConversionRow) }
}

export const getGiftHomeProjection = async (userId?: string): Promise<GiftHomeProjection> => {
  try {
    const effectiveUserId = userId ?? await currentUserId()
    await syncGiftLifecycle()
    const { data, error } = await supabase.from('gifts').select(selectGift).eq('user_id', effectiveUserId).order('creation_local_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    const records = ((data ?? []) as GiftRow[]).map(mapGift)
    const homeExpiry = await getPublishedRuntimeValue('gift.home_expiry_local_time', '23:30')
    const gift = records.find((record) => isGiftOnHome(record, new Date(), homeExpiry)) ?? null
    const todayGift = records.find((record) => record.creationLocalDate === getGiftLocalDate()) ?? null
    const answer = gift ? await getGiftAnswer(gift.id) : null
    return { gift, todayGift, answer }
  } catch {
    return { gift: null, todayGift: null, answer: null }
  }
}
