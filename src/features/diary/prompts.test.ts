import { describe, expect, it } from 'vitest'
import { DEFAULT_DIARY_PROMPTS } from './prompts'

describe('Diary Prompt_DB defaults', () => {
  it('contains the ten active prompts marked for Diary', () => {
    expect(DEFAULT_DIARY_PROMPTS.map((prompt) => prompt.id)).toEqual([
      'UPR_017', 'UPR_018', 'UPR_019', 'UPR_020', 'UPR_021',
      'UPR_022', 'UPR_023', 'UPR_024', 'UPR_025', 'UPR_026',
    ])
    expect(DEFAULT_DIARY_PROMPTS.every((prompt) => /^#[0-9A-F]{6}$/i.test(prompt.hexColor))).toBe(true)
  })
})
