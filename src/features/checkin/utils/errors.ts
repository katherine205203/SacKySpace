type CheckinErrorShape = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

const asErrorShape = (reason: unknown): CheckinErrorShape | null => {
  if (reason instanceof Error) return { message: reason.message }
  if (!reason || typeof reason !== 'object') return null
  return reason as CheckinErrorShape
}

/**
 * Supabase errors are plain objects rather than Error instances. Keep the
 * original message for actionable database/auth errors, while translating the
 * common schema mismatch into a message users can act on.
 */
export const getCheckinErrorMessage = (reason: unknown, fallback = 'Không thể lưu check-in.'): string => {
  const error = asErrorShape(reason)
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  const code = typeof error?.code === 'string' ? error.code : ''
  const normalized = message.toLocaleLowerCase()

  if (
    /secondary emotion|secondary_emotion|cảm xúc phụ/.test(normalized) &&
    /limit|at most|reached|tối đa|can have|has reached/.test(normalized)
  ) {
    return 'Không thể lưu 3 cảm xúc phụ vì database chưa đồng bộ rule mới. Hãy cập nhật Supabase migration rồi thử lại.'
  }

  if (/occurred_at|schema cache|column .* does not exist/.test(normalized)) {
    return 'Database Check-in chưa được cập nhật migration thời điểm trải nghiệm.'
  }

  if (code === '23505' || /duplicate key|already exists/.test(normalized)) {
    return 'Check-in này đang được lưu trùng. Hãy thử lưu lại một lần nữa; dữ liệu sẽ được giữ một bản duy nhất.'
  }

  return message || fallback
}
