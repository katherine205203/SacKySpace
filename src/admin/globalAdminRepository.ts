import { supabase } from '../services/supabase/client'
import { getAdminEntity } from '../features/admin/registry'
import { clearReferenceCache } from '../features/checkin/services/referenceRepository'
import { getReferenceUsageCount, writeAudit } from '../features/admin/services/adminRepository'
import type { AdminEntityKey, AdminReferenceRow } from '../features/admin/types'

export type GlobalAdminIdentity = {
  userId: string
  email: string
  role: 'platform_admin' | 'super_admin'
}

export type GlobalAdminOverview = {
  totalUsers: number
  activeToday: number
  canonicalItems: number
  pendingOperations: number
  recentOperations: GlobalAdminOperation[]
}

export type GlobalAdminOperation = {
  id: string
  actionType: GlobalAdminAction
  status: 'previewed' | 'queued' | 'completed' | 'failed'
  scope: GlobalAdminScope
  impact: GlobalAdminImpact
  createdAt: string
  completedAt: string | null
}

export type GlobalAdminUser = {
  userId: string
  email: string
  createdAt: string
  lastActiveAt: string | null
  accountStatus: 'active' | 'inactive'
  dataVersion: string
  checkinCount: number
  diaryCount: number
  customCount: number
  overrideCount: number
}

export type GlobalAdminScope = {
  mode: 'selected' | 'all'
  userIds: string[]
}

export type GlobalAdminAction =
  | 'repair_references'
  | 'migrate_occurred_at'
  | 'export_account_package'
  | 'full_factory_reset'

export type GlobalAdminImpact = {
  affectedUsers: number
  checkins: number
  diaryEntries: number
  reminders: number
  historicalSnapshotsPreserved: boolean
  rollbackAvailable: boolean
  requiresStrongConfirmation: boolean
}

const safeMessage = (reason: unknown): string => {
  const message = reason instanceof Error ? reason.message : typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string' ? reason.message : ''
  return message || 'Không thể hoàn tất thao tác Global Admin.'
}

const callRpc = async <T>(name: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(safeMessage(error))
  return data as T
}

const toNumber = (value: unknown) => Number(value ?? 0)

const parseImpact = (value: Record<string, unknown>): GlobalAdminImpact => ({
  affectedUsers: toNumber(value.affected_users),
  checkins: toNumber(value.checkins),
  diaryEntries: toNumber(value.diary_entries),
  reminders: toNumber(value.reminders),
  historicalSnapshotsPreserved: Boolean(value.historical_snapshots_preserved),
  rollbackAvailable: Boolean(value.rollback_available),
  requiresStrongConfirmation: Boolean(value.requires_strong_confirmation),
})

const parseScope = (value: unknown): GlobalAdminScope => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    mode: candidate.mode === 'all' ? 'all' : 'selected',
    userIds: Array.isArray(candidate.user_ids) ? candidate.user_ids.map(String) : Array.isArray(candidate.userIds) ? candidate.userIds.map(String) : [],
  }
}

const parseOperation = (row: Record<string, unknown>): GlobalAdminOperation => ({
  id: String(row.id),
  actionType: row.action_type as GlobalAdminAction,
  status: row.status as GlobalAdminOperation['status'],
  scope: parseScope(row.scope),
  impact: parseImpact((row.impact ?? {}) as Record<string, unknown>),
  createdAt: String(row.created_at),
  completedAt: row.completed_at ? String(row.completed_at) : null,
})

export const getGlobalAdminIdentity = async (): Promise<GlobalAdminIdentity> => {
  const data = await callRpc<Record<string, unknown>>('global_admin_identity')
  return {
    userId: String(data.user_id),
    email: String(data.email),
    role: data.role === 'super_admin' ? 'super_admin' : 'platform_admin',
  }
}

export const getGlobalAdminOverview = async (): Promise<GlobalAdminOverview> => {
  const data = await callRpc<Record<string, unknown>>('global_admin_overview')
  return {
    totalUsers: toNumber(data.total_users),
    activeToday: toNumber(data.active_today),
    canonicalItems: toNumber(data.canonical_items),
    pendingOperations: toNumber(data.pending_operations),
    recentOperations: Array.isArray(data.recent_operations) ? data.recent_operations.map((row) => parseOperation(row as Record<string, unknown>)) : [],
  }
}

export const listGlobalAdminUsers = async (search: string, status: 'all' | 'active' | 'inactive'): Promise<GlobalAdminUser[]> => {
  const data = await callRpc<Record<string, unknown>[]>('global_admin_list_users', {
    p_search: search.trim() || null,
    p_status: status,
    p_limit: 100,
    p_offset: 0,
  })
  return data.map((row) => ({
    userId: String(row.user_id),
    email: String(row.email),
    createdAt: String(row.created_at),
    lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
    accountStatus: row.account_status === 'active' ? 'active' : 'inactive',
    dataVersion: String(row.data_version ?? 'v2.1'),
    checkinCount: toNumber(row.checkin_count),
    diaryCount: toNumber(row.diary_count),
    customCount: toNumber(row.custom_count),
    overrideCount: toNumber(row.override_count),
  }))
}

export const previewGlobalAdminOperation = async (action: GlobalAdminAction, scope: GlobalAdminScope): Promise<GlobalAdminImpact> => {
  const data = await callRpc<Record<string, unknown>>('global_admin_preview_operation', {
    p_action_type: action,
    p_scope: { mode: scope.mode, user_ids: scope.userIds },
  })
  return parseImpact(data)
}

export const executeGlobalAdminOperation = async (action: GlobalAdminAction, scope: GlobalAdminScope, confirmation: string): Promise<{ operationId: string; status: string; impact: GlobalAdminImpact; result: Record<string, unknown> }> => {
  const data = await callRpc<Record<string, unknown>>('global_admin_execute_operation', {
    p_action_type: action,
    p_scope: { mode: scope.mode, user_ids: scope.userIds },
    p_confirmation: confirmation,
  })
  return {
    operationId: String(data.operation_id),
    status: String(data.status),
    impact: parseImpact((data.impact ?? {}) as Record<string, unknown>),
    result: (data.result ?? {}) as Record<string, unknown>,
  }
}

export const listCanonicalRows = async (entityKey: AdminEntityKey): Promise<AdminReferenceRow[]> => {
  const definition = getAdminEntity(entityKey)
  const { data, error } = await supabase.from(definition.table).select('*').order(definition.sortField, { ascending: true })
  if (error) throw new Error(safeMessage(error))
  return (data ?? []) as AdminReferenceRow[]
}

const normalizeCanonicalPayload = (entityKey: AdminEntityKey, row: AdminReferenceRow, includeId = false): AdminReferenceRow => {
  const definition = getAdminEntity(entityKey)
  const allowed = new Set(definition.fields.map((field) => field.key))
  const payload = Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key) || (includeId && key === definition.idField)))
  for (const key of ['palette', 'config']) {
    if (typeof payload[key] !== 'string') continue
    try {
      payload[key] = JSON.parse(payload[key] as string)
    } catch {
      throw new Error(`${key} phải là JSON hợp lệ.`)
    }
  }
  return payload
}

const validateCanonicalRow = (entityKey: AdminEntityKey, row: AdminReferenceRow): string => {
  const definition = getAdminEntity(entityKey)
  const id = String(row[definition.idField] ?? '').trim()
  if (!id) throw new Error(`Thiếu khóa ${definition.idField}.`)
  for (const field of definition.fields) {
    if (!field.required) continue
    const value = row[field.key]
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
      throw new Error(`Trường ${field.label} không được để trống.`)
    }
  }
  return id
}

export const saveCanonicalRow = async (entityKey: AdminEntityKey, id: string, patch: AdminReferenceRow): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  const before = await getCanonicalRow(entityKey, id)
  const payload = normalizeCanonicalPayload(entityKey, patch)
  const { error } = await supabase.from(definition.table).update(payload).eq(definition.idField, id)
  if (error) throw new Error(safeMessage(error))
  clearReferenceCache()
  await writeAudit('data', 'update', definition.table, id, before, { ...before, ...payload }, null)
}

export const createCanonicalRow = async (entityKey: AdminEntityKey, row: AdminReferenceRow): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  const id = validateCanonicalRow(entityKey, row)
  const payload = normalizeCanonicalPayload(entityKey, { ...row, [definition.idField]: id }, true)
  const { error } = await supabase.from(definition.table).insert(payload)
  if (error) throw new Error(safeMessage(error))
  clearReferenceCache()
  await writeAudit('data', 'create', definition.table, id, null, payload, null)
}

export const deactivateCanonicalRow = async (entityKey: AdminEntityKey, id: string): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  await saveCanonicalRow(entityKey, id, { [definition.activeField]: false })
}

export const deleteCanonicalRow = async (entityKey: AdminEntityKey, id: string): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  const usageCount = await getReferenceUsageCount(entityKey, id)
  if (usageCount > 0) throw new Error(`Không thể xoá: canonical này đang được ${usageCount} record tham chiếu. Hãy Deactivate để giữ lịch sử.`)
  const before = await getCanonicalRow(entityKey, id)
  const { error } = await supabase.from(definition.table).delete().eq(definition.idField, id)
  if (error) throw new Error(safeMessage(error))
  clearReferenceCache()
  await writeAudit('data', 'delete', definition.table, id, before, null, null)
}

export const getCanonicalRow = async (entityKey: AdminEntityKey, id: string): Promise<AdminReferenceRow | null> => {
  const definition = getAdminEntity(entityKey)
  const { data, error } = await supabase.from(definition.table).select('*').eq(definition.idField, id).maybeSingle()
  if (error) throw new Error(safeMessage(error))
  return (data as AdminReferenceRow | null) ?? null
}

export const adminErrorMessage = safeMessage
