import type { DiaryPrompt } from './types'

// Canonical Diary prompts from Prompt_DB where = Diary. The migration mirrors
// these records into diary_prompts when the remote reference table is updated.
export const DEFAULT_DIARY_PROMPTS: DiaryPrompt[] = [
  { id: 'UPR_017', code: 'upr_017', textVn: 'Điều gì khiến mình đang chưa cảm thấy hài lòng, trọn vẹn? Mình đang có những kỳ vọng nào? Mình đang mong điều gì khác đi?', emoji: '🌫️', hexColor: '#6F78A8' },
  { id: 'UPR_018', code: 'upr_018', textVn: 'Có nhu cầu hay mong muốn nào của bản thân mình đã xuất hiện nhưng chưa được nói ra không?', emoji: '💭', hexColor: '#9A6FC2' },
  { id: 'UPR_019', code: 'upr_019', textVn: 'Điều mình đã làm và cảm thấy xứng đáng để tự ghi nhận bản thân?', emoji: '🏅', hexColor: '#D69B3C' },
  { id: 'UPR_020', code: 'upr_020', textVn: 'Những suy nghĩ vu vơ hoặc những ‘Eureka moment’ mà mình chưa kịp chải vuốt?', emoji: '💡', hexColor: '#E0A83E' },
  { id: 'UPR_021', code: 'upr_021', textVn: 'Một trải nghiệm trong quá khứ mà mình bất chợt nhớ đến vào hôm nay?', emoji: '🕰️', hexColor: '#94745E' },
  { id: 'UPR_022', code: 'upr_022', textVn: 'Mình đã nhận ra thêm điều gì đó về bản thân mình?', emoji: '🪞', hexColor: '#7566C7' },
  { id: 'UPR_023', code: 'upr_023', textVn: 'Một điều không tích cực mà mình muốn xả ra, muốn let it go.', emoji: '🍃', hexColor: '#5DA87A' },
  { id: 'UPR_024', code: 'upr_024', textVn: 'Vùng ‘xám’ của chính mình?', emoji: '🌗', hexColor: '#73727D' },
  { id: 'UPR_025', code: 'upr_025', textVn: 'Điều “tử tế” của hôm nay mà mình nhận được hoặc cho đi.', emoji: '🌤️', hexColor: '#D48192' },
  { id: 'UPR_026', code: 'upr_026', textVn: 'Điều mình biết ơn cho hôm nay.', emoji: '🌱', hexColor: '#6EA06E' },
]
