import { describe, expect, it } from 'vitest'
import { getAdminEntity } from './registry'
import { canDeleteReference, compareConfigValues, parseDelimitedText, previewImport } from './utils'

describe('Admin Studio utilities', () => {
  it('parses CSV/TSV without mutating source data', () => {
    expect(parseDelimitedText('id\tlabel_vn\nA\t"Một, hai"')).toEqual({ headers: ['id', 'label_vn'], rows: [{ id: 'A', label_vn: 'Một, hai' }] })
  })

  it('classifies import rows against the registered entity schema', () => {
    const definition = getAdminEntity('unknown_prompts')
    const result = previewImport(definition, [{ prompt_id: 'P1', emoji: '✦', prompt_text_vn: 'Một prompt', active: 'true', sort_order: '1' }, { prompt_id: '', emoji: '', prompt_text_vn: '' }], [])
    expect(result.map((row) => row.classification)).toEqual(['new', 'error'])
    expect(result[1].issues).toContain('Thiếu prompt_id')
  })

  it('protects used history and detects config drift', () => {
    expect(canDeleteReference(0)).toBe(true)
    expect(canDeleteReference(1)).toBe(false)
    expect(compareConfigValues({ value: 1 }, { value: 1 })).toBe('unchanged')
    expect(compareConfigValues(1, 2)).toBe('changed')
  })
})
