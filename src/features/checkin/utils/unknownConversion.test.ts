import { describe, expect, it } from 'vitest'
import { convertUnknownToEmotion } from './unknownConversion'
import { createEmptyDraft } from '../types'

describe('Unknown conversion', () => {
  it('preserves the saved record and note while changing only the flow type', () => {
    const draft = { ...createEmptyDraft('unknown'), id: 'checkin-1', createdAt: '2026-08-27T01:00:00.000Z', unknownPromptId: 'prompt-1', note: 'Something is here.' }
    expect(convertUnknownToEmotion(draft, 'emotion-1', 3)).toEqual({ ...draft, checkinType: 'emotion', primaryEmotionId: 'emotion-1', intensity: 3 })
  })
})
