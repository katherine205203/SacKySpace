import { useState } from 'react'
import { downloadAdminExport, type AdminExportFormat } from './dataExport'
import { exportAdminData } from './services/adminRepository'
import type { AdminExportSelection } from './types'

export type AdminExportOption = {
  key: AdminExportSelection
  label: string
  module: string
  table: string
  kind: 'reference' | 'log'
}

export function DataExportStudio({ options, initialSelection }: { options: readonly AdminExportOption[]; initialSelection?: AdminExportSelection }) {
  const [selectedKeys, setSelectedKeys] = useState<AdminExportSelection[]>(() => initialSelection && options.some((option) => option.key === initialSelection) ? [initialSelection] : options[0] ? [options[0].key] : [])
  const [format, setFormat] = useState<AdminExportFormat>('xlsx')
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleSelection = (key: AdminExportSelection) => {
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
    setMessage(null)
    setError(null)
  }

  const selectAll = () => {
    setSelectedKeys(options.map((option) => option.key))
    setMessage(null)
    setError(null)
  }

  const clearSelection = () => {
    setSelectedKeys([])
    setMessage(null)
    setError(null)
  }

  const runExport = async () => {
    setMessage(null)
    setError(null)
    if (!selectedKeys.length) {
      setError('Hãy chọn ít nhất một dataset để export.')
      return
    }
    if (format !== 'xlsx' && selectedKeys.length > 1) {
      setError('CSV/TSV chỉ hỗ trợ một dataset. Hãy chọn XLSX để xuất nhiều sheet.')
      return
    }
    setIsExporting(true)
    try {
      const datasets = await exportAdminData(selectedKeys)
      const filename = await downloadAdminExport(datasets, format)
      setMessage(`Đã tạo ${filename} · ${datasets.reduce((total, dataset) => total + dataset.rows.length, 0)} records.`)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể export dữ liệu.')
    } finally {
      setIsExporting(false)
    }
  }

  return <section className="admin-panel admin-export-panel"><div className="admin-panel__heading"><div><span className="admin-kicker">AS21 · Data export</span><h2>Export dữ liệu</h2><p>Chọn reference table hoặc Audit Log. XLSX sẽ tạo một workbook với mỗi dataset là một sheet.</p></div><span className="admin-badge">{selectedKeys.length} đã chọn</span></div>{message && <p className="admin-inline-success" role="status">{message}</p>}{error && <p className="admin-inline-error" role="alert">{error}</p>}<div className="admin-export-toolbar"><div className="admin-export-selection-actions"><button className="text-button" type="button" onClick={selectAll}>Chọn tất cả</button><button className="text-button" type="button" onClick={clearSelection}>Bỏ chọn</button></div><label className="admin-export-format"><span>Định dạng</span><select value={format} onChange={(event) => setFormat(event.target.value as AdminExportFormat)}><option value="xlsx">Excel workbook (.xlsx)</option><option value="csv">CSV (.csv)</option><option value="tsv">TSV (.tsv)</option></select></label><button className="button button--primary button--small" type="button" disabled={isExporting} onClick={() => void runExport()}>{isExporting ? 'Đang export…' : 'Xuất dữ liệu'}</button></div><div className="admin-export-options" role="group" aria-label="Dataset để export">{options.map((option) => <label className={`admin-export-option ${selectedKeys.includes(option.key) ? 'is-selected' : ''}`} key={option.key}><input type="checkbox" checked={selectedKeys.includes(option.key)} onChange={() => toggleSelection(option.key)} /><span><strong>{option.label}</strong><small>{option.kind === 'reference' ? `${option.module} · ${option.table}` : `System log · ${option.table}`}</small></span></label>)}</div><small className="admin-form-hint">CSV/TSV chỉ xuất một dataset. Audit Log export tối đa 10.000 bản ghi gần nhất theo thời gian.</small></section>
}
