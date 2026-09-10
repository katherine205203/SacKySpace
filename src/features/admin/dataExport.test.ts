import { describe, expect, it } from 'vitest'
import { getExportColumns, serializeDelimitedDataset } from './dataExport'
import type { AdminExportDataset } from './types'

const dataset: AdminExportDataset = {
  key: 'emotions',
  label: 'Cảm xúc',
  table: 'emotions',
  columns: ['emotion_id', 'emotion_name_vn', 'metadata'],
  rows: [
    { emotion_id: 'joy', emotion_name_vn: 'Vui, nhẹ', metadata: { active: true } },
    { emotion_id: 'calm', emotion_name_vn: 'Bình yên', extra: 3, metadata: null },
  ],
}

describe('Admin data export', () => {
  it('keeps configured columns first and appends columns found in rows', () => {
    expect(getExportColumns(dataset)).toEqual(['emotion_id', 'emotion_name_vn', 'metadata', 'extra'])
  })

  it('quotes delimiters, line breaks, and JSON values in delimited exports', () => {
    expect(serializeDelimitedDataset(dataset, ',')).toBe('emotion_id,emotion_name_vn,metadata,extra\r\njoy,"Vui, nhẹ","{""active"":true}",\r\ncalm,Bình yên,,3')
  })
})
