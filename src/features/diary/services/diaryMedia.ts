import { supabase } from '../../../services/supabase/client'
import type { DiaryImage } from '../types'

const MEDIA_API_URL = import.meta.env.VITE_DIARY_MEDIA_API_URL || '/api/diary-media'
const MAX_LOCAL_SOURCE_BYTES = 15 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type MediaResponse = { media: DiaryImage }

const getAccessToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.')
  return data.session.access_token
}

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json() as { error?: string }
    if (body.error) return body.error
  } catch { /* Fall through to the status text. */ }
  return `Không thể xử lý ảnh (${response.status}).`
}

const request = async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
  const token = await getAccessToken()
  const response = await fetch(input, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(await getErrorMessage(response))
  return response
}

export const validateLocalDiaryImage = (file: File): void => {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.')
  if (file.size > MAX_LOCAL_SOURCE_BYTES) throw new Error('Ảnh vượt quá giới hạn 15MB.')
}

export const uploadDiaryMedia = async ({ diaryId, slotOrder, file, sourceUrl, caption, onStatus }: { diaryId: string; slotOrder: number; file?: File; sourceUrl?: string; caption?: string; onStatus?: (status: 'compressing' | 'uploading') => void }): Promise<DiaryImage> => {
  if (!file && !sourceUrl) throw new Error('Chưa chọn ảnh.')
  if (file) validateLocalDiaryImage(file)
  onStatus?.(file ? 'compressing' : 'uploading')
  let response: Response
  if (file) {
    const form = new FormData()
    form.append('diaryId', diaryId)
    form.append('slotOrder', String(slotOrder))
    form.append('caption', caption ?? '')
    form.append('file', file, file.name)
    onStatus?.('uploading')
    response = await request(MEDIA_API_URL, { method: 'POST', body: form })
  } else {
    onStatus?.('uploading')
    response = await request(MEDIA_API_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'import_url', diaryId, slotOrder, sourceUrl, caption: caption ?? '' }) })
  }
  const payload = await response.json() as MediaResponse
  return payload.media
}

export const resolveDiaryMediaUrl = async (mediaId: string): Promise<string> => {
  const response = await request(`${MEDIA_API_URL}?mediaId=${encodeURIComponent(mediaId)}`, { method: 'GET' })
  const payload = await response.json() as { url: string }
  if (!payload.url) throw new Error('Không thể tạo liên kết ảnh.')
  return payload.url
}

export const syncDiaryMedia = async (diaryId: string, images: DiaryImage[]): Promise<void> => {
  await request(`${MEDIA_API_URL}?action=sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'sync', diaryId, images: images.filter((image) => Boolean(image.externalFileId)).map((image) => ({ id: image.id, position: image.position, caption: image.caption })) }) })
}
