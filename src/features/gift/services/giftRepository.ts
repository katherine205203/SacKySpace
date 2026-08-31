import { supabase } from '../../../services/supabase/client'
import { getPublishedRuntimeValue } from '../../../services/runtimeConfig'
import { getDiaryEntry, listDiaryPrompts, saveDiary } from '../../diary/services/diaryRepository'
import { createEmptyDiaryDraft } from '../../diary/services/diaryRepository'
import type { DiaryEntry } from '../../diary/types'
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

export const convertGiftQuestionToDiary = async (gift: GiftRecord, answer: GiftQuestionAnswer): Promise<{ diary: DiaryEntry; link: DiaryConversionLink }> => {
  if (gift.type !== 'question') throw new Error('Chỉ câu hỏi mới có thể chuyển sang Diary.')
  if (!answer.answerText.trim()) throw new Error('Hãy viết câu trả lời trước khi chuyển sang Diary.')
  const deliveryDate = gift.deliveredAt ? getGiftLocalDate(new Date(gift.deliveredAt)) : getGiftLocalDate()
  if (await getDiaryEntry(deliveryDate)) throw new Error('Ngày này đã có một bài Diary. Mình giữ nguyên bài viết hiện có.')
  const prompts = await listDiaryPrompts()
  const prompt = prompts[0]
  const base = createEmptyDiaryDraft(deliveryDate)
  const diary = await saveDiary({ ...base, title: 'Quà cho ngày mai', overallText: `${gift.questionText ?? 'Câu hỏi từ món quà'}\n\n${answer.answerText.trim()}`, status: 'done', promptResponses: prompt ? [{ promptId: prompt.id, promptSnapshot: prompt, position: 1, responseText: answer.answerText.trim(), isDone: true }] : [] })
  const { data: responseRow } = await supabase.from('diary_prompt_responses').select('diary_id, prompt_id').eq('diary_id', diary.id).limit(1).maybeSingle()
  const promptResponseKey = responseRow ? `${responseRow.diary_id}:${responseRow.prompt_id}` : null
  const { data: linkRow, error } = await supabase.from('gift_diary_conversion_links').upsert({ gift_id: gift.id, diary_id: diary.id, diary_prompt_response_id: promptResponseKey }, { onConflict: 'gift_id' }).select('gift_id, diary_id, diary_prompt_response_id, converted_at').single()
  if (error) throw error
  const row = linkRow as { gift_id: string; diary_id: string; diary_prompt_response_id: string | null; converted_at: string }
  return { diary, link: { giftId: row.gift_id, diaryId: row.diary_id, diaryPromptResponseId: row.diary_prompt_response_id, convertedAt: row.converted_at } }
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
