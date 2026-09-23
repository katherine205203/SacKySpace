import { getAdminEntity } from './registry'
import { coerceImportValue } from './utils'
import type { AdminEntityDefinition, AdminEntityKey, AdminReferenceRow } from './types'

export type ImportMode = 'merge' | 'replace'
export type ImportRecordStatus = 'added' | 'updated' | 'unchanged' | 'retired' | 'error'
export type ImportIssueSeverity = 'error' | 'warning' | 'info'
export type ImportIssue = { severity: ImportIssueSeverity; message: string }

export type ImportAnalysisRow = {
  row: number
  id: string
  values: AdminReferenceRow
  existing: AdminReferenceRow | null
  status: ImportRecordStatus
  issues: ImportIssue[]
}

export type ImportAnalysis = {
  key: AdminEntityKey
  label: string
  table: string
  headers: string[]
  rows: ImportAnalysisRow[]
  unusedColumns: string[]
  summary: { added: number; updated: number; unchanged: number; retired: number; warnings: number; errors: number }
}

const referenceTargetByField: Partial<Record<string, AdminEntityKey>> = {
  emotion_family_id: 'emotion_families',
  need_group_id: 'need_groups',
  care_action_id: 'care_actions',
  box_style_id: 'gift_box_styles',
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]))
  return value
}

const sameValue = (left: unknown, right: unknown): boolean => JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))

const normalizeValues = (definition: AdminEntityDefinition, raw: AdminReferenceRow): AdminReferenceRow => {
  const values: AdminReferenceRow = { [definition.idField]: String(raw[definition.idField] ?? '').trim() }
  definition.fields.forEach((field) => {
    const rawValue = raw[field.key]
    values[field.key] = typeof rawValue === 'string' ? coerceImportValue(rawValue, field.type) : rawValue ?? null
  })
  return values
}

const validateField = (field: AdminEntityDefinition['fields'][number], value: unknown): string[] => {
  const issues: string[] = []
  if (field.required && (value === null || value === undefined || (typeof value === 'string' && !value.trim()))) issues.push(`Thiếu ${field.key}`)
  if (field.type === 'number' && value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) issues.push(`${field.key} phải là số`)
  if (field.type === 'color' && typeof value === 'string' && value.trim() && !/^#[0-9a-f]{6}$/i.test(value.trim())) issues.push(`${field.key} phải là màu HEX hợp lệ`)
  if ((field.key === 'palette' || field.key === 'config') && typeof value === 'string' && value.trim()) {
    try { JSON.parse(value) } catch { issues.push(`${field.key} phải là JSON hợp lệ`) }
  }
  return issues
}

const getWarnings = (definition: AdminEntityDefinition, next: AdminReferenceRow, existing: AdminReferenceRow): ImportIssue[] => {
  const warnings: ImportIssue[] = []
  if (next[definition.activeField] !== undefined && !sameValue(next[definition.activeField], existing[definition.activeField])) warnings.push({ severity: 'warning', message: 'Thay đổi active / inactive' })
  if (definition.fields.some((field) => /family|category|group/i.test(field.key) && !sameValue(next[field.key], existing[field.key]))) warnings.push({ severity: 'warning', message: 'Thay đổi family / category' })
  if (definition.usedBy.length && !sameValue(next, existing)) warnings.push({ severity: 'warning', message: 'Record có historical / user references' })
  return warnings
}

export const analyzeImport = (definition: AdminEntityDefinition, headers: string[], rawRows: AdminReferenceRow[], existingRows: AdminReferenceRow[], mode: ImportMode, referenceRows: Partial<Record<AdminEntityKey, AdminReferenceRow[]>> = {}): ImportAnalysis => {
  const existingById = new Map(existingRows.map((row) => [String(row[definition.idField] ?? ''), row]))
  const incomingIds = new Set<string>()
  const duplicateIds = new Set<string>()
  const supportedColumns = new Set([definition.idField, ...definition.fields.map((field) => field.key)])
  const rows: ImportAnalysisRow[] = rawRows.map((raw, index) => {
    const values = normalizeValues(definition, raw)
    const id = String(values[definition.idField] ?? '')
    const issues: ImportIssue[] = []
    if (!id) issues.push({ severity: 'error', message: `Thiếu ${definition.idField}` })
    if (id && incomingIds.has(id)) duplicateIds.add(id)
    if (id) incomingIds.add(id)
    definition.fields.forEach((field) => {
      validateField(field, values[field.key]).forEach((message) => issues.push({ severity: 'error', message }))
      const referenceKey = referenceTargetByField[field.key]
      const referenceId = values[field.key]
      if (referenceKey && referenceId !== null && referenceId !== undefined && String(referenceId).trim() && referenceRows[referenceKey] && !referenceRows[referenceKey]?.some((reference) => String(reference[getAdminEntity(referenceKey).idField] ?? '') === String(referenceId).trim())) issues.push({ severity: 'error', message: `${field.key} tham chiếu tới ID không tồn tại` })
    })
    const existing = existingById.get(id) ?? null
    if (existing && issues.length === 0) issues.push(...getWarnings(definition, values, existing))
    const status: ImportRecordStatus = issues.some((issue) => issue.severity === 'error') ? 'error' : !existing ? 'added' : sameValue(values, normalizeValues(definition, existing)) ? 'unchanged' : 'updated'
    if (status === 'unchanged') issues.push({ severity: 'info', message: 'Không có thay đổi hiệu lực' })
    return { row: index + 2, id, values, existing, status, issues }
  })
  rows.forEach((row) => {
    if (row.id && duplicateIds.has(row.id)) {
      row.status = 'error'
      row.issues.unshift({ severity: 'error', message: 'Duplicate ID trong file import' })
    }
  })
  if (mode === 'replace') existingRows.forEach((existing) => {
    const id = String(existing[definition.idField] ?? '')
    if (id && !incomingIds.has(id)) rows.push({ row: 0, id, values: existing, existing, status: 'retired', issues: [{ severity: 'warning', message: 'Replace sẽ retire record khỏi active canonical dataset' }] })
  })
  const summary = {
    added: rows.filter((row) => row.status === 'added').length,
    updated: rows.filter((row) => row.status === 'updated').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    retired: rows.filter((row) => row.status === 'retired').length,
    warnings: rows.reduce((total, row) => total + row.issues.filter((issue) => issue.severity === 'warning').length, 0),
    errors: rows.reduce((total, row) => total + row.issues.filter((issue) => issue.severity === 'error').length, 0),
  }
  return { key: definition.key, label: definition.label, table: definition.table, headers, rows, unusedColumns: headers.filter((header) => !supportedColumns.has(header)), summary }
}

export const findEntityKey = (hint: string): AdminEntityKey | null => {
  const normalized = hint.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
  const match = getAdminEntityList().find((definition) => [definition.key, definition.table, definition.label, definition.module].some((candidate) => candidate.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '') === normalized))
  return match?.key ?? null
}

export const getAdminEntityList = (): ReturnType<typeof getAdminEntity>[] => {
  const keys: AdminEntityKey[] = ['emotion_families', 'emotions', 'need_groups', 'needs', 'contexts', 'unknown_prompts', 'care_actions', 'diary_prompts', 'action_reflection_outcomes', 'gift_box_styles']
  return keys.map((key) => getAdminEntity(key))
}

export const recordDiff = (definition: AdminEntityDefinition, existing: AdminReferenceRow | null, next: AdminReferenceRow): Array<{ field: string; before: string; after: string }> => {
  if (!existing) return definition.fields.map((field) => ({ field: field.label, before: '—', after: String(next[field.key] ?? '—') })).filter((item) => item.after !== '—')
  return definition.fields.filter((field) => !sameValue(existing[field.key], next[field.key])).map((field) => ({ field: field.label, before: formatValue(existing[field.key]), after: formatValue(next[field.key]) }))
}

export const formatValue = (value: unknown): string => value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
