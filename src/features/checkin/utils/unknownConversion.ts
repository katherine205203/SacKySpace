import type { CheckinDraft } from '../types'

export const convertUnknownToEmotion = (
  draft: CheckinDraft,
  primaryEmotionId: string | null = null,
  intensity: number | null = null,
): CheckinDraft => ({
  ...draft,
  checkinType: 'emotion',
  primaryEmotionId,
  intensity,
})
