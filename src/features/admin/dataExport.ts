import type { AdminExportDataset } from './types'

export type AdminExportFormat = 'csv' | 'tsv' | 'xlsx' | 'json'
export type AdminXlsxPackaging = 'workbook' | 'separate'
export type AdminExportDownloadOptions = {
  scope?: string
  selectedUserId?: string
  xlsxPackaging?: AdminXlsxPackaging
}

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

const exportMetadata = (dataset: AdminExportDataset, options: AdminExportDownloadOptions) => ({
  exported_at: new Date().toISOString(),
  app_version: '0.0.0',
  schema_version: 'admin-export-v2',
  scope: options.selectedUserId ? `${options.scope ?? 'selected_user'}:${options.selectedUserId}` : options.scope ?? 'global',
  dataset: dataset.key,
  record_count: dataset.rows.length,
})

const serializeJsonDataset = (dataset: AdminExportDataset, options: AdminExportDownloadOptions): string => JSON.stringify({
  metadata: exportMetadata(dataset, options),
  columns: getExportColumns(dataset),
  records: dataset.rows,
}, null, 2)

const textBytes = (value: string): Uint8Array => new TextEncoder().encode(value)
const blobBytes = (value: Uint8Array): ArrayBuffer => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  parts.forEach((part) => { output.set(part, offset); offset += part.length })
  return output
}

const writeU16 = (value: number): Uint8Array => new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
const writeU32 = (value: number): Uint8Array => new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])

const crc32 = (input: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of input) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** A dependency-free stored ZIP writer used for portable multi-file packages. */
export const createStoredZip = (files: readonly { name: string; data: string | Uint8Array }[]): Uint8Array => {
  const locals: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  files.forEach((file) => {
    const name = textBytes(file.name)
    const data = typeof file.data === 'string' ? textBytes(file.data) : file.data
    const checksum = crc32(data)
    const local = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), writeU16(20), writeU16(0), writeU16(0), writeU16(0), writeU16(0), writeU32(checksum), writeU32(data.length), writeU32(data.length), writeU16(name.length), writeU16(0), name, data,
    ])
    locals.push(local)
    central.push(concatBytes([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), writeU16(20), writeU16(20), writeU16(0), writeU16(0), writeU16(0), writeU16(0), writeU32(checksum), writeU32(data.length), writeU32(data.length), writeU16(name.length), writeU16(0), writeU16(0), writeU16(0), writeU16(0), writeU32(0), writeU32(offset), name,
    ]))
    offset += local.length
  })
  const centralBytes = concatBytes(central)
  return concatBytes([...locals, centralBytes, new Uint8Array([0x50, 0x4b, 0x05, 0x06]), writeU16(0), writeU16(0), writeU16(files.length), writeU16(files.length), writeU32(centralBytes.length), writeU32(offset), writeU16(0)])
}

const readU16 = (bytes: Uint8Array, offset: number): number => bytes[offset] | (bytes[offset + 1] << 8)
const readU32 = (bytes: Uint8Array, offset: number): number => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0

/** Reads ZIP packages created by createStoredZip. XLSX files are parsed by SheetJS separately. */
export const readStoredZip = (bytes: Uint8Array): Record<string, Uint8Array> => {
  const minimumEnd = Math.max(0, bytes.length - 65557)
  let end = -1
  for (let index = bytes.length - 22; index >= minimumEnd; index -= 1) {
    if (readU32(bytes, index) === 0x06054b50) { end = index; break }
  }
  if (end < 0) throw new Error('ZIP package không hợp lệ hoặc không được tạo bởi Sắc Ký.')
  const count = readU16(bytes, end + 10)
  const directoryOffset = readU32(bytes, end + 16)
  const output: Record<string, Uint8Array> = {}
  let cursor = directoryOffset
  for (let index = 0; index < count; index += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error('ZIP package có central directory không hợp lệ.')
    const method = readU16(bytes, cursor + 10)
    if (method !== 0) throw new Error('ZIP package này dùng nén không được hỗ trợ trong trình duyệt.')
    const compressedSize = readU32(bytes, cursor + 20)
    const nameLength = readU16(bytes, cursor + 28)
    const extraLength = readU16(bytes, cursor + 30)
    const commentLength = readU16(bytes, cursor + 32)
    const localOffset = readU32(bytes, cursor + 42)
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength))
    if (readU32(bytes, localOffset) !== 0x04034b50) throw new Error('ZIP package có local file header không hợp lệ.')
    const localNameLength = readU16(bytes, localOffset + 26)
    const localExtraLength = readU16(bytes, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    output[name] = bytes.slice(dataStart, dataStart + compressedSize)
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return output
}

const workbookBytes = async (datasets: readonly AdminExportDataset[], options: AdminExportDownloadOptions): Promise<Uint8Array> => {
  const xlsx = await import('xlsx')
  const workbook = xlsx.utils.book_new()
  const usedNames = new Set<string>()
  const metadataRows = [['key', 'value'], ...Object.entries({
    exported_at: new Date().toISOString(), app_version: '0.0.0', schema_version: 'admin-export-v2', scope: options.scope ?? 'global',
  })]
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(metadataRows), '__metadata')
  datasets.forEach((dataset) => {
    const columns = getExportColumns(dataset)
    const rows = [columns, ...dataset.rows.map((row) => columns.map((column) => cellToSheetValue(row[column])))]
    const worksheet = xlsx.utils.aoa_to_sheet(rows)
    worksheet['!cols'] = columns.map((column) => ({ wch: Math.min(42, Math.max(12, column.length + 2)) }))
    xlsx.utils.book_append_sheet(workbook, worksheet, safeSheetName(dataset.label, usedNames))
  })
  const output = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Uint8Array(output)
}

export const downloadAdminExport = async (datasets: readonly AdminExportDataset[], format: AdminExportFormat, options: AdminExportDownloadOptions = {}): Promise<string> => {
  if (!datasets.length) throw new Error('Không có dữ liệu để export.')
  const stamp = dateStamp()

  if (format === 'xlsx') {
    if (options.xlsxPackaging === 'separate' && datasets.length > 1) {
      const files = await Promise.all(datasets.map(async (dataset) => ({ name: `${dataset.key}.xlsx`, data: await workbookBytes([dataset], options) })))
      const manifest = { package_type: 'sacky-admin-export', format, metadata: files.map((file, index) => ({ file: file.name, ...exportMetadata(datasets[index], options) })) }
      const filename = `sacky-admin-export-${stamp}.zip`
      downloadBlob(new Blob([blobBytes(createStoredZip([{ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) }, ...files]))], { type: 'application/zip' }), filename)
      return filename
    }
    const output = await workbookBytes(datasets, options)
    const filename = `sacky-admin-export-${stamp}.xlsx`
    downloadBlob(new Blob([blobBytes(output)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
    return filename
  }

  if (format === 'json') {
    if (datasets.length === 1) {
      const dataset = datasets[0]
      const filename = `sacky-${dataset.key}-${stamp}.json`
      downloadBlob(new Blob([serializeJsonDataset(dataset, options)], { type: 'application/json;charset=utf-8' }), filename)
      return filename
    }
    const files = datasets.map((dataset) => ({ name: `${dataset.key}.json`, data: serializeJsonDataset(dataset, options) }))
    const manifest = { package_type: 'sacky-admin-export', format, metadata: datasets.map((dataset) => exportMetadata(dataset, options)) }
    const filename = `sacky-admin-export-${stamp}.zip`
    downloadBlob(new Blob([blobBytes(createStoredZip([{ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) }, ...files]))], { type: 'application/zip' }), filename)
    return filename
  }

  const delimiter = format === 'csv' ? ',' : '\t'
  if (datasets.length > 1) {
    const files = datasets.map((dataset) => ({ name: `${dataset.key}.${format}`, data: `\ufeff${serializeDelimitedDataset(dataset, delimiter)}` }))
    const manifest = { package_type: 'sacky-admin-export', format, metadata: datasets.map((dataset) => exportMetadata(dataset, options)) }
    const filename = `sacky-admin-export-${stamp}.zip`
    downloadBlob(new Blob([blobBytes(createStoredZip([{ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) }, ...files]))], { type: 'application/zip' }), filename)
    return filename
  }
  const dataset = datasets[0]
  const text = `\ufeff${serializeDelimitedDataset(dataset, delimiter)}`
  const filename = `sacky-${dataset.key === 'audit_logs' ? 'audit-log' : dataset.key}-${stamp}.${format}`
  downloadBlob(new Blob([text], { type: `${format === 'csv' ? 'text/csv' : 'text/tab-separated-values'};charset=utf-8` }), filename)
  return filename
}
