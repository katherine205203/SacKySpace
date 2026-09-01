import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, getUserMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
}))

vi.mock('../../services/supabase/client', () => ({
  supabase: { from: fromMock, auth: { getUser: getUserMock } },
}))

import { saveActionReflection, setActionStatus } from './actionService'

const builder = (result: { data?: unknown; error?: { message: string } | null }) => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update']) query[method] = vi.fn(() => query)
  query.maybeSingle = vi.fn(() => Promise.resolve(result))
  query.single = vi.fn(() => Promise.resolve(result))
  query.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve))
  return query
}

const cycle = { id: 'cycle-1', cycle_number: 1 }

describe('Action completion and reflection persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('keeps the Action completion successful when cycle history is unavailable', async () => {
    const reminderUpdate = builder({ data: null, error: null })
    const missingCycles = builder({ data: null, error: { message: 'relation "action_completion_cycles" does not exist' } })
    fromMock.mockImplementation((table: string) => table === 'reminders' ? reminderUpdate : missingCycles)

    await expect(setActionStatus('action-1', 'completed')).resolves.toEqual({ cycleId: null, historyAvailable: false })
    expect(reminderUpdate.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', completed_at: expect.any(String) }))
  })

  it('persists a selected outcome and note against the latest completion cycle', async () => {
    const cycleQuery = builder({ data: cycle, error: null })
    const reflectionInsert = builder({ data: { id: 'reflection-1' }, error: null })
    fromMock.mockImplementation((table: string) => table === 'action_completion_cycles' ? cycleQuery : reflectionInsert)

    await expect(saveActionReflection('action-1', { id: 'better', labelVn: 'Ổn hơn', semanticGroup: 'positive', sortOrder: 1 }, '  Dễ thở hơn  ')).resolves.toBeUndefined()
    expect(reflectionInsert.insert).toHaveBeenCalledWith({
      action_id: 'action-1',
      completion_cycle_id: 'cycle-1',
      outcome_id: 'better',
      outcome_snapshot: 'Ổn hơn',
      note: 'Dễ thở hơn',
    })
  })

  it('returns a retryable failure without changing the completed Action when reflection insert fails', async () => {
    const cycleQuery = builder({ data: cycle, error: null })
    const reflectionInsert = builder({ data: null, error: { message: 'temporary write failure' } })
    fromMock.mockImplementation((table: string) => table === 'action_completion_cycles' ? cycleQuery : reflectionInsert)

    await expect(saveActionReflection('action-1', { id: 'same', labelVn: 'Không có gì khác biệt', semanticGroup: 'neutral', sortOrder: 3 }, '')).rejects.toThrow('Không thể lưu reflection lúc này.')
    expect(reflectionInsert.insert).toHaveBeenCalled()
  })
})
