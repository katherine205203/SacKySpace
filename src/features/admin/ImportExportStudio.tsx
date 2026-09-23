import { useMemo, useState } from 'react'
import { ADMIN_ENTITY_REGISTRY, getAdminEntity } from './registry'
import { analyzeImport, findEntityKey, formatValue, getAdminEntityList, recordDiff, type ImportAnalysis, type ImportAnalysisRow, type ImportMode, type ImportRecordStatus } from './importExport'
import { downloadAdminExport, readStoredZip, type AdminExportFormat, type AdminXlsxPackaging } from './dataExport'
import { exportAdminData, listReferenceRows, deactivateReferenceRow, upsertReferenceRow, writeAudit } from './services/adminRepository'
import type { AdminAuditLog, AdminEntityKey, AdminExportDataset, AdminExportSelection, AdminReferenceRow } from './types'

type Scope = 'global' | 'selected_user' | 'all_applicable'
type DetectedFormat = 'xlsx' | 'csv' | 'tsv' | 'json' | 'zip'
type ImportStep = 'upload' | 'detect' | 'map' | 'scope' | 'validate' | 'preview' | 'confirm' | 'apply' | 'audit'
type ParsedTable = { name: string; headers: string[]; rows: AdminReferenceRow[]; suggestedKey: AdminEntityKey | null }
type ImportDraft = ParsedTable & { key: AdminEntityKey | null }
type Snapshot = { id: string; createdAt: string; scope: Scope; mode: ImportMode; datasets: Record<string, AdminReferenceRow[]> }
const snapshotStorageKey = 'sacky-admin-import-snapshots-v1'

const allExportOptions: Array<{ key: AdminExportSelection; label: string; module: string; table: string }> = [
  ...ADMIN_ENTITY_REGISTRY.map((item) => ({ key: item.key, label: item.label, module: item.module, table: item.table })),
  { key: 'audit_logs', label: 'Audit Log', module: 'Admin Studio', table: 'admin_audit_logs' },
]

const stepItems: Array<{ id: ImportStep; label: string }> = [
  { id: 'upload', label: 'Upload' }, { id: 'detect', label: 'Detect' }, { id: 'map', label: 'Map dataset' }, { id: 'scope', label: 'Select scope' }, { id: 'validate', label: 'Validate' }, { id: 'preview', label: 'Preview' }, { id: 'confirm', label: 'Confirm' }, { id: 'apply', label: 'Apply' }, { id: 'audit', label: 'Audit' },
]

const formatLabel: Record<DetectedFormat, string> = { xlsx: 'XLSX', csv: 'CSV', tsv: 'TSV', json: 'JSON', zip: 'ZIP package' }
const statusLabel: Record<ImportRecordStatus, string> = { added: 'Added', updated: 'Updated', unchanged: 'Unchanged', retired: 'Retired', error: 'Error' }
const statusOrder: ImportRecordStatus[] = ['added', 'updated', 'unchanged', 'retired', 'error']

const rowsFromMatrix = (matrix: unknown[][], name: string, hint: string): ParsedTable => {
  const headers = (matrix[0] ?? []).map((value, index) => String(value ?? `column_${index + 1}`).trim()).filter(Boolean)
  const rows = matrix.slice(1).filter((row) => row.some((value) => String(value ?? '').trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
  return { name, headers, rows, suggestedKey: findEntityKey(hint) }
}

const parseWorkbookBytes = async (bytes: ArrayBuffer | Uint8Array): Promise<ParsedTable[]> => {
  const xlsx = await import('xlsx')
  const workbook = xlsx.read(bytes, { type: 'array', cellDates: false })
  return workbook.SheetNames.filter((name) => name.toLocaleLowerCase() !== '__metadata').map((name) => rowsFromMatrix(xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' }) as unknown[][], name, name))
}

const parseJsonTables = (text: string, hint: string): ParsedTable[] => {
  const parsed = JSON.parse(text) as unknown
  if (Array.isArray(parsed)) return [rowsFromMatrix([Object.keys((parsed[0] ?? {}) as object), ...parsed.map((row) => Object.values((row ?? {}) as object))], hint || 'JSON', hint)]
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON import phải là một object hoặc array record.')
  const root = parsed as Record<string, unknown>
  const metadata = root.metadata && typeof root.metadata === 'object' ? root.metadata as Record<string, unknown> : {}
  const datasetHint = String(metadata.dataset ?? root.dataset ?? hint)
  if (Array.isArray(root.records) || Array.isArray(root.rows)) {
    const records = (root.records ?? root.rows) as unknown[]
    return [rowsFromMatrix([Object.keys((records[0] ?? {}) as object), ...records.map((row) => Object.values((row ?? {}) as object))], datasetHint || 'JSON', datasetHint)]
  }
  const groups = root.datasets && typeof root.datasets === 'object' ? root.datasets : root.modules && typeof root.modules === 'object' ? root.modules : null
  if (groups) return Object.entries(groups).flatMap(([key, value]) => Array.isArray(value) ? [rowsFromMatrix([Object.keys((value[0] ?? {}) as object), ...value.map((row) => Object.values((row ?? {}) as object))], key, key)] : [])
  throw new Error('JSON không có records, rows, datasets hoặc modules để import.')
}

const textFromBytes = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const parseZipTables = async (bytes: Uint8Array): Promise<ParsedTable[]> => {
  const files = readStoredZip(bytes)
  const manifestFile = Object.entries(files).find(([name]) => name.toLocaleLowerCase() === 'manifest.json')?.[1]
  const manifest = manifestFile ? JSON.parse(textFromBytes(manifestFile)) as { metadata?: Array<{ file?: string; dataset?: string }> } : {}
  const hints = new Map((manifest.metadata ?? []).map((item) => [item.file ?? '', item.dataset ?? '']))
  const tables: ParsedTable[] = []
  for (const [name, file] of Object.entries(files)) {
    if (name.toLocaleLowerCase() === 'manifest.json') continue
    const extension = name.split('.').pop()?.toLocaleLowerCase()
    const hint = hints.get(name) || name.split('/').pop()?.replace(/\.[^.]+$/, '') || name
    if (extension === 'xlsx' || extension === 'xls') tables.push(...await parseWorkbookBytes(file))
    else if (extension === 'json') tables.push(...parseJsonTables(textFromBytes(file), hint))
    else if (extension === 'csv' || extension === 'tsv') {
      const parsed = (await import('./utils')).parseDelimitedText(textFromBytes(file))
      tables.push({ name: hint, headers: parsed.headers, rows: parsed.rows, suggestedKey: findEntityKey(hint) })
    }
  }
  if (!tables.length) throw new Error('ZIP package không có file dataset được hỗ trợ.')
  return tables
}

const detectFormat = (file: File): DetectedFormat => {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  if (extension === 'xlsx' || extension === 'xls') return 'xlsx'
  if (extension === 'csv') return 'csv'
  if (extension === 'tsv') return 'tsv'
  if (extension === 'json') return 'json'
  if (extension === 'zip') return 'zip'
  throw new Error('Định dạng chưa được hỗ trợ. Chọn XLSX, CSV, TSV, JSON hoặc ZIP package.')
}

const datasetsFromFile = async (file: File, format: DetectedFormat): Promise<ParsedTable[]> => {
  if (format === 'xlsx') return parseWorkbookBytes(await file.arrayBuffer())
  if (format === 'json') return parseJsonTables(await file.text(), file.name)
  if (format === 'zip') return parseZipTables(new Uint8Array(await file.arrayBuffer()))
  const parsed = (await import('./utils')).parseDelimitedText(await file.text())
  return [{ name: file.name, headers: parsed.headers, rows: parsed.rows, suggestedKey: null }]
}

const toDataset = (key: AdminEntityKey, rows: AdminReferenceRow[]): AdminExportDataset => {
  const definition = getAdminEntity(key)
  return { key, label: definition.label, table: definition.table, columns: [definition.idField, ...definition.fields.map((field) => field.key)], rows }
}

const scopeOptions: Array<{ value: Scope; label: string; copy: string }> = [
  { value: 'global', label: 'Global', copy: 'Canonical data áp dụng toàn hệ thống' },
  { value: 'selected_user', label: 'Personal / selected user', copy: 'Gắn scope cho một user cụ thể' },
  { value: 'all_applicable', label: 'All applicable data', copy: 'Bao gồm mọi dataset phù hợp với quyền hiện tại' },
]

export function ImportExportStudio({ auditLogs, onChanged }: { auditLogs: AdminAuditLog[]; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<'import' | 'export' | 'history' | 'snapshots'>('import')
  const [scope, setScope] = useState<Scope>('global')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [exportKeys, setExportKeys] = useState<AdminExportSelection[]>(['emotions'])
  const [exportFormat, setExportFormat] = useState<AdminExportFormat>('xlsx')
  const [xlsxPackaging, setXlsxPackaging] = useState<AdminXlsxPackaging>('workbook')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [importStep, setImportStep] = useState<ImportStep>('upload')
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ImportDraft[]>([])
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [analyses, setAnalyses] = useState<ImportAnalysis[]>([])
  const [currentRows, setCurrentRows] = useState<Partial<Record<AdminEntityKey, AdminReferenceRow[]>>>({})
  const [selectedGroup, setSelectedGroup] = useState<ImportRecordStatus | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<{ analysis: ImportAnalysis; row: ImportAnalysisRow } | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try {
      const saved = window.localStorage.getItem(snapshotStorageKey)
      return saved ? JSON.parse(saved) as Snapshot[] : []
    } catch { return [] }
  })

  const importSummary = useMemo(() => analyses.reduce((summary, analysis) => ({
    added: summary.added + analysis.summary.added, updated: summary.updated + analysis.summary.updated, unchanged: summary.unchanged + analysis.summary.unchanged, retired: summary.retired + analysis.summary.retired, warnings: summary.warnings + analysis.summary.warnings, errors: summary.errors + analysis.summary.errors,
  }), { added: 0, updated: 0, unchanged: 0, retired: 0, warnings: 0, errors: 0 }), [analyses])
  const history = useMemo(() => auditLogs.filter((log) => log.domain === 'import_export' || /import|export|snapshot/i.test(log.action)), [auditLogs])
  const selectedGroupRows = useMemo(() => selectedGroup ? analyses.flatMap((analysis) => analysis.rows.filter((row) => row.status === selectedGroup).map((row) => ({ analysis, row }))) : [], [analyses, selectedGroup])

  const toggleExport = (key: AdminExportSelection) => setExportKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const selectAllExport = () => setExportKeys(allExportOptions.map((option) => option.key))

  const runExport = async () => {
    setExportMessage(null); setExportError(null)
    if (!exportKeys.length) { setExportError('Hãy chọn ít nhất một dataset để export.'); return }
    if (scope === 'selected_user' && !selectedUserId.trim()) { setExportError('Nhập user ID khi chọn scope Personal / selected user.'); return }
    setIsExporting(true)
    try {
      const datasets = await exportAdminData(exportKeys)
      const filename = await downloadAdminExport(datasets, exportFormat, { scope, selectedUserId: selectedUserId.trim() || undefined, xlsxPackaging })
      setExportMessage(`Đã tạo ${filename} · ${datasets.reduce((total, dataset) => total + dataset.rows.length, 0)} records. Metadata đã được đóng gói.`)
    } catch (reason: unknown) { setExportError(reason instanceof Error ? reason.message : 'Không thể export dữ liệu.') } finally { setIsExporting(false) }
  }

  const uploadImport = async (file: File) => {
    setImportError(null); setImportMessage(null); setAnalyses([]); setSelectedGroup(null); setSelectedRecord(null)
    try {
      const format = detectFormat(file)
      setDetectedFormat(format); setSourceName(file.name); setImportStep('detect')
      const parsed = await datasetsFromFile(file, format)
      setDrafts(parsed.map((table) => ({ ...table, key: table.suggestedKey })))
      setImportStep('map')
    } catch (reason: unknown) { setImportError(reason instanceof Error ? reason.message : 'Không thể đọc file import.'); setImportStep('upload') }
  }

  const runValidation = async () => {
    const mapped = drafts
    if (mapped.some((draft) => !draft.key)) { setImportError('Hãy map từng sheet / dataset vào một target dataset trước khi validate.'); return }
    if (new Set(mapped.map((draft) => draft.key)).size !== mapped.length) { setImportError('Mỗi dataset chỉ được map một lần trong cùng package.'); return }
    if (scope === 'selected_user' && !selectedUserId.trim()) { setImportError('Nhập user ID khi chọn scope Personal / selected user.'); return }
    setIsWorking(true); setImportError(null); setImportStep('validate')
    try {
      const definitions = mapped.map((draft) => getAdminEntity(draft.key as AdminEntityKey))
      const referenceKeys = [...new Set(definitions.flatMap((definition) => definition.fields.map((field) => ({ emotion_family_id: 'emotion_families', need_group_id: 'need_groups', care_action_id: 'care_actions', box_style_id: 'gift_box_styles' } as Record<string, AdminEntityKey>)[field.key]).filter((key): key is AdminEntityKey => Boolean(key))))]
      const [loaded, referenceEntries] = await Promise.all([
        Promise.all(mapped.map(async (draft) => ({ key: draft.key as AdminEntityKey, rows: await listReferenceRows(draft.key as AdminEntityKey) }))),
        Promise.all(referenceKeys.map(async (key) => ({ key, rows: await listReferenceRows(key) }))),
      ])
      const nextRows: Partial<Record<AdminEntityKey, AdminReferenceRow[]>> = {}
      loaded.forEach((item) => { nextRows[item.key] = item.rows })
      const referenceRows: Partial<Record<AdminEntityKey, AdminReferenceRow[]>> = {}
      referenceEntries.forEach((item) => { referenceRows[item.key] = item.rows })
      setCurrentRows(nextRows)
      setDrafts(mapped)
      setAnalyses(mapped.map((draft, index) => analyzeImport(definitions[index], draft.headers, draft.rows, loaded[index].rows, importMode, referenceRows)))
      setSelectedGroup(null); setSelectedRecord(null); setImportStep('preview')
    } catch (reason: unknown) { setImportError(reason instanceof Error ? reason.message : 'Không thể validate dữ liệu.'); setImportStep('map') } finally { setIsWorking(false) }
  }

  const applyImport = async () => {
    if (!analyses.length || importSummary.errors > 0) return
    if (importSummary.retired > 0 && !window.confirm(`Replace sẽ retire ${importSummary.retired} record khỏi active canonical dataset. Historical reference vẫn được giữ. Tiếp tục?`)) return
    if (!window.confirm('Tạo snapshot hiện tại và apply import? Upload sẽ bắt đầu ghi dữ liệu sau bước xác nhận này.')) return
    setIsWorking(true); setImportError(null); setImportMessage(null); setImportStep('apply')
    const snapshotId = `snapshot-${Date.now().toString(36)}`
    const snapshot: Snapshot = { id: snapshotId, createdAt: new Date().toISOString(), scope, mode: importMode, datasets: Object.fromEntries(Object.entries(currentRows).map(([key, rows]) => [key, rows ?? []])) }
    try {
      setSnapshots((current) => {
        const next = [snapshot, ...current].slice(0, 20)
        try { window.localStorage.setItem(snapshotStorageKey, JSON.stringify(next)) } catch { /* local persistence is best effort */ }
        return next
      })
      await writeAudit('import_export', 'snapshot_created', 'admin_import', snapshotId, null, { scope, mode: importMode, datasets: Object.keys(snapshot.datasets) }, null)
      for (const analysis of analyses) {
        for (const row of analysis.rows) {
          if (row.status === 'added' || row.status === 'updated') await upsertReferenceRow(analysis.key, row.values)
          if (row.status === 'retired') await deactivateReferenceRow(analysis.key, row.id)
        }
      }
      await writeAudit('import_export', 'import_apply', 'admin_import', snapshotId, { sourceName, format: detectedFormat }, { scope, mode: importMode, summary: importSummary }, null)
      await onChanged()
      setImportMessage(`Đã apply import: ${importSummary.added} Added, ${importSummary.updated} Updated, ${importSummary.unchanged} Unchanged${importSummary.retired ? `, ${importSummary.retired} Retired` : ''}. Snapshot đã được tạo.`)
      setImportStep('audit')
    } catch (reason: unknown) { setImportError(reason instanceof Error ? reason.message : 'Apply import thất bại. Snapshot vẫn được giữ trong phiên hiện tại.'); setImportStep('confirm') } finally { setIsWorking(false) }
  }

  const resetImport = () => { setImportStep('upload'); setDetectedFormat(null); setSourceName(null); setDrafts([]); setAnalyses([]); setCurrentRows({}); setSelectedGroup(null); setSelectedRecord(null); setImportMessage(null); setImportError(null) }

  const downloadSnapshot = async (snapshot: Snapshot) => {
    const datasets = Object.entries(snapshot.datasets).flatMap(([key, rows]) => key === 'audit_logs' ? [] : [toDataset(key as AdminEntityKey, rows)])
    if (datasets.length) await downloadAdminExport(datasets, 'json', { scope: snapshot.scope })
  }

  return <div className="admin-import-export">
    <section className="admin-panel admin-ie-hero"><div><span className="admin-kicker">AS21 · Single entry point</span><h2>Import / Export</h2><p>Mọi package dữ liệu đi qua cùng một flow: detect → map → validate → preview → snapshot → apply → audit.</p></div><div className="admin-ie-hero__meta"><span className="admin-badge admin-badge--success">No DB write on upload</span><span className="admin-badge">{history.length} history entries</span></div></section>
    <nav className="admin-ie-tabs" aria-label="Import / Export sections">{(['import', 'export', 'history', 'snapshots'] as const).map((item) => <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item === 'import' ? '⇧ Import' : item === 'export' ? '⇩ Export' : item === 'history' ? '◷ History' : '◫ Snapshots'}</button>)}</nav>

    {tab === 'import' && <div className="admin-ie-workspace">
      <section className="admin-panel admin-ie-flow"><div className="admin-panel__heading"><div><span className="admin-kicker">Controlled import flow</span><h3>{sourceName ?? 'Chọn một package dữ liệu'}</h3><p>Upload chỉ đọc file. Apply bị khóa nếu còn Error.</p></div>{detectedFormat && <span className="admin-badge">Detected · {formatLabel[detectedFormat]}</span>}</div><div className="admin-ie-stepper">{stepItems.map((item) => <span key={item.id} className={importStep === item.id ? 'is-active' : stepItems.findIndex((step) => step.id === importStep) > stepItems.findIndex((step) => step.id === item.id) ? 'is-done' : ''}><i>{stepItems.findIndex((step) => step.id === item.id) + 1}</i>{item.label}</span>)}</div>{importError && <p className="admin-inline-error" role="alert">{importError}</p>}{importMessage && <p className="admin-inline-success" role="status">{importMessage}</p>}
        {!sourceName && <label className="admin-ie-upload"><span>⇧</span><strong>Upload XLSX, CSV, TSV, JSON hoặc ZIP package</strong><small>ZIP được tạo từ Sắc Ký sẽ tự đọc manifest và map dataset.</small><input type="file" accept=".xlsx,.xls,.csv,.tsv,.json,.zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImport(file) }} /></label>}
        {sourceName && <div className="admin-ie-source"><div><strong>{sourceName}</strong><small>{detectedFormat ? formatLabel[detectedFormat] : 'Detecting…'} · {drafts.length} dataset candidate</small></div><button className="button button--secondary button--small" type="button" onClick={resetImport}>Upload file khác</button></div>}
      </section>

      {sourceName && <section className="admin-panel admin-ie-config"><div className="admin-panel__heading"><div><span className="admin-kicker">Map + scope</span><h3>Dataset mapping & operation</h3></div><span className="admin-badge">{drafts.filter((draft) => draft.key).length}/{drafts.length} mapped</span></div><div className="admin-ie-dataset-list">{drafts.map((draft, index) => <div className="admin-ie-dataset-row" key={`${draft.name}-${index}`}><div><strong>{draft.name}</strong><small>{draft.rows.length} rows · {draft.headers.length} columns{draft.suggestedKey ? ' · auto-detected' : ''}</small></div><select value={draft.key ?? ''} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value as AdminEntityKey || null } : item))}><option value="">Chọn target dataset…</option>{getAdminEntityList().map((item) => <option key={item.key} value={item.key}>{item.label} · {item.table}</option>)}</select></div>)}</div><div className="admin-ie-options-grid"><div><span className="admin-ie-label">Scope</span><div className="admin-ie-choice-list">{scopeOptions.map((option) => <label key={option.value} className={scope === option.value ? 'is-selected' : ''}><input type="radio" name="import-scope" checked={scope === option.value} onChange={() => setScope(option.value)} /><span><strong>{option.label}</strong><small>{option.copy}</small></span></label>)}</div>{scope === 'selected_user' && <input className="admin-ie-user-input" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} placeholder="User ID" />}</div><div><span className="admin-ie-label">Import mode</span><div className="admin-ie-mode-list"><label className={importMode === 'merge' ? 'is-selected' : ''}><input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} /><span><strong>Merge</strong><small>Giữ record không xuất hiện trong file.</small></span></label><label className={importMode === 'replace' ? 'is-selected' : ''}><input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} /><span><strong>Replace Entire Dataset</strong><small>Retire record thiếu trong file, không hard-delete historical data.</small></span></label></div></div></div><div className="admin-ie-actions"><button className="button button--primary" type="button" disabled={isWorking || !drafts.length} onClick={() => void runValidation()}>{isWorking ? 'Đang validate…' : 'Validate & preview →'}</button></div></section>}

      {analyses.length > 0 && <section className="admin-panel admin-ie-preview"><div className="admin-panel__heading"><div><span className="admin-kicker">Preview before Apply</span><h3>Import summary</h3><p>Summary mặc định; click từng nhóm để drill down tới record và diff.</p></div><span className={`admin-status-pill ${importSummary.errors ? 'is-inactive' : 'is-active'}`}>{importSummary.errors ? `${importSummary.errors} Errors` : 'Ready to review'}</span></div><div className="admin-ie-summary-grid">{statusOrder.map((status) => <button key={status} type="button" className={`admin-ie-summary-card is-${status}`} onClick={() => setSelectedGroup(selectedGroup === status ? null : status)}><strong>{importSummary[status === 'added' ? 'added' : status === 'updated' ? 'updated' : status === 'unchanged' ? 'unchanged' : status === 'retired' ? 'retired' : 'errors']}</strong><span>{statusLabel[status]}</span></button>)}<div className="admin-ie-summary-card is-warning"><strong>{importSummary.warnings}</strong><span>Warnings</span></div></div>{analyses.some((analysis) => analysis.unusedColumns.length) && <p className="admin-ie-info">Info · Unused columns: {analyses.flatMap((analysis) => analysis.unusedColumns).join(', ')}</p>}{selectedGroup && <div className="admin-ie-drilldown"><div className="admin-panel__heading"><div><span className="admin-kicker">{statusLabel[selectedGroup]}</span><h4>{selectedGroupRows.length} records</h4></div><button className="text-button" type="button" onClick={() => setSelectedGroup(null)}>Đóng nhóm</button></div><div className="admin-ie-record-list">{selectedGroupRows.map(({ analysis, row }) => <button key={`${analysis.key}-${row.id}-${row.row}`} type="button" onClick={() => setSelectedRecord({ analysis, row })}><span>{row.row ? `Row ${row.row}` : 'Existing'}</span><strong>{row.id || 'Missing ID'}</strong><small>{row.issues.map((issue) => issue.message).join(' · ') || formatValue(row.values[getAdminEntity(analysis.key).displayField])}</small></button>)}</div></div>}{selectedRecord && <div className="admin-ie-record-detail"><div><span className="admin-kicker">{selectedRecord.analysis.label} · {selectedRecord.row.id}</span><h4>{statusLabel[selectedRecord.row.status]}</h4></div><button className="modal-close" type="button" aria-label="Đóng record detail" onClick={() => setSelectedRecord(null)}>×</button><div className="admin-ie-diff-list">{recordDiff(getAdminEntity(selectedRecord.analysis.key), selectedRecord.row.existing, selectedRecord.row.values).map((diff) => <div key={diff.field}><strong>{diff.field}</strong><span>{diff.before} <b>→</b> {diff.after}</span></div>)}{selectedRecord.row.issues.map((issue, index) => <p key={`${issue.message}-${index}`} className={`admin-ie-issue is-${issue.severity}`}>{issue.severity} · {issue.message}</p>)}</div></div>}<div className="admin-ie-apply-bar"><span>{importSummary.errors ? 'Còn Error — Apply bị khóa.' : 'Validation pass — snapshot sẽ được tạo ngay trước khi apply.'}</span><button className="button button--primary" type="button" disabled={isWorking || importSummary.errors > 0} onClick={() => void applyImport()}>{isWorking ? 'Đang apply…' : 'Confirm → Create snapshot → Apply'}</button></div></section>}
    </div>}

    {tab === 'export' && <div className="admin-ie-export-layout"><section className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-kicker">Controlled export</span><h3>Scope & format</h3><p>Metadata tối thiểu được thêm vào mọi file / package.</p></div><span className="admin-badge">{exportKeys.length} datasets</span></div><div className="admin-ie-choice-list admin-ie-choice-list--wide">{scopeOptions.map((option) => <label key={option.value} className={scope === option.value ? 'is-selected' : ''}><input type="radio" name="export-scope" checked={scope === option.value} onChange={() => setScope(option.value)} /><span><strong>{option.label}</strong><small>{option.copy}</small></span></label>)}</div>{scope === 'selected_user' && <input className="admin-ie-user-input" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} placeholder="User ID" />}<div className="admin-ie-export-controls"><label className="admin-select-field"><span>Format</span><select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as AdminExportFormat)}><option value="xlsx">XLSX</option><option value="csv">CSV</option><option value="tsv">TSV</option><option value="json">JSON</option></select></label>{exportFormat === 'xlsx' && <label className="admin-select-field"><span>Multiple datasets</span><select value={xlsxPackaging} onChange={(event) => setXlsxPackaging(event.target.value as AdminXlsxPackaging)}><option value="workbook">One workbook · each dataset = sheet</option><option value="separate">Separate files · ZIP</option></select></label>}</div>{exportMessage && <p className="admin-inline-success" role="status">{exportMessage}</p>}{exportError && <p className="admin-inline-error" role="alert">{exportError}</p>}<button className="button button--primary" type="button" disabled={isExporting} onClick={() => void runExport()}>{isExporting ? 'Đang export…' : 'Export selected datasets'}</button></section><section className="admin-panel admin-ie-dataset-picker"><div className="admin-panel__heading"><div><span className="admin-kicker">Dataset</span><h3>Chọn một hoặc nhiều dataset</h3></div><div><button className="text-button" type="button" onClick={selectAllExport}>Select all</button><button className="text-button" type="button" onClick={() => setExportKeys([])}>Clear</button></div></div><div className="admin-export-options admin-ie-export-options">{allExportOptions.map((option) => <label key={option.key} className={`admin-export-option ${exportKeys.includes(option.key) ? 'is-selected' : ''}`}><input type="checkbox" checked={exportKeys.includes(option.key)} onChange={() => toggleExport(option.key)} /><span><strong>{option.label}</strong><small>{option.module} · {option.table}</small></span></label>)}</div><div className="admin-ie-metadata"><strong>Metadata included</strong><span>exported_at</span><span>app_version</span><span>schema_version</span><span>scope</span><span>dataset</span><span>record_count</span></div></section></div>}

    {tab === 'history' && <section className="admin-panel admin-ie-history"><div className="admin-panel__heading"><div><span className="admin-kicker">Audit history</span><h3>Import / Export history</h3><p>Ghi nhận source, scope, mode, summary và snapshot trước khi apply.</p></div><span className="admin-badge">{history.length} entries</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{history.map((log) => <tr key={log.id}><td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))}</td><td><strong>{log.action}</strong><small>{log.domain}</small></td><td><code>{log.entityType ?? '—'} · {log.targetId ?? '—'}</code></td><td>{formatValue(log.after)}</td></tr>)}</tbody></table>{!history.length && <p className="admin-muted admin-empty">Chưa có import/export history.</p>}</div></section>}

    {tab === 'snapshots' && <section className="admin-panel admin-ie-snapshots"><div className="admin-panel__heading"><div><span className="admin-kicker">Pre-apply state</span><h3>Snapshots</h3><p>Snapshot được tạo trước mỗi apply trong phiên Admin Studio hiện tại và giữ nguyên historical data.</p></div><span className="admin-badge">{snapshots.length} snapshots</span></div><div className="admin-snapshot-list">{snapshots.map((snapshot) => <article key={snapshot.id}><div><strong>{snapshot.id}</strong><small>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.createdAt))} · {snapshot.mode === 'merge' ? 'Merge' : 'Replace'} · {snapshot.scope}</small></div><span>{Object.keys(snapshot.datasets).length} datasets</span><button className="button button--secondary button--small" type="button" onClick={() => void downloadSnapshot(snapshot)}>Download snapshot</button></article>)}{!snapshots.length && <div className="admin-ie-empty-state"><span>◫</span><h4>Chưa có snapshot</h4><p>Snapshot sẽ xuất hiện ở đây sau khi bạn confirm một import.</p></div>}</div></section>}
  </div>
}
