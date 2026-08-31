import { supabase } from '../../../services/supabase/client'
import { createDiaryId, getDiaryLocalDate } from '../utils'
import { DEFAULT_DIARY_PROMPTS } from '../prompts'
import type { DiaryDraft, DiaryEntry, DiaryPrompt, DiaryStatus } from '../types'

const LOCAL_STORAGE_PREFIX = 'sacky:diary:v2:'

type DiaryEntryRow = {
  id: string
  user_id: string
  local_date: string
  status: DiaryStatus
  title: string
  overall_text: string
  daily_emotion_id: string | null
  daily_emotion_snapshot: DiaryEntry['dailyEmotionSnapshot']
  created_at: string
  updated_at: string
  completed_at: string | null
}

type DiaryPromptRow = {
  id: string
  code: string
  text_vn: string
  text_en: string | null
  emoji: string
  hex_color: string
  description: string | null
}

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to use Diary.')
  return data.user.id
}

const toPrompt = (row: DiaryPromptRow): DiaryPrompt => ({
  id: row.id,
  code: row.code,
  textVn: row.text_vn,
  textEn: row.text_en ?? undefined,
  emoji: row.emoji,
  hexColor: row.hex_color,
  description: row.description ?? undefined,
})

const promptFromUnknown = (value: unknown): DiaryPrompt | null => {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<DiaryPrompt>
  if (typeof item.id !== 'string' || typeof item.textVn !== 'string') return null
  return {
    id: item.id,
    code: typeof item.code === 'string' ? item.code : item.id,
    textVn: item.textVn,
    textEn: typeof item.textEn === 'string' ? item.textEn : undefined,
    emoji: typeof item.emoji === 'string' ? item.emoji : '✦',
    hexColor: typeof item.hexColor === 'string' ? item.hexColor : '#9B5DE5',
    description: typeof item.description === 'string' ? item.description : undefined,
  }
}

const loadPromptsFromServer = async (): Promise<DiaryPrompt[]> => {
  const { data, error } = await supabase
    .from('diary_prompts')
    .select('id, code, text_vn, text_en, emoji, hex_color, description')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return ((data ?? []) as DiaryPromptRow[]).map(toPrompt)
}

export const listDiaryPrompts = async (): Promise<DiaryPrompt[]> => {
  try {
    const prompts = await loadPromptsFromServer()
    const canonicalIds = new Set(DEFAULT_DIARY_PROMPTS.map((prompt) => prompt.id))
    const hasCanonicalSet = prompts.length === DEFAULT_DIARY_PROMPTS.length && prompts.every((prompt) => canonicalIds.has(prompt.id))
    return hasCanonicalSet ? prompts : DEFAULT_DIARY_PROMPTS
  } catch {
    return DEFAULT_DIARY_PROMPTS
  }
}

const readLocalEntries = (userId: string): DiaryEntry[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is DiaryEntry => Boolean(entry && typeof entry === 'object' && typeof (entry as DiaryEntry).localDate === 'string' && (entry as DiaryEntry).status !== 'deleted'))
  } catch {
    return []
  }
}

const writeLocalEntries = (userId: string, entries: DiaryEntry[]): void => {
  try {
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(entries.filter((entry) => entry.status !== 'deleted')))
  } catch {
    // The remote record remains authoritative when local storage is unavailable.
  }
}

const mapRemoteEntry = (
  row: DiaryEntryRow,
  promptRows: Array<{ diary_id: string; prompt_id: string; prompt_snapshot: unknown; position: number; response_text: string; is_done: boolean }>,
  linkRows: Array<{ diary_id: string; checkin_id: string; weight_percent: number; position: number }>,
  imageRows: Array<{ id: string; diary_id: string; external_file_id: string | null; external_url: string; position: number; caption: string | null; metadata: Record<string, unknown> | null }>,
): DiaryEntry => ({
  id: row.id,
  userId: row.user_id,
  localDate: row.local_date,
  status: row.status,
  title: row.title,
  overallText: row.overall_text,
  dailyEmotionId: row.daily_emotion_id,
  dailyEmotionSnapshot: row.daily_emotion_snapshot,
  promptResponses: promptRows
    .filter((item) => item.diary_id === row.id)
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      promptId: item.prompt_id,
      promptSnapshot: promptFromUnknown(item.prompt_snapshot) ?? DEFAULT_DIARY_PROMPTS.find((prompt) => prompt.id === item.prompt_id) ?? DEFAULT_DIARY_PROMPTS[0],
      position: item.position,
      responseText: item.response_text,
      isDone: item.is_done,
    })),
  checkinLinks: linkRows
    .filter((item) => item.diary_id === row.id)
    .sort((left, right) => left.position - right.position)
    .map((item) => ({ checkinId: item.checkin_id, weightPercent: item.weight_percent, position: item.position })),
  images: imageRows
    .filter((item) => item.diary_id === row.id)
    .sort((left, right) => left.position - right.position)
    .map((item) => ({ id: item.id, externalFileId: item.external_file_id ?? undefined, externalUrl: item.external_url, position: item.position, caption: item.caption ?? '', metadata: item.metadata ?? undefined })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
})

const listRemoteEntries = async (userId: string): Promise<DiaryEntry[]> => {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('id, user_id, local_date, status, title, overall_text, daily_emotion_id, daily_emotion_snapshot, created_at, updated_at, completed_at')
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('local_date', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as DiaryEntryRow[]
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [promptResult, linkResult, imageResult] = await Promise.all([
    supabase.from('diary_prompt_responses').select('diary_id, prompt_id, prompt_snapshot, position, response_text, is_done').in('diary_id', ids).order('position'),
    supabase.from('diary_checkin_links').select('diary_id, checkin_id, weight_percent, position').in('diary_id', ids).order('position'),
    supabase.from('diary_images').select('id, diary_id, external_file_id, external_url, position, caption, metadata').in('diary_id', ids).order('position'),
  ])
  if (promptResult.error) throw promptResult.error
  if (linkResult.error) throw linkResult.error
  if (imageResult.error) throw imageResult.error
  return rows.map((row) => mapRemoteEntry(row, promptResult.data ?? [], linkResult.data ?? [], imageResult.data ?? []))
}

export const listDiaryEntries = async (): Promise<DiaryEntry[]> => {
  const userId = await currentUserId()
  try {
    const remoteEntries = await listRemoteEntries(userId)
    const localEntries = readLocalEntries(userId)
    const remoteDates = new Set(remoteEntries.map((entry) => entry.localDate))
    const entries = [...remoteEntries, ...localEntries.filter((entry) => !remoteDates.has(entry.localDate))].sort((left, right) => right.localDate.localeCompare(left.localDate))
    writeLocalEntries(userId, entries)
    return entries
  } catch {
    return readLocalEntries(userId)
  }
}

export const getDiaryEntry = async (localDate: string): Promise<DiaryEntry | null> => {
  const entries = await listDiaryEntries()
  return entries.find((entry) => entry.localDate === localDate) ?? null
}

const normalizeDraft = (draft: DiaryDraft, userId: string, existing?: DiaryEntry | null): DiaryEntry => {
  const now = new Date().toISOString()
  const status: DiaryStatus = existing?.status === 'done' && draft.status !== 'deleted' ? 'done' : draft.status
  const completedAt = status === 'done' ? existing?.completedAt ?? draft.completedAt ?? now : null
  return {
    id: draft.id ?? existing?.id ?? createDiaryId(),
    userId,
    localDate: draft.localDate,
    status,
    title: draft.title,
    overallText: draft.overallText,
    dailyEmotionId: draft.dailyEmotionId,
    dailyEmotionSnapshot: draft.dailyEmotionSnapshot,
    promptResponses: draft.promptResponses.map((item, index) => ({ ...item, position: index + 1 })),
    checkinLinks: draft.checkinLinks.filter((item) => item.weightPercent > 0).map((item, index) => ({ ...item, position: index + 1 })),
    images: draft.images.slice(0, 4).map((item, index) => ({ ...item, position: index + 1 })),
    createdAt: existing?.createdAt ?? draft.createdAt ?? now,
    updatedAt: now,
    completedAt,
  }
}

const saveRemoteEntry = async (entry: DiaryEntry): Promise<DiaryEntry> => {
  const { data, error } = await supabase
    .from('diary_entries')
    .upsert({
      id: entry.id,
      user_id: entry.userId,
      local_date: entry.localDate,
      status: entry.status,
      title: entry.title,
      overall_text: entry.overallText,
      daily_emotion_id: entry.dailyEmotionId,
      daily_emotion_snapshot: entry.dailyEmotionSnapshot,
      completed_at: entry.completedAt,
    }, { onConflict: 'user_id,local_date' })
    .select('id, user_id, local_date, status, title, overall_text, daily_emotion_id, daily_emotion_snapshot, created_at, updated_at, completed_at')
    .single()
  if (error) throw error
  const row = data as DiaryEntryRow
  const entryId = row.id
  const { error: promptDeleteError } = await supabase.from('diary_prompt_responses').delete().eq('diary_id', entryId)
  if (promptDeleteError) throw promptDeleteError
  const { error: linkDeleteError } = await supabase.from('diary_checkin_links').delete().eq('diary_id', entryId)
  if (linkDeleteError) throw linkDeleteError
  const { error: imageDeleteError } = await supabase.from('diary_images').delete().eq('diary_id', entryId)
  if (imageDeleteError) throw imageDeleteError

  if (entry.promptResponses.length) {
    const { error: insertError } = await supabase.from('diary_prompt_responses').insert(entry.promptResponses.map((item) => ({ diary_id: entryId, prompt_id: item.promptId, prompt_snapshot: item.promptSnapshot, position: item.position, response_text: item.responseText, is_done: item.isDone })))
    if (insertError) throw insertError
  }
  if (entry.checkinLinks.length) {
    const { error: insertError } = await supabase.from('diary_checkin_links').insert(entry.checkinLinks.map((item) => ({ diary_id: entryId, checkin_id: item.checkinId, weight_percent: item.weightPercent, position: item.position })))
    if (insertError) throw insertError
  }
  if (entry.images.length) {
    const { error: insertError } = await supabase.from('diary_images').insert(entry.images.map((item) => ({ id: item.id, diary_id: entryId, external_file_id: item.externalFileId ?? null, external_url: item.externalUrl, position: item.position, caption: item.caption || null, metadata: item.metadata ?? null })))
    if (insertError) throw insertError
  }
  return { ...entry, id: entryId, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at }
}

export const saveDiary = async (draft: DiaryDraft): Promise<DiaryEntry> => {
  if (!draft.localDate) throw new Error('Diary needs a local date.')
  if (!draft.title.trim()) throw new Error('Hãy thêm tiêu đề cho nhật ký.')
  if (!draft.overallText.trim()) throw new Error('Hãy viết một chút cho phần tổng quan.')
  if (draft.promptResponses.length > 6) throw new Error('Diary chỉ có thể chọn tối đa 6 prompt.')
  if (draft.images.length > 4) throw new Error('Diary chỉ có thể thêm tối đa 4 ảnh.')
  const userId = await currentUserId()
  const existing = (await listDiaryEntries()).find((entry) => entry.localDate === draft.localDate) ?? null
  const entry = normalizeDraft(draft, userId, existing)
  try {
    const saved = await saveRemoteEntry(entry)
    const localEntries = readLocalEntries(userId).filter((item) => item.localDate !== saved.localDate)
    writeLocalEntries(userId, [saved, ...localEntries])
    return saved
  } catch {
    const localEntries = readLocalEntries(userId).filter((item) => item.localDate !== entry.localDate)
    writeLocalEntries(userId, [entry, ...localEntries])
    return entry
  }
}

export const deleteDiary = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  try {
    const { error } = await supabase.from('diary_entries').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch {
    // Local-only drafts do not have a remote row yet.
  }
  writeLocalEntries(userId, readLocalEntries(userId).filter((entry) => entry.id !== id))
}

export const createEmptyDiaryDraft = (localDate = getDiaryLocalDate()): DiaryDraft => ({
  localDate,
  status: 'draft',
  title: '',
  overallText: '',
  dailyEmotionId: null,
  dailyEmotionSnapshot: null,
  promptResponses: [],
  checkinLinks: [],
  images: [],
})

export const getDiaryCheckinDate = (createdAt: string): string => getDiaryLocalDate(new Date(createdAt))
