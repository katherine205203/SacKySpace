import { supabase } from '../../../services/supabase/client'
import { createDiaryId, getDiaryLocalDate } from '../utils'
import { DEFAULT_DIARY_PROMPTS } from '../prompts'
import type { DiaryCheckinLink, DiaryDraft, DiaryEntry, DiaryPrompt, DiaryStatus, JourneyDraft, JourneyEntry, JourneyStatus } from '../types'

const LOCAL_STORAGE_PREFIX = 'sacky:diary:v2:'
const LOCAL_JOURNEY_STORAGE_PREFIX = 'sacky:diary:journey:v1:'

type DiaryEntryRow = {
  id: string
  user_id: string
  local_date: string
  status: string
  title: string
  overall_text: string
  daily_emotion_id: string | null
  daily_emotion_snapshot: DiaryEntry['dailyEmotionSnapshot']
  created_at: string
  updated_at: string
  completed_at: string | null
  day_locked_at?: string | null
}

const DIARY_ENTRY_SELECT = 'id, user_id, local_date, status, title, overall_text, daily_emotion_id, daily_emotion_snapshot, created_at, updated_at, completed_at, day_locked_at'
const LEGACY_DIARY_ENTRY_SELECT = 'id, user_id, local_date, status, title, overall_text, daily_emotion_id, daily_emotion_snapshot, created_at, updated_at, completed_at'

type DiaryPromptRow = {
  id: string
  code: string
  text_vn: string
  text_en: string | null
  emoji: string
  hex_color: string
  description: string | null
}

type JourneyEntryRow = {
  id: string
  user_id: string
  status: string
  range_start: string
  range_end: string
  title: string
  overall_text: string
  primary_emotion_id: string | null
  primary_emotion_snapshot: JourneyEntry['primaryEmotionSnapshot']
  closing_thought: string
  created_at: string
  updated_at: string
  completed_at: string | null
}

const JOURNEY_ENTRY_SELECT = 'id, user_id, status, range_start, range_end, title, overall_text, primary_emotion_id, primary_emotion_snapshot, closing_thought, created_at, updated_at, completed_at'

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to use Diary.')
  return data.user.id
}

const isFinishedStatus = (status: DiaryStatus): boolean => status === 'done' || status === 'user_done' || status === 'day_locked'

const normalizeDiaryStatus = (status: string): DiaryStatus => {
  if (status === 'done') return 'user_done'
  if (status === 'draft' || status === 'user_done' || status === 'day_locked' || status === 'deleted') return status
  return 'draft'
}

const missingDayLockColumn = (message: string): boolean => /day_locked_at|column .* does not exist|schema cache/i.test(message)

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
  status: normalizeDiaryStatus(row.status),
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
  dayLockedAt: row.day_locked_at ?? null,
})

const listRemoteEntries = async (userId: string): Promise<DiaryEntry[]> => {
  const query = (select: string) => supabase
    .from('diary_entries')
    .select(select)
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('local_date', { ascending: false })
  let result = await query(DIARY_ENTRY_SELECT)
  if (result.error && missingDayLockColumn(result.error.message)) result = await query(LEGACY_DIARY_ENTRY_SELECT)
  if (result.error) throw result.error
  const rows = (result.data ?? []) as unknown as DiaryEntryRow[]
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
    const localByDate = new Map(localEntries.map((entry) => [entry.localDate, entry]))
    const remoteDates = new Set(remoteEntries.map((entry) => entry.localDate))
    const entries = [
      ...remoteEntries.map((entry) => {
        const local = localByDate.get(entry.localDate)
        return local && local.updatedAt > entry.updatedAt ? local : entry
      }),
      ...localEntries.filter((entry) => !remoteDates.has(entry.localDate)),
    ].sort((left, right) => right.localDate.localeCompare(left.localDate))
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
  const requestedStatus = draft.status === 'done' ? 'user_done' : draft.status
  const status: DiaryStatus = existing?.status === 'day_locked'
    ? 'day_locked'
    : isFinishedStatus(existing?.status ?? 'draft') && requestedStatus === 'draft'
      ? normalizeDiaryStatus(existing!.status)
      : requestedStatus
  const completedAt = isFinishedStatus(status) ? existing?.completedAt ?? draft.completedAt ?? now : null
  const dayLockedAt = status === 'day_locked' ? existing?.dayLockedAt ?? draft.dayLockedAt ?? now : null
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
    dayLockedAt,
  }
}

const saveRemoteEntry = async (entry: DiaryEntry): Promise<DiaryEntry> => {
  const payload: Record<string, unknown> = {
      id: entry.id,
      user_id: entry.userId,
      local_date: entry.localDate,
      status: entry.status,
      title: entry.title,
      overall_text: entry.overallText,
      daily_emotion_id: entry.dailyEmotionId,
      daily_emotion_snapshot: entry.dailyEmotionSnapshot,
      completed_at: entry.completedAt,
      day_locked_at: entry.dayLockedAt,
    }
  const persist = (select: string) => supabase
    .from('diary_entries')
    .upsert(payload, { onConflict: 'user_id,local_date' })
    .select(select)
    .single()
  let result = await persist(DIARY_ENTRY_SELECT)
  if (result.error && missingDayLockColumn(result.error.message)) {
    delete payload.day_locked_at
    result = await persist(LEGACY_DIARY_ENTRY_SELECT)
  }
  if (result.error) throw result.error
  const row = result.data as unknown as DiaryEntryRow
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
  return { ...entry, id: entryId, status: normalizeDiaryStatus(row.status), createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, dayLockedAt: row.day_locked_at ?? entry.dayLockedAt }
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
  dayLockedAt: null,
})

export const markDiaryDayLocked = async (id: string, localDate: string, lockedAt: string): Promise<void> => {
  const userId = await currentUserId()
  try {
    let result = await supabase
      .from('diary_entries')
      .update({ status: 'day_locked', day_locked_at: lockedAt })
      .eq('id', id)
      .eq('user_id', userId)
      .select(DIARY_ENTRY_SELECT)
      .single()
    if (result.error && missingDayLockColumn(result.error.message)) {
      result = await supabase
        .from('diary_entries')
        .update({ status: 'day_locked' })
        .eq('id', id)
        .eq('user_id', userId)
        .select(LEGACY_DIARY_ENTRY_SELECT)
        .single()
    }
    if (result.error) throw result.error
  } catch {
    // A local mirror still preserves the transition while the migration is not available remotely.
  }
  writeLocalEntries(userId, readLocalEntries(userId).map((item) => item.id === id || item.localDate === localDate ? { ...item, status: 'day_locked', dayLockedAt: lockedAt, updatedAt: lockedAt } : item))
}

export const getDiaryCheckinDate = (createdAt: string): string => getDiaryLocalDate(new Date(createdAt))

const readLocalJourneys = (userId: string): JourneyEntry[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${LOCAL_JOURNEY_STORAGE_PREFIX}${userId}`) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is JourneyEntry => Boolean(
      entry && typeof entry === 'object' &&
      (entry as JourneyEntry).diaryType === 'journey' &&
      typeof (entry as JourneyEntry).rangeStart === 'string' &&
      typeof (entry as JourneyEntry).rangeEnd === 'string',
    ))
  } catch {
    return []
  }
}

const writeLocalJourneys = (userId: string, entries: JourneyEntry[]): void => {
  try { window.localStorage.setItem(`${LOCAL_JOURNEY_STORAGE_PREFIX}${userId}`, JSON.stringify(entries)) } catch { /* Remote remains authoritative. */ }
}

const normalizeJourneyStatus = (status: string): JourneyStatus => status === 'done' ? 'done' : 'draft'

const mapRemoteJourney = (
  row: JourneyEntryRow,
  dailyRows: Array<{ journey_id: string; diary_id: string; position: number }>,
  checkinRows: Array<{ journey_id: string; checkin_id: string; weight_percent: number; position: number }>,
): JourneyEntry => ({
  id: row.id,
  userId: row.user_id,
  diaryType: 'journey',
  status: normalizeJourneyStatus(row.status),
  rangeStart: row.range_start,
  rangeEnd: row.range_end,
  title: row.title,
  overallText: row.overall_text,
  primaryEmotionId: row.primary_emotion_id,
  primaryEmotionSnapshot: row.primary_emotion_snapshot,
  selectedDailyDiaryIds: dailyRows.filter((item) => item.journey_id === row.id).sort((left, right) => left.position - right.position).map((item) => item.diary_id),
  checkinLinks: checkinRows.filter((item) => item.journey_id === row.id).sort((left, right) => left.position - right.position).map((item) => ({ checkinId: item.checkin_id, weightPercent: item.weight_percent, position: item.position })),
  closingThought: row.closing_thought ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
})

const listRemoteJourneys = async (userId: string): Promise<JourneyEntry[]> => {
  const { data, error } = await supabase
    .from('journey_diary_entries')
    .select(JOURNEY_ENTRY_SELECT)
    .eq('user_id', userId)
    .order('range_end', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as JourneyEntryRow[]
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [dailyResult, checkinResult] = await Promise.all([
    supabase.from('journey_daily_diary_links').select('journey_id, diary_id, position').in('journey_id', ids).order('position'),
    supabase.from('journey_checkin_links').select('journey_id, checkin_id, weight_percent, position').in('journey_id', ids).order('position'),
  ])
  if (dailyResult.error) throw dailyResult.error
  if (checkinResult.error) throw checkinResult.error
  return rows.map((row) => mapRemoteJourney(row, dailyResult.data ?? [], checkinResult.data ?? []))
}

export const listJourneyEntries = async (): Promise<JourneyEntry[]> => {
  const userId = await currentUserId()
  try {
    const remoteEntries = await listRemoteJourneys(userId)
    const localEntries = readLocalJourneys(userId)
    const remoteById = new Map(remoteEntries.map((entry) => [entry.id, entry]))
    const merged = remoteEntries.map((entry) => {
      const local = localEntries.find((candidate) => candidate.id === entry.id)
      return local && local.updatedAt > entry.updatedAt ? local : entry
    })
    merged.push(...localEntries.filter((entry) => !remoteById.has(entry.id)))
    const entries = merged.sort((left, right) => right.rangeEnd.localeCompare(left.rangeEnd) || right.updatedAt.localeCompare(left.updatedAt))
    writeLocalJourneys(userId, entries)
    return entries
  } catch {
    return readLocalJourneys(userId)
  }
}

export const getJourneyEntry = async (id: string): Promise<JourneyEntry | null> => {
  const entries = await listJourneyEntries()
  return entries.find((entry) => entry.id === id) ?? null
}

const normalizeJourneyDraft = (draft: JourneyDraft, userId: string, existing?: JourneyEntry | null): JourneyEntry => {
  const now = new Date().toISOString()
  const status: JourneyStatus = draft.status === 'done' ? 'done' : 'draft'
  return {
    id: draft.id ?? existing?.id ?? createDiaryId(),
    userId,
    diaryType: 'journey',
    status,
    rangeStart: draft.rangeStart,
    rangeEnd: draft.rangeEnd,
    title: draft.title.trim(),
    overallText: draft.overallText.trim(),
    primaryEmotionId: draft.primaryEmotionId,
    primaryEmotionSnapshot: draft.primaryEmotionSnapshot,
    selectedDailyDiaryIds: [...new Set(draft.selectedDailyDiaryIds)],
    checkinLinks: draft.checkinLinks.filter((item) => item.weightPercent > 0).map((item, index) => ({ ...item, position: index + 1 })),
    closingThought: draft.closingThought.trim(),
    createdAt: existing?.createdAt ?? draft.createdAt ?? now,
    updatedAt: now,
    completedAt: status === 'done' ? existing?.completedAt ?? draft.completedAt ?? now : null,
  }
}

const saveRemoteJourney = async (entry: JourneyEntry): Promise<JourneyEntry> => {
  const payload = {
    id: entry.id,
    user_id: entry.userId,
    status: entry.status,
    range_start: entry.rangeStart,
    range_end: entry.rangeEnd,
    title: entry.title,
    overall_text: entry.overallText,
    primary_emotion_id: entry.primaryEmotionId,
    primary_emotion_snapshot: entry.primaryEmotionSnapshot,
    closing_thought: entry.closingThought,
    completed_at: entry.completedAt,
  }
  const { data, error } = await supabase.from('journey_diary_entries').upsert(payload, { onConflict: 'id' }).select(JOURNEY_ENTRY_SELECT).single()
  if (error) throw error
  const row = data as unknown as JourneyEntryRow
  const { error: dailyDeleteError } = await supabase.from('journey_daily_diary_links').delete().eq('journey_id', entry.id)
  if (dailyDeleteError) throw dailyDeleteError
  const { error: checkinDeleteError } = await supabase.from('journey_checkin_links').delete().eq('journey_id', entry.id)
  if (checkinDeleteError) throw checkinDeleteError
  if (entry.selectedDailyDiaryIds.length) {
    const { error: insertError } = await supabase.from('journey_daily_diary_links').insert(entry.selectedDailyDiaryIds.map((diaryId, index) => ({ journey_id: entry.id, diary_id: diaryId, position: index + 1 })))
    if (insertError) throw insertError
  }
  if (entry.checkinLinks.length) {
    const { error: insertError } = await supabase.from('journey_checkin_links').insert(entry.checkinLinks.map((link, index) => ({ journey_id: entry.id, checkin_id: link.checkinId, weight_percent: link.weightPercent, position: index + 1 })))
    if (insertError) throw insertError
  }
  return { ...entry, id: row.id, status: normalizeJourneyStatus(row.status), createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at }
}

export const saveJourney = async (draft: JourneyDraft): Promise<JourneyEntry> => {
  if (!draft.rangeStart || !draft.rangeEnd || draft.rangeStart > draft.rangeEnd) throw new Error('Chọn một khoảng thời gian hợp lệ cho nhật ký chặng.')
  if (!draft.title.trim()) throw new Error('Hãy thêm tiêu đề cho nhật ký chặng.')
  if (!draft.overallText.trim()) throw new Error('Hãy viết một chút cho phần tổng quan chặng.')
  const userId = await currentUserId()
  const existing = draft.id ? (await listJourneyEntries()).find((entry) => entry.id === draft.id) ?? null : null
  const entry = normalizeJourneyDraft(draft, userId, existing)
  try {
    const saved = await saveRemoteJourney(entry)
    const localEntries = readLocalJourneys(userId).filter((item) => item.id !== saved.id)
    writeLocalJourneys(userId, [saved, ...localEntries])
    return saved
  } catch {
    const localEntries = readLocalJourneys(userId).filter((item) => item.id !== entry.id)
    writeLocalJourneys(userId, [entry, ...localEntries])
    return entry
  }
}

export const deleteJourney = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  try {
    const { error } = await supabase.from('journey_diary_entries').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  } catch { /* Local-only journeys remain removable offline. */ }
  writeLocalJourneys(userId, readLocalJourneys(userId).filter((entry) => entry.id !== id))
}

export const createEmptyJourneyDraft = (rangeStart = getDiaryLocalDate(), rangeEnd = rangeStart): JourneyDraft => ({
  diaryType: 'journey',
  status: 'draft',
  rangeStart,
  rangeEnd,
  title: '',
  overallText: '',
  primaryEmotionId: null,
  primaryEmotionSnapshot: null,
  selectedDailyDiaryIds: [],
  checkinLinks: [] as DiaryCheckinLink[],
  closingThought: '',
})
