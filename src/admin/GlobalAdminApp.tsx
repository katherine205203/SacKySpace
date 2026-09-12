import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, signIn, signOut, subscribeToAuthChanges } from '../services/supabase/auth'
import { ADMIN_ENTITY_REGISTRY, getAdminEntity } from '../features/admin/registry'
import type { AdminEntityKey, AdminField, AdminReferenceRow } from '../features/admin/types'
import {
  adminErrorMessage,
  executeGlobalAdminOperation,
  getGlobalAdminIdentity,
  getGlobalAdminOverview,
  listCanonicalRows,
  listGlobalAdminUsers,
  previewGlobalAdminOperation,
  saveCanonicalRow,
  type GlobalAdminAction,
  type GlobalAdminIdentity,
  type GlobalAdminImpact,
  type GlobalAdminOverview,
  type GlobalAdminScope,
  type GlobalAdminUser,
} from './globalAdminRepository'

type AdminView = 'overview' | 'users' | 'canonical' | 'scopes' | 'overrides' | 'recovery' | 'runtime' | 'health'

const navigation: Array<{ id: AdminView; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'users', label: 'Users', icon: '♙' },
  { id: 'canonical', label: 'Canonical Data', icon: '◫' },
  { id: 'scopes', label: 'Scopes', icon: '⌘' },
  { id: 'overrides', label: 'Overrides', icon: '✎' },
  { id: 'recovery', label: 'Reset & Repair', icon: '⟳' },
  { id: 'runtime', label: 'Runtime', icon: '▷' },
  { id: 'health', label: 'System Health', icon: '⌁' },
]

const actionLabels: Record<GlobalAdminAction, string> = {
  repair_references: 'Repair references',
  migrate_occurred_at: 'Run occurred_at migration',
  export_account_package: 'Export account package',
  full_factory_reset: 'Full factory reset',
}

const actionCopy: Record<GlobalAdminAction, string> = {
  repair_references: 'Tạo Diary còn thiếu và gắn lại Check-in vào đúng ngày trải nghiệm. Không đọc hay sửa nội dung riêng tư.',
  migrate_occurred_at: 'Kiểm tra backfill occurred_at và đồng bộ lại liên kết Diary theo thời điểm trải nghiệm.',
  export_account_package: 'Đưa yêu cầu export vào hàng đợi có kiểm soát. Nội dung riêng tư không hiển thị trong màn hình admin.',
  full_factory_reset: 'Xoá dữ liệu account theo scope. Đây là thao tác nguy hiểm, không thể hoàn tác.',
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (value: string | null) => value ? dateFormatter.format(new Date(value)) : 'Chưa hoạt động'
const compactNumber = (value: number) => new Intl.NumberFormat('vi-VN', { notation: value >= 1_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
const initials = (email: string) => email.split('@')[0].slice(0, 2).toUpperCase() || 'SK'

export function GlobalAdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void getSession().then((nextSession) => {
      if (mounted) setSession(nextSession)
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    const { data } = subscribeToAuthChanges((_event, nextSession) => {
      if (mounted) setSession(nextSession)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <AdminState title="Đang xác thực" copy="Đang mở Global Admin an toàn…" />
  if (!session) return <GlobalAdminSignIn />
  return <GlobalAdminWorkspace />
}

function GlobalAdminSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (reason) {
      setError(adminErrorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="global-admin-login">
    <section className="global-admin-login__panel" aria-labelledby="global-admin-login-title">
      <div className="global-admin-logo"><span aria-hidden="true">S</span><strong>SacKy</strong></div>
      <p className="global-admin-kicker">SacKy · Global Admin</p>
      <h1 id="global-admin-login-title">Global control plane</h1>
      <p>Đăng nhập bằng tài khoản được cấp platform role. Đây là frontend quản trị tách biệt với ứng dụng người dùng.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label><span>Mật khẩu</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="global-admin-error" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Mở Global Admin'}</button>
      </form>
      <small>Role guard được kiểm tra lại ở Supabase cho mọi thao tác đặc quyền.</small>
    </section>
  </main>
}

function GlobalAdminWorkspace() {
  const [identity, setIdentity] = useState<GlobalAdminIdentity | null>(null)
  const [overview, setOverview] = useState<GlobalAdminOverview | null>(null)
  const [users, setUsers] = useState<GlobalAdminUser[]>([])
  const [view, setView] = useState<AdminView>('overview')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [operation, setOperation] = useState<GlobalAdminAction | null>(null)

  const refresh = useCallback(async (nextSearch: string, nextStatus: 'all' | 'active' | 'inactive') => {
    setLoading(true)
    setError(null)
    try {
      const [nextIdentity, nextOverview, nextUsers] = await Promise.all([
        getGlobalAdminIdentity(),
        getGlobalAdminOverview(),
        listGlobalAdminUsers(nextSearch, nextStatus),
      ])
      setIdentity(nextIdentity)
      setOverview(nextOverview)
      setUsers(nextUsers)
      setSelectedUserIds((current) => current.filter((id) => nextUsers.some((user) => user.userId === id)))
      setSelectedUserId((current) => current && nextUsers.some((user) => user.userId === current) ? current : nextUsers[0]?.userId ?? null)
    } catch (reason) {
      setError(adminErrorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => { void refresh('', 'all') }, 0)
    return () => window.clearTimeout(request)
  }, [refresh])

  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? null
  const scope: GlobalAdminScope = { mode: 'selected', userIds: selectedUserIds }
  const canRunAllUsers = identity?.role === 'super_admin'

  const toggleUser = (userId: string) => setSelectedUserIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])
  const runSearch = () => void refresh(search, status)
  const selectAllVisible = () => setSelectedUserIds(users.map((user) => user.userId))

  if (loading && !identity) return <AdminState title="Đang nạp Global Admin" copy="Đang kiểm tra platform role và read-model quản trị…" />
  if (error && !identity) return <AdminState title="Không thể mở Global Admin" copy={error} action="Thử lại" onAction={() => void refresh(search, status)} error />

  return <main className="global-admin-shell">
    <aside className="global-admin-sidebar">
      <div className="global-admin-brand"><span aria-hidden="true">S</span><strong>SacKy</strong></div>
      <nav aria-label="Global Admin navigation">
        {navigation.map((item) => <button key={item.id} type="button" className={view === item.id ? 'is-active' : ''} onClick={() => { setView(item.id); setNotice(null) }}><i aria-hidden="true">{item.icon}</i>{item.label}</button>)}
      </nav>
      <div className="global-admin-sidebar__footer">
        <span className="global-admin-role"><b>{identity?.role === 'super_admin' ? '◆' : '●'}</b>{identity?.role === 'super_admin' ? 'Super Admin' : 'Platform Admin'}</span>
        <button type="button" className="global-admin-signout" onClick={() => void signOut()}>Đăng xuất</button>
      </div>
    </aside>

    <section className="global-admin-main">
      <header className="global-admin-header">
        <div><p className="global-admin-kicker">SacKy · Global Admin</p><h1>{pageTitle(view)}</h1><p>{pageDescription(view)}</p></div>
        <div className="global-admin-header__meta"><span className="global-admin-env"><i /> Production</span><span className="global-admin-version">v2.1</span><div className="global-admin-avatar">{initials(identity?.email ?? '')}</div><div><strong>{identity?.email.split('@')[0] || 'Admin'}</strong><small>{identity?.role === 'super_admin' ? 'Super Admin' : 'Platform Admin'}</small></div></div>
      </header>

      <nav className="global-admin-tabs" aria-label="Global Admin sections">{navigation.map((item) => <button key={item.id} className={view === item.id ? 'is-active' : ''} type="button" onClick={() => setView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>

      {notice && <p className="global-admin-notice" role="status">{notice}</p>}
      {error && <p className="global-admin-error" role="alert">{error}</p>}

      {view === 'overview' && overview && <OverviewView overview={overview} onNavigate={setView} onOperation={setOperation} />}
      {view === 'users' && <UsersView users={users} search={search} status={status} selectedUser={selectedUser} selectedUserIds={selectedUserIds} setSearch={setSearch} setStatus={setStatus} onSearch={runSearch} onToggleUser={toggleUser} onSelectUser={setSelectedUserId} onSelectAll={selectAllVisible} onClearSelection={() => setSelectedUserIds([])} onOperation={setOperation} />}
      {view === 'canonical' && <CanonicalView onNotice={setNotice} onError={setError} />}
      {view === 'scopes' && <ScopesView users={users} selectedUserIds={selectedUserIds} canRunAllUsers={canRunAllUsers} onToggleUser={toggleUser} onSelectAll={selectAllVisible} onClearSelection={() => setSelectedUserIds([])} onOperation={setOperation} />}
      {view === 'recovery' && <RecoveryView scope={scope} canRunAllUsers={canRunAllUsers} onOperation={setOperation} />}
      {['overrides', 'runtime', 'health'].includes(view) && <ComingSoonView view={view} />}
    </section>

    {operation && <OperationDialog action={operation} initialScope={scope} canRunAllUsers={canRunAllUsers} onClose={() => setOperation(null)} onCompleted={(message) => { setOperation(null); setNotice(message); void refresh(search, status) }} />}
  </main>
}

function OverviewView({ overview, onNavigate, onOperation }: { overview: GlobalAdminOverview; onNavigate: (view: AdminView) => void; onOperation: (action: GlobalAdminAction) => void }) {
  return <div className="global-admin-page-stack">
    <section className="global-admin-overview-grid">
      <article className="global-admin-hero"><div><p>SẮC KÝ PLATFORM</p><h2>Control plane ổn định<span>.</span></h2><strong><i /> Tất cả hệ thống hoạt động tốt</strong><small>Global Admin thao tác qua scope, impact preview và typed operations.</small></div><div className="global-admin-orbit" aria-hidden="true"><b>S</b><i /><em /><span /></div></article>
      <Metric label="Tổng người dùng" value={compactNumber(overview.totalUsers)} icon="♙" tone="violet" />
      <Metric label="Hoạt động hôm nay" value={compactNumber(overview.activeToday)} icon="▥" tone="mint" />
      <Metric label="Dữ liệu chuẩn" value={compactNumber(overview.canonicalItems)} icon="◫" tone="blue" />
      <Metric label="Tác vụ chờ xử lý" value={compactNumber(overview.pendingOperations)} icon="◷" tone="mango" />
    </section>
    <section className="global-admin-three-columns">
      <article className="global-admin-panel"><PanelHeading title="Tình trạng nền tảng" action="Xem chi tiết" /><HealthList /></article>
      <article className="global-admin-panel"><PanelHeading title="Thao tác nhanh" /><div className="global-admin-quick-actions"><button type="button" onClick={() => onNavigate('users')}><span>♙</span><div><strong>Mở quản lý người dùng</strong><small>Tìm kiếm, xem metadata và chạy typed actions</small></div><b>›</b></button><button type="button" onClick={() => onNavigate('canonical')}><span>◫</span><div><strong>Xem dữ liệu canonical</strong><small>Catalog chuẩn có version và usage</small></div><b>›</b></button><button type="button" onClick={() => onOperation('migrate_occurred_at')}><span>▷</span><div><strong>Chạy kiểm tra migration</strong><small>Đồng bộ occurred_at và Diary attachment</small></div><b>›</b></button><button type="button" onClick={() => onNavigate('recovery')}><span>⟳</span><div><strong>Mở trung tâm khôi phục</strong><small>Repair reference và tác vụ kiểm soát</small></div><b>›</b></button></div></article>
      <article className="global-admin-panel"><PanelHeading title="Thay đổi gần đây" action="Tất cả" /><RecentOperations operations={overview.recentOperations} /></article>
    </section>
    <section className="global-admin-bottom-grid"><ScopeSnapshot label="Scope builder nhanh" copy="Chọn người dùng hoặc mở Scopes để tạo phạm vi thao tác." /><article className="global-admin-privacy"><span>◈</span><div><h3>Bảo vệ quyền riêng tư</h3><p>Global Admin chỉ xem metadata và aggregate count. Nội dung Diary, Check-in và ghi chú riêng tư không mở trong control plane.</p></div></article></section>
  </div>
}

function UsersView({ users, search, status, selectedUser, selectedUserIds, setSearch, setStatus, onSearch, onToggleUser, onSelectUser, onSelectAll, onClearSelection, onOperation }: { users: GlobalAdminUser[]; search: string; status: 'all' | 'active' | 'inactive'; selectedUser: GlobalAdminUser | null; selectedUserIds: string[]; setSearch: (value: string) => void; setStatus: (value: 'all' | 'active' | 'inactive') => void; onSearch: () => void; onToggleUser: (id: string) => void; onSelectUser: (id: string) => void; onSelectAll: () => void; onClearSelection: () => void; onOperation: (action: GlobalAdminAction) => void }) {
  return <div className="global-admin-page-stack">
    <section className="global-admin-filter-bar"><label className="global-admin-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSearch() }} placeholder="Tìm theo email hoặc user ID…" /></label><label><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Tất cả</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label><span>Data version</span><select disabled><option>v2.1</option></select></label><button type="button" onClick={onSearch}>⟳ Làm mới</button></section>
    <section className="global-admin-users-layout">
      <article className="global-admin-panel global-admin-user-table"><div className="global-admin-table-heading"><div><h2>Danh sách người dùng</h2><small>{users.length} users trong read-model hiện tại</small></div><div><button type="button" onClick={onSelectAll}>Chọn tất cả</button><button type="button" onClick={onClearSelection}>Bỏ chọn</button></div></div><div className="global-admin-table-scroll"><table><thead><tr><th aria-label="Chọn" /><th>Người dùng</th><th>Trạng thái</th><th>Hoạt động cuối</th><th>Data version</th><th>Overrides</th><th>Tuỳ chỉnh</th></tr></thead><tbody>{users.map((user) => <tr key={user.userId} className={selectedUser?.userId === user.userId ? 'is-selected' : ''} onClick={() => onSelectUser(user.userId)}><td onClick={(event) => event.stopPropagation()}><input aria-label={`Chọn ${user.email}`} type="checkbox" checked={selectedUserIds.includes(user.userId)} onChange={() => onToggleUser(user.userId)} /></td><td><span className="global-admin-table-user"><i>{initials(user.email)}</i><span><strong>{user.email.split('@')[0]}</strong><small>{user.email}</small></span></span></td><td><StatusPill status={user.accountStatus} /></td><td>{formatDate(user.lastActiveAt)}</td><td>{user.dataVersion}</td><td><b className="global-admin-count-badge">{user.overrideCount}</b></td><td><b className="global-admin-count-badge is-purple">{user.customCount}</b></td></tr>)}</tbody></table>{!users.length && <p className="global-admin-empty">Không có user khớp với bộ lọc này.</p>}</div></article>
      <UserDetail user={selectedUser} onOperation={onOperation} />
    </section>
    <section className="global-admin-bottom-grid"><ScopeSnapshot label="Thao tác theo phạm vi" copy={selectedUserIds.length ? `Đã chọn ${selectedUserIds.length} người dùng để preview thao tác.` : 'Tick người dùng trong bảng để tạo phạm vi thao tác.'} /><article className="global-admin-impact-teaser"><p>Ước lượng tác động</p><strong>{selectedUserIds.length ? `${selectedUserIds.length} accounts` : 'Chọn một scope'}</strong><small>Impact Preview luôn được tính trước khi Execute.</small></article></section>
  </div>
}

function CanonicalView({ onNotice, onError }: { onNotice: (message: string | null) => void; onError: (message: string | null) => void }) {
  const [entityKey, setEntityKey] = useState<AdminEntityKey>('emotion_families')
  const [rows, setRows] = useState<AdminReferenceRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const definition = getAdminEntity(entityKey)
  const selected = rows.find((row) => String(row[definition.idField]) === selectedId) ?? rows[0] ?? null

  const load = useCallback(async (nextKey: AdminEntityKey) => {
    setLoading(true)
    onError(null)
    try {
      const nextRows = await listCanonicalRows(nextKey)
      const nextDefinition = getAdminEntity(nextKey)
      setRows(nextRows)
      setSelectedId(nextRows.length ? String(nextRows[0][nextDefinition.idField]) : null)
    } catch (reason) {
      onError(adminErrorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    const request = window.setTimeout(() => { void load(entityKey) }, 0)
    return () => window.clearTimeout(request)
  }, [entityKey, load])
  const filteredRows = rows.filter((row) => String(row[definition.displayField] ?? '').toLocaleLowerCase().includes(search.toLocaleLowerCase()) || String(row[definition.idField]).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const save = async (patch: AdminReferenceRow) => {
    if (!selected) return
    setSaving(true)
    onError(null)
    try {
      await saveCanonicalRow(entityKey, String(selected[definition.idField]), patch)
      onNotice('Đã lưu thay đổi canonical. User chưa override sẽ nhận dữ liệu chuẩn mới.')
      await load(entityKey)
    } catch (reason) {
      onError(adminErrorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  return <div className="global-admin-page-stack">
    <section className="global-admin-catalog-tabs">{ADMIN_ENTITY_REGISTRY.map((entity) => <button key={entity.key} className={entity.key === entityKey ? 'is-active' : ''} type="button" onClick={() => { setLoading(true); setEntityKey(entity.key) }}><span>{catalogIcon(entity.key)}</span><strong>{entity.label}</strong><small>{entity.module}</small></button>)}</section>
    <section className="global-admin-canonical-layout">
      <article className="global-admin-panel global-admin-canonical-table"><div className="global-admin-filter-inline"><label className="global-admin-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Tìm trong ${definition.label.toLocaleLowerCase()}…`} /></label><span>{filteredRows.length} records</span></div>{loading ? <p className="global-admin-empty">Đang tải canonical data…</p> : <div className="global-admin-table-scroll"><table><thead><tr><th>Tên</th><th>ID</th><th>Trạng thái</th><th>Thứ tự</th></tr></thead><tbody>{filteredRows.map((row) => { const id = String(row[definition.idField]); return <tr key={id} className={id === String(selected?.[definition.idField] ?? '') ? 'is-selected' : ''} onClick={() => setSelectedId(id)}><td><span className="global-admin-canonical-name"><i>{String(row.emoji ?? catalogIcon(entityKey))}</i><strong>{String(row[definition.displayField] ?? id)}</strong></span></td><td><code>{id}</code></td><td><StatusPill status={row[definition.activeField] === false ? 'inactive' : 'active'} /></td><td>{String(row[definition.sortField] ?? '—')}</td></tr> })}</tbody></table></div>}</article>
      <CanonicalEditor key={selected ? `${entityKey}:${String(selected[definition.idField])}` : `${entityKey}:empty`} definition={definition} row={selected} saving={saving} onSave={save} />
    </section>
    <section className="global-admin-bottom-grid"><article className="global-admin-panel global-admin-propagation"><h3>Quy tắc lan truyền & ghi đè</h3><div><span>♙</span><strong>Người dùng mặc định</strong><small>Nhận canonical hiện hành khi chưa có personal override.</small></div><div><span>✎</span><strong>Override được giữ lại</strong><small>Global update không tự ghi đè tùy chỉnh cá nhân.</small></div><div><span>◫</span><strong>Lịch sử bảo toàn snapshot</strong><small>Deactivate/delete loại item khỏi active catalog, không phá record lịch sử.</small></div></article><article className="global-admin-panel global-admin-impact-panel"><h3>Force write & Phạm vi áp dụng</h3><p>Force write qua Scope + Impact Preview sẽ được mở sau khi personal override registry được rollout. Canonical editor hiện chỉ cập nhật default toàn hệ thống.</p><button type="button" disabled>Chọn scope để Force Write</button></article><article className="global-admin-panel global-admin-impact-panel"><h3>Xem trước ảnh hưởng</h3><p>Usage và snapshot được hiển thị trước thao tác destructive. Không có direct edit nội dung Diary hoặc Check-in.</p><button type="button" disabled>Impact Preview</button></article></section>
  </div>
}

function ScopesView({ users, selectedUserIds, canRunAllUsers, onToggleUser, onSelectAll, onClearSelection, onOperation }: { users: GlobalAdminUser[]; selectedUserIds: string[]; canRunAllUsers: boolean; onToggleUser: (id: string) => void; onSelectAll: () => void; onClearSelection: () => void; onOperation: (action: GlobalAdminAction) => void }) {
  return <div className="global-admin-page-stack"><section className="global-admin-panel global-admin-scope-builder"><div><p className="global-admin-kicker">Scope resolver</p><h2>Chọn phạm vi trước khi execute</h2><p>V1 hỗ trợ 1 user hoặc selected users. All users chỉ mở cho Super Admin và luôn có confirmation mạnh.</p></div><div className="global-admin-scope-cards"><article className={selectedUserIds.length === 1 ? 'is-active' : ''}><span>♙</span><strong>1 người dùng</strong><small>{selectedUserIds.length === 1 ? 'Đang chọn 1 account' : 'Chọn một account trong Users'}</small></article><article className={selectedUserIds.length > 1 ? 'is-active' : ''}><span>⌘</span><strong>Nhóm người dùng</strong><small>{selectedUserIds.length > 1 ? `${selectedUserIds.length} accounts đã chọn` : 'Danh sách chọn thủ công'}</small></article><article><span>⌁</span><strong>Theo bộ lọc</strong><small>Reserved cho cohort / feature flag</small></article><article className={canRunAllUsers ? '' : 'is-disabled'}><span>◎</span><strong>Tất cả người dùng</strong><small>{canRunAllUsers ? 'Cần confirmation mạnh' : 'Chỉ Super Admin'}</small></article></div><div className="global-admin-scope-actions"><button type="button" onClick={onSelectAll}>Chọn tất cả hiển thị</button><button type="button" onClick={onClearSelection}>Xoá selection</button><button type="button" className="is-primary" disabled={!selectedUserIds.length} onClick={() => onOperation('repair_references')}>Preview repair references</button></div></section><section className="global-admin-panel"><PanelHeading title="Selection hiện tại" /><div className="global-admin-selected-users">{users.map((user) => <label key={user.userId}><input type="checkbox" checked={selectedUserIds.includes(user.userId)} onChange={() => onToggleUser(user.userId)} /><span>{initials(user.email)}</span><b>{user.email}</b></label>)}</div></section></div>
}

function RecoveryView({ scope, canRunAllUsers, onOperation }: { scope: GlobalAdminScope; canRunAllUsers: boolean; onOperation: (action: GlobalAdminAction) => void }) {
  return <div className="global-admin-page-stack"><section className="global-admin-recovery-grid"><ActionCard action="repair_references" enabled={scope.userIds.length > 0} onClick={onOperation} /><ActionCard action="migrate_occurred_at" enabled={scope.userIds.length > 0} onClick={onOperation} /><ActionCard action="export_account_package" enabled={scope.userIds.length > 0} onClick={onOperation} /><ActionCard action="full_factory_reset" enabled={scope.userIds.length > 0 && canRunAllUsers} onClick={onOperation} danger /></section><section className="global-admin-panel global-admin-privacy-note"><span>◈</span><div><h2>Privacy boundary</h2><p>Recovery và migration chạy từ typed server operation. Màn hình admin không cho phép mở hoặc chỉnh sửa text Diary, Check-in hay ghi chú cá nhân.</p></div></section></div>
}

function ComingSoonView({ view }: { view: AdminView }) {
  const copy: Record<'overrides' | 'runtime' | 'health', { title: string; detail: string }> = {
    overrides: { title: 'Override registry', detail: 'Personal override registry đang được chuẩn bị để quan sát adoption, collision và force write an toàn theo scope.' },
    runtime: { title: 'Runtime control', detail: 'Runtime configuration tiếp tục là control surface riêng, chỉ áp dụng sau versioning và validation.' },
    health: { title: 'System Health', detail: 'Database, storage, processing, scheduler và integrations sẽ báo health qua read-model không mang dữ liệu riêng tư.' },
  }
  const state = copy[view as keyof typeof copy]
  return <section className="global-admin-coming-soon"><span>✦</span><h2>{state.title}</h2><p>{state.detail}</p><small>Được tách sẵn trong information architecture để rollout mà không thay đổi boundary quyền.</small></section>
}

function UserDetail({ user, onOperation }: { user: GlobalAdminUser | null; onOperation: (action: GlobalAdminAction) => void }) {
  if (!user) return <aside className="global-admin-panel global-admin-user-detail is-empty"><span>♙</span><h2>Chọn một người dùng</h2><p>Chi tiết chỉ bao gồm metadata và aggregate count.</p></aside>
  return <aside className="global-admin-panel global-admin-user-detail"><div className="global-admin-user-detail__title"><h2>Chi tiết người dùng</h2><StatusPill status={user.accountStatus} /></div><div className="global-admin-profile"><i>{initials(user.email)}</i><div><strong>{user.email.split('@')[0]}</strong><small>{user.email}</small><code>{user.userId}</code></div></div><dl><div><dt>Ngày tạo</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt>Hoạt động cuối</dt><dd>{formatDate(user.lastActiveAt)}</dd></div><div><dt>Data version</dt><dd>{user.dataVersion}</dd></div></dl><div className="global-admin-user-stats"><span><b>{user.checkinCount}</b>Check-in</span><span><b>{user.diaryCount}</b>Diary entries</span><span><b>{user.customCount}</b>Custom items</span><span><b>{user.overrideCount}</b>Overrides</span></div><div className="global-admin-user-privacy"><b>▣ Không thể chỉnh sửa nội dung cá nhân</b><p>Do boundary quyền riêng tư, Global Admin không mở text Check-in, Diary hoặc ghi chú của user.</p></div><h3>Hành động cho người dùng này</h3><div className="global-admin-detail-actions"><button type="button" onClick={() => onOperation('repair_references')}>⟳ Repair references</button><button type="button" onClick={() => onOperation('migrate_occurred_at')}>▷ Run migration</button><button type="button" onClick={() => onOperation('export_account_package')}>⇩ Export account package</button><button type="button" className="is-danger" onClick={() => onOperation('full_factory_reset')}>⌫ Full factory reset</button></div></aside>
}

function CanonicalEditor({ definition, row, saving, onSave }: { definition: ReturnType<typeof getAdminEntity>; row: AdminReferenceRow | null; saving: boolean; onSave: (patch: AdminReferenceRow) => Promise<void> }) {
  const [draft, setDraft] = useState<AdminReferenceRow>(() => row ?? {})
  if (!row) return <aside className="global-admin-panel global-admin-editor global-admin-editor--empty"><span>◫</span><h2>Chọn một canonical item</h2><p>Editor chỉ sửa định nghĩa chuẩn; record lịch sử sử dụng snapshot riêng.</p></aside>
  const update = (field: AdminField, value: unknown) => setDraft((current) => ({ ...current, [field.key]: value }))
  return <aside className="global-admin-panel global-admin-editor"><div className="global-admin-editor__head"><div><p>{definition.label}</p><h2>{String(row[definition.displayField])}</h2><code>{String(row[definition.idField])}</code></div><StatusPill status={row[definition.activeField] === false ? 'inactive' : 'active'} /></div><div className="global-admin-editor__fields">{definition.fields.map((field) => <CanonicalField key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field, value)} />)}</div><div className="global-admin-editor__metrics"><span><b>Inherited</b>Canonical default</span><span><b>Protected</b>History snapshots</span><span><b>v2.1</b>Current version</span></div><div className="global-admin-editor__actions"><button type="button" onClick={() => setDraft(row)}>Huỷ</button><button type="button" className="is-primary" disabled={saving} onClick={() => void onSave(draft)}>{saving ? 'Đang lưu…' : 'Lưu canonical'}</button></div></aside>
}

function CanonicalField({ field, value, onChange }: { field: AdminField; value: unknown; onChange: (value: unknown) => void }) {
  const stringValue = typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value)
  if (field.type === 'boolean') return <label className="global-admin-switch-field"><span>{field.label}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /></label>
  if (field.type === 'textarea') return <label className="global-admin-form-field"><span>{field.label}{field.required && <b>*</b>}</span><textarea rows={4} value={stringValue} onChange={(event) => onChange(event.target.value)} /></label>
  return <label className="global-admin-form-field"><span>{field.label}{field.required && <b>*</b>}</span><input type={field.type === 'color' ? 'color' : field.type === 'number' ? 'number' : 'text'} value={field.type === 'color' && !/^#[\dA-Fa-f]{6}$/.test(stringValue) ? '#743cff' : stringValue} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} /></label>
}

function OperationDialog({ action, initialScope, canRunAllUsers, onClose, onCompleted }: { action: GlobalAdminAction; initialScope: GlobalAdminScope; canRunAllUsers: boolean; onClose: () => void; onCompleted: (message: string) => void }) {
  const [scopeMode, setScopeMode] = useState<GlobalAdminScope['mode']>(initialScope.userIds.length ? 'selected' : canRunAllUsers ? 'all' : 'selected')
  const [impact, setImpact] = useState<GlobalAdminImpact | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const scope: GlobalAdminScope = { mode: scopeMode, userIds: initialScope.userIds }
  const changeScopeMode = (nextScopeMode: GlobalAdminScope['mode']) => {
    setScopeMode(nextScopeMode)
    setImpact(null)
    setConfirmation('')
    setError(null)
    setLoading(true)
  }

  useEffect(() => {
    let active = true
    void previewGlobalAdminOperation(action, { mode: scopeMode, userIds: initialScope.userIds }).then((nextImpact) => {
      if (active) setImpact(nextImpact)
    }).catch((reason) => {
      if (active) setError(adminErrorMessage(reason))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [action, scopeMode, initialScope.userIds])

  const expected = impact ? action === 'full_factory_reset' ? `RESET ${impact.affectedUsers}` : action === 'export_account_package' ? `QUEUE ${impact.affectedUsers}` : `APPLY ${impact.affectedUsers}` : ''
  const canExecute = action === 'export_account_package' ? Boolean(impact) : Boolean(impact && confirmation === expected)
  const execute = async () => {
    if (!canExecute) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await executeGlobalAdminOperation(action, scope, confirmation)
      onCompleted(`${actionLabels[action]}: ${result.status}. Operation ${result.operationId.slice(0, 8)} đã được ghi nhận.`)
    } catch (reason) {
      setError(adminErrorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="global-admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="global-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="operation-dialog-title"><button className="global-admin-dialog__close" type="button" onClick={onClose} aria-label="Đóng">×</button><p className="global-admin-kicker">Typed admin operation</p><h2 id="operation-dialog-title">{actionLabels[action]}</h2><p>{actionCopy[action]}</p><fieldset><legend>Phạm vi áp dụng</legend><label><input type="radio" name="scope" checked={scopeMode === 'selected'} disabled={!initialScope.userIds.length} onChange={() => changeScopeMode('selected')} /> {initialScope.userIds.length} người dùng đã chọn</label><label><input type="radio" name="scope" checked={scopeMode === 'all'} disabled={!canRunAllUsers} onChange={() => changeScopeMode('all')} /> Tất cả người dùng {canRunAllUsers ? '' : '(Super Admin only)'}</label></fieldset>{loading && <p className="global-admin-empty">Đang tính Impact Preview…</p>}{impact && <ImpactPreview impact={impact} />}{error && <p className="global-admin-error" role="alert">{error}</p>}{action !== 'export_account_package' && impact && <label className="global-admin-confirmation"><span>Nhập <code>{expected}</code> để xác nhận</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={expected} autoComplete="off" /></label>}<div className="global-admin-dialog__actions"><button type="button" onClick={onClose}>Huỷ</button><button type="button" className={action === 'full_factory_reset' ? 'is-danger' : 'is-primary'} disabled={!canExecute || submitting} onClick={() => void execute()}>{submitting ? 'Đang thực hiện…' : action === 'export_account_package' ? 'Đưa vào hàng đợi' : 'Execute operation'}</button></div></section></div>
}

function ImpactPreview({ impact }: { impact: GlobalAdminImpact }) {
  return <section className="global-admin-impact-preview"><h3>Ước lượng tác động</h3><div><span><b>{impact.affectedUsers}</b>Users</span><span><b>{impact.checkins}</b>Check-ins</span><span><b>{impact.diaryEntries}</b>Diary entries</span><span><b>{impact.reminders}</b>Actions</span></div><p>{impact.historicalSnapshotsPreserved ? '✓ Historical snapshot được bảo lưu khi thao tác repair/migrate.' : '⚠ Thao tác này không thể rollback.'}</p></section>
}

function ActionCard({ action, enabled, onClick, danger = false }: { action: GlobalAdminAction; enabled: boolean; onClick: (action: GlobalAdminAction) => void; danger?: boolean }) {
  return <article className={`global-admin-action-card ${danger ? 'is-danger' : ''}`}><span>{action === 'repair_references' ? '⟳' : action === 'migrate_occurred_at' ? '▷' : action === 'export_account_package' ? '⇩' : '⌫'}</span><h2>{actionLabels[action]}</h2><p>{actionCopy[action]}</p><button type="button" disabled={!enabled} onClick={() => onClick(action)}>{enabled ? 'Preview impact →' : 'Chọn scope trước'}</button></article>
}

function ScopeSnapshot({ label, copy }: { label: string; copy: string }) {
  return <article className="global-admin-panel global-admin-scope-snapshot"><h3>{label}</h3><p>{copy}</p><div><span>♙ 1 người dùng</span><span>⌘ Nhóm người dùng</span><span>◎ Tất cả người dùng</span></div></article>
}

function HealthList() {
  return <ul className="global-admin-health-list">{['API & Core Services', 'Database', 'Storage', 'Processing / Worker', 'Scheduler', 'External integrations'].map((name) => <li key={name}><i /><span><strong>{name}</strong><small>Connected · monitored</small></span><b>Hoạt động</b></li>)}</ul>
}

function RecentOperations({ operations }: { operations: GlobalAdminOverview['recentOperations'] }) {
  if (!operations.length) return <p className="global-admin-empty">Chưa có Global Admin operation nào được ghi nhận.</p>
  return <ul className="global-admin-recent-operations">{operations.map((operation) => <li key={operation.id}><span className={operation.status}>{operation.status === 'completed' ? '✓' : operation.status === 'queued' ? '◷' : '•'}</span><div><strong>{actionLabels[operation.actionType]}</strong><small>{operation.impact.affectedUsers} users · {formatDate(operation.createdAt)}</small></div></li>)}</ul>
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: string }) {
  return <article className={`global-admin-metric is-${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function StatusPill({ status }: { status: 'active' | 'inactive' }) {
  return <span className={`global-admin-status is-${status}`}>{status === 'active' ? 'Active' : 'Inactive'}</span>
}

function PanelHeading({ title, action }: { title: string; action?: string }) {
  return <div className="global-admin-panel-heading"><h2>{title}</h2>{action && <button type="button">{action} →</button>}</div>
}

function AdminState({ title, copy, action, onAction, error = false }: { title: string; copy: string; action?: string; onAction?: () => void; error?: boolean }) {
  return <main className="global-admin-state"><span className={error ? 'is-error' : ''}>{error ? '!' : '✦'}</span><h1>{title}</h1><p>{copy}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</main>
}

function pageTitle(view: AdminView): string {
  return ({ overview: 'Global Admin Studio', users: 'User Management', canonical: 'Canonical Data Studio', scopes: 'Scopes', overrides: 'Overrides', recovery: 'Reset & Repair', runtime: 'Runtime', health: 'System Health' })[view]
}

function pageDescription(view: AdminView): string {
  return ({ overview: 'Quản trị dữ liệu chuẩn, user metadata, scope, recovery và runtime qua control plane riêng.', users: 'Tìm kiếm user, xem account metadata, chọn scope và chạy typed reset / repair / migrate action.', canonical: 'Quản lý catalog chuẩn toàn hệ thống; canonical thay đổi không ghi đè personal override.', scopes: 'Resolve selection thành phạm vi có thể preview trước khi execute.', overrides: 'Theo dõi adoption, collision và candidate force-write theo scope.', recovery: 'Reset, repair và migration luôn cần Impact Preview + confirmation.', runtime: 'Runtime config được version, validate và rollout có chủ đích.', health: 'Theo dõi service health mà không truy cập nội dung riêng tư.' })[view]
}

function catalogIcon(key: AdminEntityKey): string {
  const icons: Partial<Record<AdminEntityKey, string>> = { emotion_families: '☺', emotions: '♥', need_groups: '◌', needs: '◉', contexts: '⌁', unknown_prompts: '?', care_actions: '✦', diary_prompts: '▤', action_reflection_outcomes: '↗', gift_box_styles: '▣' }
  return icons[key] ?? '◫'
}
