import { supabase } from '../../../services/supabase/client'
import { createDiaryId, getDiaryLocalDate, isDiaryBackfilledDate, shouldSystemCompleteDiary, systemCompleteDiary } from '../utils'
import { DEFAULT_DIARY_PROMPTS } from '../prompts'
import { resolveDiaryMediaUrl, syncDiaryMedia } from './diaryMedia'
import type { DiaryCheckinLink, DiaryCompletionSource, DiaryDraft, DiaryEntry, DiaryImage, DiaryPrompt, DiaryStatus, JourneyDraft, JourneyEntry, JourneyStatus } from '../types'
import { isRichTextEmpty } from '../../../components/richText'

const LOCAL_STORAGE_PREFIX = 'sacky:diary:v2:'
const LOCAL_JOURNEY_STORAGE_PREFIX = 'sacky:diary:journey:v1:'

type DiaryEntryRow = {
  id: string
  user_id: string
  local_date: string
  status: string
  title: string | null
  overall_text: string | null
  daily_emotion_id: string | null
  daily_emotion_snapshot: DiaryEntry['dailyEmotionSnapshot']
  created_at: string
  updated_at: string
  completed_at: string | null
  completion_source?: string | null
  is_backfilled?: boolean | null
  day_locked_at?: string | null
}

const DIARY_ENTRY_SELECT = 'id, user_id, local_date, status, title, overall_text, daily_emotion_id, daily_emotion_snapshot, created_at, updated_at, completed_at, completion_source, is_backfilled, day_locked_at'
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

type DiaryImageRow = {
  id: string
  diary_id: string
  external_file_id: string | null
  external_url: string
  position: number
  caption: string | null
  metadata: Record<string, unknown> | null
  media_key?: string | null
  source_type?: DiaryImage['sourceType'] | null
  original_source_url?: string | null
  mime_type?: string | null
  width?: number | null
  height?: number | null
  file_size_bytes?: number | null
  upload_status?: DiaryImage['uploadStatus'] | null
}

const JOURNEY_ENTRY_SELECT = 'id, user_id, status, range_start, range_end, title, overall_text, primary_emotion_id, primary_emotion_snapshot, closing_thought, created_at, updated_at, completed_at'

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('You must be signed in to use Diary.')
  return data.user.id
}

const isFinishedStatus = (status: DiaryStatus): boolean => status === 'done'

const normalizeDiaryStatus = (status: string): DiaryStatus => {
  if (status === 'done' || status === 'user_done' || status === 'day_locked') return 'done'
  if (status === 'draft') return 'draft'
  return 'draft'
}

const normalizeCompletionSource = (status: string, source?: string | null): DiaryCompletionSource | null => {
  if (status === 'day_locked') return 'system'
  if (status === 'user_done') return 'user'
  if (status !== 'done') return null
  return source === 'system' ? 'system' : 'user'
}

const missingDiaryLifecycleColumn = (message: string): boolean => /completion_source|is_backfilled|day_locked_at|column .* does not exist|schema cache/i.test(message)
const missingDiaryMediaTable = (message: string): boolean => /diary_media|relation .* does not exist|schema cache/i.test(message)

const isManagedDiaryImage = (image: DiaryImage): boolean => image.sourceType === 'local_upload' || image.sourceType === 'url_import' || Boolean(image.mediaKey)
const hasManagedDiaryImages = (images: DiaryImage[]): boolean => images.some(isManagedDiaryImage)

type SaveDiaryOptions = {
  skipMediaSync?: boolean
  completionSource?: DiaryCompletionSource
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
    source: item.source === 'gift_for_tomorrow' ? item.source : 'catalog',
    sourceGiftId: typeof item.sourceGiftId === 'string' ? item.sourceGiftId : undefined,
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
    return parsed.flatMap((entry) => {
      const normalized = normalizeStoredEntry(entry)
      return normalized ? [normalized] : []
    })
  } catch {
    return []
  }
}

const writeLocalEntries = (userId: string, entries: DiaryEntry[]): void => {
  try {
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(entries))
  } catch {
    // The remote record remains authoritative when local storage is unavailable.
  }
}

const normalizeStoredEntry = (value: unknown): DiaryEntry | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.localDate !== 'string') return null
  const rawStatus = typeof raw.status === 'string' ? raw.status : 'draft'
  if (rawStatus === 'deleted') return null
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  const status = normalizeDiaryStatus(rawStatus)
  const { dayLockedAt: _legacyDayLockedAt, ...rest } = raw
  return {
    ...rest,
    status,
    completionSource: normalizeCompletionSource(rawStatus, typeof raw.completionSource === 'string' ? raw.completionSource : null),
    isBackfilled: typeof raw.isBackfilled === 'boolean' ? raw.isBackfilled : isDiaryBackfilledDate(raw.localDate, new Date(createdAt)),
    completedAt: status === 'done' && typeof raw.completedAt === 'string' ? raw.completedAt : status === 'done' ? createdAt : null,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
  } as DiaryEntry
}

const mapRemoteEntry = (
  row: DiaryEntryRow,
  promptRows: Array<{ diary_id: string; prompt_id: string | null; prompt_snapshot: unknown; position: number; response_text: string; is_done: boolean }>,
  linkRows: Array<{ diary_id: string; checkin_id: string; weight_percent: number; position: number }>,
  imageRows: DiaryImageRow[],
): DiaryEntry => {
  const status = normalizeDiaryStatus(row.status)
  return {
  id: row.id,
  userId: row.user_id,
  localDate: row.local_date,
  status,
  title: row.title ?? '',
  overallText: row.overall_text ?? '',
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
    .map((item) => ({ id: item.id, externalFileId: item.external_file_id ?? undefined, externalUrl: item.external_url, position: item.position, caption: item.caption ?? '', mediaKey: item.media_key ?? undefined, sourceType: item.source_type ?? (item.external_file_id ? 'legacy' : undefined), originalSourceUrl: item.original_source_url ?? undefined, mimeType: item.mime_type ?? undefined, width: item.width ?? undefined, height: item.height ?? undefined, fileSizeBytes: item.file_size_bytes ?? undefined, uploadStatus: item.upload_status ?? undefined, metadata: item.metadata ?? undefined })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
  completionSource: normalizeCompletionSource(row.status, row.completion_source),
  isBackfilled: row.is_backfilled ?? (status === 'draft' && isDiaryBackfilledDate(row.local_date, new Date(row.created_at))),
  }
}

const listRemoteEntries = async (userId: string, localDate?: string): Promise<DiaryEntry[]> => {
  const query = (select: string) => {
    let request = supabase
      .from('diary_entries')
      .select(select)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('local_date', { ascending: false })
    if (localDate) request = request.eq('local_date', localDate)
    return request
  }
  let result = await query(DIARY_ENTRY_SELECT)
  if (result.error && missingDiaryLifecycleColumn(result.error.message)) result = await query(LEGACY_DIARY_ENTRY_SELECT)
  if (result.error) throw result.error
  const rows = (result.data ?? []) as unknown as DiaryEntryRow[]
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [promptResult, linkResult, imageResult, legacyImageResult] = await Promise.all([
    supabase.from('diary_prompt_responses').select('diary_id, prompt_id, prompt_snapshot, position, response_text, is_done').in('diary_id', ids).order('position'),
    supabase.from('diary_checkin_links').select('diary_id, checkin_id, weight_percent, position').in('diary_id', ids).order('position'),
    supabase.from('diary_media').select('id, diary_id, drive_file_id, slot_order, source_type, media_key, original_source_url, mime_type, width, height, file_size_bytes, upload_status, caption').in('diary_id', ids).order('slot_order'),
    supabase.from('diary_images').select('id, diary_id, external_file_id, external_url, position, caption, metadata').in('diary_id', ids).order('position'),
  ])
  if (promptResult.error) throw promptResult.error
  if (linkResult.error) throw linkResult.error
  const mediaRows = imageResult.error && missingDiaryMediaTable(imageResult.error.message) ? [] : imageResult.data as unknown as Array<{ id: string; diary_id: string; drive_file_id: string; slot_order: number; source_type: DiaryImage['sourceType']; media_key: string; original_source_url: string | null; mime_type: string; width: number; height: number; file_size_bytes: number; upload_status: DiaryImage['uploadStatus']; caption: string | null }>
  if (imageResult.error && !missingDiaryMediaTable(imageResult.error.message)) throw imageResult.error
  if (legacyImageResult.error) throw legacyImageResult.error
  const resolvedMediaRows = await Promise.all(mediaRows.map(async (item) => {
    let externalUrl = ''
    try { externalUrl = await resolveDiaryMediaUrl(item.id) } catch { /* A missing resolver should not hide legacy text content. */ }
    return { id: item.id, diary_id: item.diary_id, external_file_id: item.drive_file_id, external_url: externalUrl, position: item.slot_order, caption: item.caption, metadata: null, media_key: item.media_key, source_type: item.source_type, original_source_url: item.original_source_url, mime_type: item.mime_type, width: item.width, height: item.height, file_size_bytes: item.file_size_bytes, upload_status: item.upload_status } satisfies DiaryImageRow
  }))
  const occupiedSlots = new Set(resolvedMediaRows.map((item) => `${item.diary_id}:${item.position}`))
  const legacyRows = ((legacyImageResult.data ?? []) as DiaryImageRow[]).filter((item) => !occupiedSlots.has(`${item.diary_id}:${item.position}`)).map((item) => ({ ...item, source_type: 'legacy' as const }))
  return rows.map((row) => mapRemoteEntry(row, promptResult.data ?? [], linkResult.data ?? [], [...resolvedMediaRows, ...legacyRows]))
}

const finalizeExpiredDiaryDrafts = async (): Promise<void> => {
  try {
    await supabase.rpc('finalize_expired_diary_drafts')
  } catch {
    // The local fallback below still handles stale drafts if the migration is not available yet.
  }
}

const finalizeLocalEntries = (entries: DiaryEntry[]): DiaryEntry[] => {
  const completedAt = new Date().toISOString()
  const today = getDiaryLocalDate()
  return entries.map((entry) => shouldSystemCompleteDiary(entry, today) ? systemCompleteDiary(entry, completedAt) : entry)
}

export const listDiaryEntries = async (): Promise<DiaryEntry[]> => {
  const userId = await currentUserId()
  try {
    await finalizeExpiredDiaryDrafts()
    const remoteEntries = await listRemoteEntries(userId)
    const localEntries = finalizeLocalEntries(readLocalEntries(userId))
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
    const entries = finalizeLocalEntries(readLocalEntries(userId))
    writeLocalEntries(userId, entries)
    return entries
  }
}

export const getDiaryEntry = async (localDate: string, { finalize = true, userId: requestedUserId }: { finalize?: boolean; userId?: string } = {}): Promise<DiaryEntry | null> => {
  const userId = requestedUserId ?? await currentUserId()
  try {
    if (finalize) await finalizeExpiredDiaryDrafts()
    const [remoteEntries, localEntries] = await Promise.all([listRemoteEntries(userId, localDate), Promise.resolve(finalizeLocalEntries(readLocalEntries(userId)))])
    const remoteEntry = remoteEntries[0] ?? null
    const localEntry = localEntries.find((entry) => entry.localDate === localDate) ?? null
    const entry = localEntry && (!remoteEntry || localEntry.updatedAt > remoteEntry.updatedAt) ? localEntry : remoteEntry
    if (entry) writeLocalEntries(userId, [entry, ...localEntries.filter((item) => item.localDate !== localDate)])
    return entry
  } catch {
    return finalizeLocalEntries(readLocalEntries(userId)).find((entry) => entry.localDate === localDate) ?? null
  }
}

const normalizeDraft = (draft: DiaryDraft, userId: string, existing: DiaryEntry | null | undefined, options: SaveDiaryOptions = {}): DiaryEntry => {
  const now = new Date().toISOString()
  const requestedStatus: DiaryStatus = draft.status === 'done' ? 'done' : 'draft'
  const status: DiaryStatus = isFinishedStatus(existing?.status ?? 'draft') && requestedStatus === 'draft' ? 'done' : requestedStatus
  const completionSource: DiaryCompletionSource | null = status === 'done'
    ? existing?.status === 'done' && requestedStatus === 'draft'
      ? existing.completionSource ?? 'user'
      : options.completionSource ?? draft.completionSource ?? existing?.completionSource ?? 'user'
    : null
  const isBackfilled = existing?.isBackfilled ?? (draft.isBackfilled || isDiaryBackfilledDate(draft.localDate))
  const completedAt = isFinishedStatus(status) ? existing?.completedAt ?? draft.completedAt ?? now : null
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
    completionSource,
    isBackfilled,
  }
}

const syncGiftDiaryPrompts = async (entry: DiaryEntry, previousEntry: DiaryEntry | null): Promise<void> => {
  const previousGiftIds = new Set((previousEntry?.promptResponses ?? []).map((response) => response.promptSnapshot.sourceGiftId).filter((id): id is string => Boolean(id)))
  const nextGiftResponses = entry.promptResponses.filter((response) => Boolean(response.promptSnapshot.sourceGiftId))
  const nextGiftIds = new Set(nextGiftResponses.map((response) => response.promptSnapshot.sourceGiftId).filter((id): id is string => Boolean(id)))
  for (const giftId of previousGiftIds) {
    if (nextGiftIds.has(giftId)) continue
    await supabase.from('gift_diary_conversion_links').delete().eq('gift_id', giftId).eq('diary_id', entry.id)
  }
  for (const response of nextGiftResponses) {
    const giftId = response.promptSnapshot.sourceGiftId
    if (!giftId) continue
    await supabase.from('gift_question_answers').upsert({ gift_id: giftId, answer_text: response.responseText, is_done: response.isDone, answered_at: isRichTextEmpty(response.responseText) ? null : new Date().toISOString() }, { onConflict: 'gift_id' })
  }
}

const saveRemoteEntry = async (entry: DiaryEntry, previousEntry: DiaryEntry | null, options: SaveDiaryOptions = {}): Promise<DiaryEntry> => {
  const payload: Record<string, unknown> = {
      id: entry.id,
      user_id: entry.userId,
      local_date: entry.localDate,
      status: entry.status,
      title: entry.title.trim() || null,
      overall_text: isRichTextEmpty(entry.overallText) ? null : entry.overallText,
      daily_emotion_id: entry.dailyEmotionId,
      daily_emotion_snapshot: entry.dailyEmotionSnapshot,
      completed_at: entry.completedAt,
      completion_source: entry.completionSource,
      is_backfilled: entry.isBackfilled,
    }
  const persist = (nextPayload: Record<string, unknown>, select: string) => supabase
    .from('diary_entries')
    .upsert(nextPayload, { onConflict: 'user_id,local_date' })
    .select(select)
    .single()
  let result = await persist(payload, DIARY_ENTRY_SELECT)
  if (result.error && missingDiaryLifecycleColumn(result.error.message)) {
    const legacyPayload: Record<string, unknown> = {
      ...payload,
      status: entry.status === 'done' ? entry.completionSource === 'system' ? 'day_locked' : 'user_done' : 'draft',
    }
    delete legacyPayload.completion_source
    delete legacyPayload.is_backfilled
    result = await persist(legacyPayload, LEGACY_DIARY_ENTRY_SELECT)
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
  const legacyImages = entry.images.filter((item) => item.sourceType === 'legacy' || (!item.sourceType && !item.mediaKey))
  if (legacyImages.length) {
    const { error: insertError } = await supabase.from('diary_images').insert(legacyImages.map((item) => ({ id: item.id, diary_id: entryId, external_file_id: item.externalFileId ?? null, external_url: item.externalUrl, position: item.position, caption: item.caption || null, metadata: item.metadata ?? null })))
    if (insertError) throw insertError
  }
  if (!options.skipMediaSync && (hasManagedDiaryImages(entry.images) || hasManagedDiaryImages(previousEntry?.images ?? []))) await syncDiaryMedia(entryId, entry.images)
  await syncGiftDiaryPrompts({ ...entry, id: entryId }, previousEntry)
  return { ...entry, id: entryId, status: normalizeDiaryStatus(row.status), createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, completionSource: normalizeCompletionSource(row.status, row.completion_source) ?? entry.completionSource, isBackfilled: row.is_backfilled ?? entry.isBackfilled }
}

export const saveDiary = async (draft: DiaryDraft, options: SaveDiaryOptions = {}): Promise<DiaryEntry> => {
  if (!draft.localDate) throw new Error('Diary needs a local date.')
  if (draft.promptResponses.length > 6) throw new Error('Diary chỉ có thể chọn tối đa 6 prompt.')
  if (draft.images.length > 4) throw new Error('Diary chỉ có thể thêm tối đa 4 ảnh.')
  const userId = await currentUserId()
  const existing = (await listDiaryEntries()).find((entry) => entry.localDate === draft.localDate) ?? null
  const entry = normalizeDraft(draft, userId, existing, options)
  try {
    const saved = await saveRemoteEntry(entry, existing, options)
    const localEntries = readLocalEntries(userId).filter((item) => item.localDate !== saved.localDate)
    writeLocalEntries(userId, [saved, ...localEntries])
    return saved
  } catch (reason: unknown) {
    if (hasManagedDiaryImages(entry.images) || hasManagedDiaryImages(existing?.images ?? [])) throw reason
    const localEntries = readLocalEntries(userId).filter((item) => item.localDate !== entry.localDate)
    writeLocalEntries(userId, [entry, ...localEntries])
    return entry
  }
}

export const deleteDiary = async (id: string): Promise<void> => {
  const userId = await currentUserId()
  const existing = (await listDiaryEntries()).find((entry) => entry.id === id)
  if (existing && hasManagedDiaryImages(existing.images)) await syncDiaryMedia(id, [])
  try {
    const { error } = await supabase.from('diary_entries').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) throw error
    await supabase.from('gift_diary_conversion_links').delete().eq('diary_id', id)
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
  completionSource: null,
  isBackfilled: isDiaryBackfilledDate(localDate),
})

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
  if (isRichTextEmpty(draft.overallText)) throw new Error('Hãy viết một chút cho phần tổng quan chặng.')
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
