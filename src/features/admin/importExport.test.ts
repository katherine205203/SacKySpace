import { describe, expect, it } from 'vitest'
import { getAdminEntity } from './registry'
import { analyzeImport } from './importExport'

describe('Import / Export analysis', () => {
  const definition = getAdminEntity('unknown_prompts')

  it('classifies add, update, unchanged and duplicate IDs before apply', () => {
    const existing = [{ prompt_id: 'P1', emoji: '✦', prompt_text_vn: 'Cũ', active: true, sort_order: 1 }]
    const result = analyzeImport(definition, ['prompt_id', 'emoji', 'prompt_text_vn', 'active', 'sort_order'], [
      { prompt_id: 'P1', emoji: '✦', prompt_text_vn: 'Mới', active: true, sort_order: 1 },
      { prompt_id: 'P2', emoji: '◌', prompt_text_vn: 'Thêm', active: true, sort_order: 2 },
      { prompt_id: 'P2', emoji: '◌', prompt_text_vn: 'Trùng', active: true, sort_order: 3 },
    ], existing, 'merge')

    expect(result.summary.updated).toBe(1)
    expect(result.summary.added).toBe(0)
    expect(result.summary.errors).toBe(2)
    expect(result.rows[0].status).toBe('updated')
    expect(result.rows[1].issues.some((issue) => issue.message.includes('Duplicate ID'))).toBe(true)
  })

  it('marks an existing record as retired in replace mode without deleting it', () => {
    const existing = [
      { prompt_id: 'P1', emoji: '✦', prompt_text_vn: 'Giữ', active: true, sort_order: 1 },
      { prompt_id: 'P2', emoji: '◌', prompt_text_vn: 'Retire', active: true, sort_order: 2 },
    ]
    const result = analyzeImport(definition, ['prompt_id', 'emoji', 'prompt_text_vn', 'active', 'sort_order'], [existing[0]], existing, 'replace')
    expect(result.summary.retired).toBe(1)
    expect(result.rows.find((row) => row.id === 'P2')?.status).toBe('retired')
    expect(result.rows.find((row) => row.id === 'P2')?.issues[0].severity).toBe('warning')
  })
})
