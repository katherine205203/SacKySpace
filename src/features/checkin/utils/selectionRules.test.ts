import { describe, expect, it } from 'vitest'
import { canSelect, MAX_CONTEXTS, MAX_NEEDS, MAX_SECONDARY_EMOTIONS, toggleSelection } from './selectionRules'

describe('check-in selection rules', () => {
  it('caps secondary emotions at two while still allowing removal', () => {
    expect(toggleSelection(['a'], 'b', MAX_SECONDARY_EMOTIONS)).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'c', MAX_SECONDARY_EMOTIONS)).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'a', MAX_SECONDARY_EMOTIONS)).toEqual(['b'])
  })

  it('allows selections below each configured cap', () => {
    expect(canSelect([], 'need', MAX_NEEDS)).toBe(true)
    expect(canSelect(['a', 'b'], 'context', MAX_CONTEXTS)).toBe(false)
  })
})
