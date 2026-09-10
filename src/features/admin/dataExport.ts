import type { AdminExportDataset } from './types'

export type AdminExportFormat = 'csv' | 'tsv' | 'xlsx'

const cellToText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const cellToSheetValue = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

export const getExportColumns = (dataset: AdminExportDataset): string[] => {
  const columns = [...dataset.columns]
  dataset.rows.forEach((row) => Object.keys(row).forEach((key) => {
    if (!columns.includes(key)) columns.push(key)
  }))
  return columns
}

const quoteDelimitedCell = (value: string, delimiter: ',' | '\t'): string => {
  if (!value.includes(delimiter) && !/["\r\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

export const serializeDelimitedDataset = (dataset: AdminExportDataset, delimiter: ',' | '\t'): string => {
  const columns = getExportColumns(dataset)
  const lines = [columns, ...dataset.rows.map((row) => columns.map((column) => cellToText(row[column])))]
  return lines.map((line) => line.map((cell) => quoteDelimitedCell(cell, delimiter)).join(delimiter)).join('\r\n')
}

const safeSheetName = (label: string, usedNames: Set<string>): string => {
  const base = ['\\', '/', '*', '?', ':', '[', ']'].reduce((value, character) => value.replaceAll(character, ' '), label).trim().slice(0, 31) || 'Sheet'
  let candidate = base
  let suffix = 2
  while (usedNames.has(candidate)) {
    const suffixText = ` (${suffix})`
    candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`
    suffix += 1
  }
  usedNames.add(candidate)
  return candidate
}

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const dateStamp = (): string => new Date().toISOString().slice(0, 10)

export const downloadAdminExport = async (datasets: readonly AdminExportDataset[], format: AdminExportFormat): Promise<string> => {
  if (!datasets.length) throw new Error('Không có dữ liệu để export.')
  if (format !== 'xlsx' && datasets.length !== 1) throw new Error('CSV/TSV chỉ hỗ trợ một dataset. Hãy chọn XLSX để xuất nhiều sheet.')

  if (format === 'xlsx') {
    const xlsx = await import('xlsx')
    const workbook = xlsx.utils.book_new()
    const usedNames = new Set<string>()
    datasets.forEach((dataset) => {
      const columns = getExportColumns(dataset)
      const rows = [columns, ...dataset.rows.map((row) => columns.map((column) => cellToSheetValue(row[column])))]
      const worksheet = xlsx.utils.aoa_to_sheet(rows)
      worksheet['!cols'] = columns.map((column) => ({ wch: Math.min(42, Math.max(12, column.length + 2)) }))
      xlsx.utils.book_append_sheet(workbook, worksheet, safeSheetName(dataset.label, usedNames))
    })
    const output = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' })
    const filename = `sacky-admin-export-${dateStamp()}.xlsx`
    downloadBlob(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
    return filename
  }

  const dataset = datasets[0]
  const delimiter = format === 'csv' ? ',' : '\t'
  const text = `\ufeff${serializeDelimitedDataset(dataset, delimiter)}`
  const filename = `sacky-${dataset.key === 'audit_logs' ? 'audit-log' : dataset.key}-${dateStamp()}.${format}`
  downloadBlob(new Blob([text], { type: `${format === 'csv' ? 'text/csv' : 'text/tab-separated-values'};charset=utf-8` }), filename)
  return filename
}
