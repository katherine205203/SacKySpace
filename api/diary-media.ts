import { createHmac, timingSafeEqual } from 'node:crypto'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_LONG_EDGE = 2000
const MAX_REDIRECTS = 3
const SIGNED_URL_TTL_SECONDS = 60 * 60
const GOOGLE_TOKEN_TIMEOUT_MS = 15_000
const DRIVE_UPLOAD_TIMEOUT_MS = 45_000
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

type MediaSource = {
  buffer: Buffer
  sourceType: 'local_upload' | 'url_import'
  originalSourceUrl?: string | null
  originalName?: string
}

type SavedMedia = {
  id: string
  diary_id: string
  slot_order: number
  source_type: MediaSource['sourceType']
  drive_file_id: string
  media_key: string
  original_source_url: string | null
  mime_type: string
  width: number
  height: number
  file_size_bytes: number
  upload_status: 'saved' | 'failed'
  caption: string | null
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
})

const errorMessage = (reason: unknown, fallback: string): string => reason instanceof Error ? reason.message : fallback

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number, timeoutMessage: string): Promise<Response> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (reason: unknown) {
    if (controller.signal.aborted) throw new Error(timeoutMessage)
    throw reason
  } finally {
    clearTimeout(timeout)
  }
}

const env = (name: string): string => process.env[name]?.trim() ?? ''

const getSupabaseAdmin = () => {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

const getBearerToken = (request: Request): string => {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) throw new Error('Authentication is required.')
  return header.slice('Bearer '.length).trim()
}

const getUser = async (request: Request) => {
  const admin = getSupabaseAdmin()
  const token = getBearerToken(request)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Your session is no longer valid.')
  return { admin, user: data.user }
}

const base64UrlEncode = (value: string | Uint8Array): string => {
  const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value)
  return bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const base64UrlDecode = (value: string): Buffer => Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='), 'base64')

const pemToDer = (pem: string): Buffer => Buffer.from(pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, ''), 'base64')

let cachedGoogleToken: { value: string; expiresAt: number } | null = null

const getGoogleAccessToken = async (): Promise<string> => {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) return cachedGoogleToken.value

  const serviceAccountJson = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON')
  if (serviceAccountJson) {
    const account = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string }
    if (!account.client_email || !account.private_key) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is incomplete.')
    const now = Math.floor(Date.now() / 1000)
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim = base64UrlEncode(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 }))
    const unsigned = `${header}.${claim}`
    const key = await crypto.subtle.importKey('pkcs8', new Uint8Array(pemToDer(account.private_key)) as Uint8Array<ArrayBuffer>, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
    const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}` }) }, GOOGLE_TOKEN_TIMEOUT_MS, 'Google token exchange timed out.')
    if (!response.ok) throw new Error(`Google token exchange failed (${response.status}).`)
    const payload = await response.json() as { access_token?: string; expires_in?: number }
    if (!payload.access_token) throw new Error('Google token exchange did not return an access token.')
    cachedGoogleToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 }
    return payload.access_token
  }

  const clientId = env('GOOGLE_DRIVE_CLIENT_ID')
  const clientSecret = env('GOOGLE_DRIVE_CLIENT_SECRET')
  const refreshToken = env('GOOGLE_DRIVE_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google Drive credentials are not configured on the server.')
  const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) }, GOOGLE_TOKEN_TIMEOUT_MS, 'Google token refresh timed out.')
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status}).`)
  const payload = await response.json() as { access_token?: string; expires_in?: number }
  if (!payload.access_token) throw new Error('Google token refresh did not return an access token.')
  cachedGoogleToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 }
  return payload.access_token
}

const getSigningSecret = (): string => {
  const secret = env('DIARY_MEDIA_SIGNING_SECRET')
  if (!secret) throw new Error('Missing DIARY_MEDIA_SIGNING_SECRET.')
  return secret
}

const createMediaSignature = (mediaId: string, userId: string, expiresAt: number): string => base64UrlEncode(createHmac('sha256', getSigningSecret()).update(`${mediaId}.${userId}.${expiresAt}`).digest())

const createResolverUrl = (request: Request, mediaId: string, userId: string): string => {
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS
  const signature = createMediaSignature(mediaId, userId, expiresAt)
  const url = new URL(request.url)
  url.search = new URLSearchParams({ mediaId, userId, expires: String(expiresAt), signature }).toString()
  return url.toString()
}

const verifyMediaSignature = (mediaId: string, userId: string, expiresAt: number, signature: string): boolean => {
  if (!mediaId || !userId || !signature || expiresAt < Math.floor(Date.now() / 1000)) return false
  const expected = base64UrlDecode(createMediaSignature(mediaId, userId, expiresAt))
  const actual = base64UrlDecode(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const isPrivateHostname = (hostname: string): boolean => {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === 'localhost' || value.endsWith('.local') || value === '::1') return true
  const octets = value.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  const [first, second] = octets
  return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 169 && second === 254)
}

const assertSafeRemoteUrl = (value: string): URL => {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error('URL ảnh không hợp lệ.') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Chỉ hỗ trợ liên kết HTTP hoặc HTTPS.')
  if (isPrivateHostname(parsed.hostname)) throw new Error('Không thể nhập ảnh từ địa chỉ mạng nội bộ.')
  return parsed
}

const readResponseBytes = async (response: Response): Promise<Buffer> => {
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_SOURCE_BYTES) throw new Error('Ảnh vượt quá giới hạn 15MB.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('Ảnh vượt quá giới hạn 15MB.')
  return bytes
}

const fetchRemoteImage = async (value: string): Promise<Buffer> => {
  let current = assertSafeRemoteUrl(value)
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let response: Response
    try { response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { accept: 'image/*' } }) } catch (reason: unknown) {
      throw new Error(errorMessage(reason, 'Không thể tải ảnh từ liên kết.'))
    } finally { clearTimeout(timeout) }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || attempt === MAX_REDIRECTS) throw new Error('Liên kết ảnh chuyển hướng quá nhiều lần.')
      current = assertSafeRemoteUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new Error(`Không thể tải ảnh từ liên kết (${response.status}).`)
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (contentType && !contentType.startsWith('image/')) throw new Error('Liên kết không trả về nội dung hình ảnh.')
    return readResponseBytes(response)
  }
  throw new Error('Không thể tải ảnh từ liên kết.')
}

const optimizeImage = async (source: MediaSource): Promise<{ buffer: Buffer; width: number; height: number; mimeType: string }> => {
  const image = sharp(source.buffer, { failOn: 'error' }).rotate().resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
  const output = await image.webp({ quality: 88, effort: 4 }).toBuffer({ resolveWithObject: true })
  if (!output.info.width || !output.info.height) throw new Error('Không thể đọc kích thước ảnh.')
  return { buffer: output.data, width: output.info.width, height: output.info.height, mimeType: 'image/webp' }
}

const uploadToDrive = async (buffer: Buffer, name: string, mimeType: string, mediaKey: string): Promise<string> => {
  const folderId = env('GOOGLE_DRIVE_DIARY_FOLDER_ID')
  if (!folderId) throw new Error('Missing GOOGLE_DRIVE_DIARY_FOLDER_ID.')
  const token = await getGoogleAccessToken()
  const metadata = { name, parents: [folderId], mimeType, appProperties: { sackyMediaKey: mediaKey } }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('media', new Blob([new Uint8Array(buffer) as Uint8Array<ArrayBuffer>], { type: mimeType }), name)
  const response = await fetchWithTimeout(DRIVE_UPLOAD_URL, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form }, DRIVE_UPLOAD_TIMEOUT_MS, 'Google Drive upload timed out.')
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}).`)
  const payload = await response.json() as { id?: string }
  if (!payload.id) throw new Error('Google Drive did not return a file id.')
  return payload.id
}

const deleteFromDrive = async (fileId: string): Promise<void> => {
  try {
    const token = await getGoogleAccessToken()
    await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })
  } catch {
    // Cleanup is best effort after the database relationship has been removed.
  }
}

const findOwnedDiary = async (admin: ReturnType<typeof getSupabaseAdmin>, diaryId: string, userId: string): Promise<boolean> => {
  const { data, error } = await admin.from('diary_entries').select('id').eq('id', diaryId).eq('user_id', userId).neq('status', 'deleted').maybeSingle()
  if (error) throw error
  return Boolean(data)
}

const toPublicMedia = (request: Request, row: SavedMedia, userId: string) => ({
  id: row.id,
  externalFileId: row.drive_file_id,
  externalUrl: createResolverUrl(request, row.id, userId),
  position: row.slot_order,
  caption: row.caption ?? '',
  mediaKey: row.media_key,
  sourceType: row.source_type,
  originalSourceUrl: row.original_source_url ?? undefined,
  mimeType: row.mime_type,
  width: row.width,
  height: row.height,
  fileSizeBytes: row.file_size_bytes,
  uploadStatus: row.upload_status,
})

const handleUpload = async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  let stage = 'authenticate'
  const markStage = (nextStage: string) => {
    stage = nextStage
    console.info(JSON.stringify({ service: 'diary-media', event: 'stage', requestId, stage: nextStage, elapsedMs: Date.now() - startedAt }))
  }
  try {
    markStage('authenticate')
    const { admin, user } = await getUser(request)
    const contentType = request.headers.get('content-type') ?? ''
    let diaryId = ''
    let slotOrder = 0
    let caption = ''
    let source: MediaSource
    markStage('read-source')
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      diaryId = String(form.get('diaryId') ?? '')
      slotOrder = Number(form.get('slotOrder') ?? 0)
      caption = String(form.get('caption') ?? '').trim().slice(0, 120)
      const file = form.get('file')
      if (!(file instanceof File)) throw new Error('Chưa chọn ảnh.')
      source = { buffer: await readResponseBytes(new Response(file)), sourceType: 'local_upload', originalName: file.name }
    } else {
      const body = await request.json() as { action?: string; diaryId?: string; slotOrder?: number; caption?: string; sourceUrl?: string }
      diaryId = body.diaryId ?? ''
      slotOrder = Number(body.slotOrder ?? 0)
      caption = (body.caption ?? '').trim().slice(0, 120)
      if (body.action !== 'import_url' || !body.sourceUrl) throw new Error('Thiếu liên kết ảnh.')
      source = { buffer: await fetchRemoteImage(body.sourceUrl), sourceType: 'url_import', originalSourceUrl: body.sourceUrl, originalName: 'url-image' }
    }
    if (!diaryId || !Number.isInteger(slotOrder) || slotOrder < 1 || slotOrder > 4) throw new Error('Vị trí ảnh không hợp lệ.')
    markStage('verify-diary')
    if (!(await findOwnedDiary(admin, diaryId, user.id))) throw new Error('Không tìm thấy nhật ký hoặc bạn không có quyền truy cập.')
    markStage('optimize-image')
    const optimized = await optimizeImage(source)
    const id = crypto.randomUUID()
    const mediaKey = `diary:${diaryId}:${id}`
    const driveName = `sacky-${diaryId}-${slotOrder}-${id}.webp`
    markStage('upload-drive')
    const driveFileId = await uploadToDrive(optimized.buffer, driveName, optimized.mimeType, mediaKey)
    markStage('save-metadata')
    const { data: previous } = await admin.from('diary_media').select('id, drive_file_id').eq('diary_id', diaryId).eq('slot_order', slotOrder).maybeSingle()
    const { data, error } = await admin.from('diary_media').upsert({ id, diary_id: diaryId, user_id: user.id, slot_order: slotOrder, source_type: source.sourceType, drive_file_id: driveFileId, media_key: mediaKey, original_source_url: source.originalSourceUrl ?? null, mime_type: optimized.mimeType, width: optimized.width, height: optimized.height, file_size_bytes: optimized.buffer.length, upload_status: 'saved', caption: caption || null }, { onConflict: 'diary_id,slot_order' }).select('*').single()
    if (error || !data) {
      await deleteFromDrive(driveFileId)
      throw error ?? new Error('Không thể lưu metadata ảnh.')
    }
    if (previous?.drive_file_id && previous.drive_file_id !== driveFileId) await deleteFromDrive(previous.drive_file_id)
    console.info(JSON.stringify({ service: 'diary-media', event: 'success', requestId, elapsedMs: Date.now() - startedAt }))
    return json({ media: toPublicMedia(request, data as SavedMedia, user.id) })
  } catch (reason: unknown) {
    console.error(JSON.stringify({ service: 'diary-media', event: 'failure', requestId, stage, elapsedMs: Date.now() - startedAt, error: errorMessage(reason, 'Unknown media upload error.') }))
    throw reason
  }
}

const handleSync = async (request: Request): Promise<Response> => {
  const { admin, user } = await getUser(request)
  const body = await request.json() as { action?: string; diaryId?: string; images?: Array<{ id: string; position: number; caption?: string }> }
  if (body.action !== 'sync' || !body.diaryId || !Array.isArray(body.images) || body.images.length > 4) throw new Error('Dữ liệu media không hợp lệ.')
  if (!(await findOwnedDiary(admin, body.diaryId, user.id))) throw new Error('Không tìm thấy nhật ký hoặc bạn không có quyền truy cập.')
  const { data: current, error: currentError } = await admin.from('diary_media').select('*').eq('diary_id', body.diaryId).eq('user_id', user.id)
  if (currentError) throw currentError
  const keepIds = new Set(body.images.map((image) => image.id))
  const currentRows = (current ?? []) as SavedMedia[]
  const desiredRows = body.images.map((image) => {
    if (!image.id || !Number.isInteger(image.position) || image.position < 1 || image.position > 4) throw new Error('Vị trí ảnh không hợp lệ.')
    const row = currentRows.find((candidate) => candidate.id === image.id)
    if (!row) throw new Error('Ảnh không thuộc nhật ký này.')
    return { ...row, slot_order: image.position, caption: (image.caption ?? '').trim().slice(0, 120) || null }
  })
  if (new Set(desiredRows.map((row) => row.slot_order)).size !== desiredRows.length) throw new Error('Hai ảnh không thể dùng cùng một vị trí.')
  const removed = (current ?? []).filter((row) => !keepIds.has(row.id))
  const { error: deleteError } = await admin.from('diary_media').delete().eq('diary_id', body.diaryId).eq('user_id', user.id)
  if (deleteError) throw deleteError
  if (desiredRows.length) {
    const { error: insertError } = await admin.from('diary_media').insert(desiredRows)
    if (insertError) {
      await admin.from('diary_media').insert(currentRows)
      throw insertError
    }
  }
  for (const row of removed) {
    const { count } = await admin.from('diary_media').select('id', { count: 'exact', head: true }).eq('drive_file_id', row.drive_file_id)
    if (!count) await deleteFromDrive(row.drive_file_id)
  }
  return json({ ok: true })
}

const handleResolve = async (request: Request, url: URL): Promise<Response> => {
  const { admin, user } = await getUser(request)
  const mediaId = url.searchParams.get('mediaId') ?? ''
  const { data, error } = await admin.from('diary_media').select('*').eq('id', mediaId).eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (!data) return json({ error: 'Media not found.' }, 404)
  return json({ url: createResolverUrl(request, mediaId, user.id), media: toPublicMedia(request, data as SavedMedia, user.id) })
}

const handleStream = async (request: Request, url: URL): Promise<Response> => {
  const mediaId = url.searchParams.get('mediaId') ?? ''
  const userId = url.searchParams.get('userId') ?? ''
  const expiresAt = Number(url.searchParams.get('expires') ?? 0)
  const signature = url.searchParams.get('signature') ?? ''
  if (!verifyMediaSignature(mediaId, userId, expiresAt, signature)) return new Response('Invalid media URL.', { status: 403 })
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.from('diary_media').select('drive_file_id, mime_type, user_id').eq('id', mediaId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return new Response('Media not found.', { status: 404 })
  const token = await getGoogleAccessToken()
  const response = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(data.drive_file_id)}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } })
  if (!response.ok) return new Response('Media unavailable.', { status: response.status })
  return new Response(response.body, { status: 200, headers: { 'content-type': data.mime_type, 'cache-control': 'private, max-age=300, stale-while-revalidate=600' } })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } })
  try {
    const url = new URL(request.url)
    if (request.method === 'GET') return url.searchParams.has('signature') ? await handleStream(request, url) : await handleResolve(request, url)
    if (request.method === 'POST') return url.searchParams.get('action') === 'sync' ? await handleSync(request) : await handleUpload(request)
    return json({ error: 'Method not allowed.' }, 405)
  } catch (reason: unknown) {
    const message = errorMessage(reason, 'Không thể xử lý hình ảnh.')
    const status = /authentication|session|permission|access|quyền|không tìm thấy|not found/i.test(message) ? 401 : /credential|missing|not configured/i.test(message) ? 503 : 400
    return json({ error: message }, status)
  }
}
