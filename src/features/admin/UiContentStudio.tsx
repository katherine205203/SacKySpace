import { useMemo, useState } from 'react'
import { adminUserError, resetUiContent, resetUiContentScope, saveUiContent } from './services/adminRepository'
import type { AdminUiContent } from './types'

type ContentFilter = 'all' | 'modified' | 'default' | 'protected'

const isModified = (row: AdminUiContent): boolean => row.textVn !== row.defaultTextVn || row.textEn !== row.defaultTextEn
const formatDate = (value: string | null): string => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

export function UiContentStudio({ rows, onChanged }: { rows: AdminUiContent[]; onChanged: () => Promise<void> }) {
  const [moduleFilter, setModuleFilter] = useState('all')
  const [screenFilter, setScreenFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContentFilter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [textVn, setTextVn] = useState('')
  const [textEn, setTextEn] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const modules = useMemo(() => [...new Set(rows.map((row) => row.module))].sort(), [rows])
  const screens = useMemo(() => [...new Set(rows.filter((row) => moduleFilter === 'all' || row.module === moduleFilter).map((row) => row.screen))].sort(), [moduleFilter, rows])
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.contentKey} ${row.module} ${row.screen} ${row.element} ${row.textVn} ${row.textEn ?? ''}`.toLowerCase()
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase())
    const matchesModule = moduleFilter === 'all' || row.module === moduleFilter
    const matchesScreen = screenFilter === 'all' || row.screen === screenFilter
    const matchesStatus = status === 'all' || status === 'protected' ? (status === 'all' || row.protected) : status === 'modified' ? isModified(row) : !isModified(row)
    return matchesSearch && matchesModule && matchesScreen && matchesStatus
  }), [moduleFilter, rows, screenFilter, search, status])
  const selected = rows.find((row) => row.contentKey === selectedKey) ?? null

  const selectModule = (value: string) => {
    setModuleFilter(value)
    setScreenFilter('all')
  }

  const runMutation = async (mutation: () => Promise<void>, success: string) => {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      await mutation()
      await onChanged()
      setNotice(success)
    } catch (reason: unknown) {
      setError(adminUserError(reason, 'Không thể cập nhật UI Content.'))
    } finally {
      setIsSaving(false)
    }
  }

  const save = () => {
    if (!selected) return
    if (selected.maxLength && selected.maxLengthMode === 'hard' && textVn.length > selected.maxLength) {
      setError(`Nội dung vượt giới hạn ${selected.maxLength} ký tự.`)
      return
    }
    void runMutation(() => saveUiContent(selected.contentKey, textVn, textEn || null), 'Đã lưu và áp dụng ngay.')
  }

  const resetElement = () => {
    if (!selected || selected.protected || !window.confirm(`Đưa “${selected.element}” về mặc định?`)) return
    setTextVn(selected.defaultTextVn)
    setTextEn(selected.defaultTextEn ?? '')
    void runMutation(() => resetUiContent(selected.contentKey), 'Đã reset element về mặc định.')
  }

  const resetScope = (scope: 'screen' | 'module') => {
    if (!selected) return
    const label = scope === 'screen' ? `${selected.module} · ${selected.screen}` : selected.module
    if (!window.confirm(`Reset toàn bộ UI Content trong ${label}?`)) return
    setTextVn(selected.defaultTextVn)
    setTextEn(selected.defaultTextEn ?? '')
    void runMutation(() => resetUiContentScope(scope, selected.module, scope === 'screen' ? selected.screen : undefined), `Đã reset ${scope === 'screen' ? 'screen' : 'module'} về mặc định.`)
  }

  const selectRow = (row: AdminUiContent) => {
    setSelectedKey(row.contentKey)
    setTextVn(row.textVn)
    setTextEn(row.textEn ?? '')
    setError(null)
    setNotice(null)
  }

  return <div className="admin-content-studio">
    <section className="admin-panel admin-content-toolbar">
      <div className="admin-panel__heading"><div><span className="admin-kicker">AS20 · Runtime copy registry</span><h2>UI Content</h2><p>Chỉnh copy có ý nghĩa theo Module → Screen → Element. Save áp dụng ngay; không có draft/publish và không đụng business rules.</p></div><span className="admin-badge">{filteredRows.length}/{rows.length} records</span></div>
      <div className="admin-content-filters">
        <label className="admin-select-field"><span>Module</span><select value={moduleFilter} onChange={(event) => selectModule(event.target.value)}><option value="all">Tất cả module</option>{modules.map((module) => <option key={module} value={module}>{module}</option>)}</select></label>
        <label className="admin-select-field"><span>Screen</span><select value={screenFilter} onChange={(event) => setScreenFilter(event.target.value)}><option value="all">Tất cả screen</option>{screens.map((screen) => <option key={screen} value={screen}>{screen}</option>)}</select></label>
        <label className="admin-search admin-content-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm key, element hoặc copy…" /></label>
        <label className="admin-select-field"><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as ContentFilter)}><option value="all">Tất cả</option><option value="modified">Modified</option><option value="default">Default</option><option value="protected">Protected</option></select></label>
      </div>
    </section>

    {!rows.length && <section className="admin-panel admin-empty-panel"><h2>Chưa có UI Content registry</h2><p>Hãy chạy migration <code>20260902000000_ui_content_registry.sql</code> rồi tải lại Admin Studio.</p></section>}
    {rows.length > 0 && <div className="admin-content-layout">
      <section className="admin-panel admin-content-list"><div className="admin-content-list__summary"><span>Chọn một dòng để mở editor</span><div><button className="text-button" type="button" disabled={!selected || isSaving} onClick={resetElement}>Reset element</button><button className="text-button" type="button" disabled={!selected || isSaving} onClick={() => resetScope('screen')}>Reset Screen</button><button className="text-button" type="button" disabled={!selected || isSaving} onClick={() => resetScope('module')}>Reset Module</button></div></div><div className="admin-table-wrap"><table className="admin-table admin-content-table"><thead><tr><th>Element</th><th>Module · Screen</th><th>Type</th><th>Current Vietnamese</th><th>Status</th><th>Updated</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.contentKey} className={row.contentKey === selectedKey ? 'is-selected' : ''} onClick={() => selectRow(row)}><td><strong>{row.element}</strong><small><code>{row.contentKey}</code></small></td><td>{row.module}<small>{row.screen}</small></td><td><span className="admin-content-type">{row.elementType}</span></td><td><span className="admin-content-current">{row.textVn}</span>{isModified(row) && <span className="admin-content-modified">Modified</span>}</td><td>{row.protected ? <span className="admin-status-pill is-draft">Protected</span> : <span className={`admin-status-pill ${row.active ? 'is-active' : 'is-inactive'}`}>{row.active ? 'Active' : 'Inactive'}</span>}</td><td>{formatDate(row.updatedAt)}</td></tr>)}</tbody></table>{!filteredRows.length && <p className="admin-muted admin-empty">Không có content key phù hợp bộ lọc.</p>}</div></section>
      <ContentEditor selected={selected} textVn={textVn} textEn={textEn} isSaving={isSaving} error={error} onTextVnChange={setTextVn} onTextEnChange={setTextEn} onSave={save} onReset={resetElement} />
    </div>}
    {notice && <div className="admin-inline-success" role="status">{notice}</div>}
  </div>
}

function ContentEditor({ selected, textVn, textEn, isSaving, error, onTextVnChange, onTextEnChange, onSave, onReset }: { selected: AdminUiContent | null; textVn: string; textEn: string; isSaving: boolean; error: string | null; onTextVnChange: (value: string) => void; onTextEnChange: (value: string) => void; onSave: () => void; onReset: () => void }) {
  if (!selected) return <aside className="admin-panel admin-drawer admin-drawer--empty"><span className="admin-drawer-icon">✦</span><h2>Chọn một content key</h2><p>Editor chỉ expose copy và context. Key, placement, business logic và protected records vẫn được giữ nguyên.</p></aside>
  const overLimit = Boolean(selected.maxLength && textVn.length > selected.maxLength)
  const isWarning = overLimit && selected.maxLengthMode === 'warning'
  return <aside className="admin-panel admin-content-editor"><div className="admin-drawer__header"><div><span className="admin-kicker">{selected.module} · {selected.screen}</span><h2>{selected.element}</h2><code>{selected.contentKey}</code></div><span className={`admin-status-pill ${selected.protected ? 'is-draft' : isModified(selected) ? 'is-draft' : 'is-active'}`}>{selected.protected ? 'Protected' : isModified(selected) ? 'Modified' : 'Default'}</span></div><div className="admin-content-context"><span><b>Type</b>{selected.elementType}</span><span><b>Placement</b>{selected.placementHint ?? '—'}</span></div><label className="admin-form-field admin-form-field--wide"><span>Tiếng Việt <b className="admin-required">*</b></span><textarea value={textVn} disabled={selected.protected} onChange={(event) => onTextVnChange(event.target.value)} rows={4} maxLength={selected.maxLengthMode === 'hard' ? selected.maxLength ?? undefined : undefined} /><small className={isWarning ? 'is-warning' : overLimit ? 'is-error' : ''}>{textVn.length}{selected.maxLength ? ` / ${selected.maxLength} characters` : ' characters'}{isWarning ? ' · Warning: vẫn có thể lưu' : ''}</small></label><label className="admin-form-field admin-form-field--wide"><span>English <small>(optional)</small></span><textarea value={textEn} disabled={selected.protected} onChange={(event) => onTextEnChange(event.target.value)} rows={3} /></label><div className="admin-content-default"><span>Default Vietnamese</span><p>{selected.defaultTextVn}</p></div>{error && <p className="admin-inline-error" role="alert">{error}</p>}<div className="admin-drawer__actions"><button className="button button--secondary button--small" type="button" disabled={selected.protected || isSaving} onClick={onReset}>Reset element</button><button className="button button--primary button--small" type="button" disabled={selected.protected || isSaving || !textVn.trim()} onClick={onSave}>Save & apply</button></div><p className="admin-form-hint">Updated {formatDate(selected.updatedAt)} · {selected.updatedBy ? `by ${selected.updatedBy}` : 'seed default'}</p></aside>
}
