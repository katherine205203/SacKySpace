export const CHECKIN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const getParts = (value: Date): Record<string, string> => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHECKIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export const isoToDateTimeLocal = (iso: string): string => {
  const parts = getParts(new Date(iso))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export const nowAsDateTimeLocal = (): string => {
  const parts = getParts(new Date())
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export const dateTimeLocalToIso = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Vui lòng chọn đầy đủ ngày, giờ và phút.')
  const parsed = new Date(`${value}:00+07:00`)
  if (Number.isNaN(parsed.getTime())) throw new Error('Thời điểm trải nghiệm không hợp lệ.')
  return parsed.toISOString()
}
