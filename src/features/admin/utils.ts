import type { AdminEntityDefinition, AdminReferenceRow } from './types'

export type ImportIssue = { row: number; message: string }
export type ImportClassification = 'new' | 'update' | 'conflict' | 'error' | 'skip'
export type ImportPreviewRow = { row: number; values: AdminReferenceRow; classification: ImportClassification; issues: string[] }

export const parseDelimitedText = (text: string): { headers: string[]; rows: AdminReferenceRow[] } => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const split = (line: string): string[] => {
    const cells: string[] = []
    let cell = ''
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; continue }
      if (char === '"') { quoted = !quoted; continue }
      if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; continue }
      cell += char
    }
    cells.push(cell.trim())
    return cells
  }
  const headers = split(lines[0]).map((header) => header.replace(/^\uFEFF/, ''))
  const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, split(line)[index] ?? ''])))
  return { headers, rows }
}

export const coerceImportValue = (value: string, type: string): unknown => {
  if (type === 'number') return value.trim() === '' ? null : Number(value)
  if (type === 'boolean') return ['true', '1', 'yes', 'y', 'có', 'active'].includes(value.trim().toLowerCase())
  if ((type === 'text' || type === 'textarea' || type === 'color') && value.trim() === '') return null
  return value
}

export const previewImport = (definition: AdminEntityDefinition, rows: AdminReferenceRow[], existing: AdminReferenceRow[]): ImportPreviewRow[] => {
  const existingById = new Map(existing.map((row) => [String(row[definition.idField] ?? ''), row]))
  return rows.map((raw, index) => {
    const issues: string[] = []
    const values: AdminReferenceRow = {}
    const id = String(raw[definition.idField] ?? '').trim()
    if (!id) issues.push(`Thiếu ${definition.idField}`)
    for (const field of definition.fields) {
      const rawValue = String(raw[field.key] ?? '')
      const value = coerceImportValue(rawValue, field.type)
      if (field.required && (value === null || value === undefined || String(value).trim() === '')) issues.push(`Thiếu ${field.key}`)
      if (field.type === 'number' && value !== null && typeof value === 'number' && Number.isNaN(value)) issues.push(`${field.key} phải là số`)
      values[field.key] = value
    }
    values[definition.idField] = id
    const known = existingById.get(id)
    const classification: ImportClassification = issues.length ? 'error' : known ? 'update' : 'new'
    return { row: index + 2, values, classification, issues }
  })
}

export const canDeleteReference = (usageCount: number): boolean => usageCount === 0

export const compareConfigValues = (published: unknown, draft: unknown): 'unchanged' | 'changed' => JSON.stringify(published) === JSON.stringify(draft) ? 'unchanged' : 'changed'
