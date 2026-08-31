import { supabase } from '../../../services/supabase/client'
import { clearReferenceCache } from '../../checkin/services/referenceRepository'
import { clearRuntimeConfigCache } from '../../../services/runtimeConfig'
import { getAdminEntity } from '../registry'
import type { AdminAsset, AdminAuditLog, AdminConfigVersion, AdminEntityKey, AdminModuleCount, AdminReferenceRow, AdminRuntimeConfig } from '../types'

const safeMessage = (reason: unknown): string => {
  const message = reason instanceof Error ? reason.message : typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string' ? reason.message : ''
  if (!message || /relation|column|schema|PGRST|postgres|function|permission|violates|foreign key/i.test(message)) return 'Admin Studio chưa kết nối được với cấu hình dữ liệu. Hãy chạy migration mới nhất và thử lại.'
  return message
}

const currentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Bạn cần đăng nhập để mở Admin Studio.')
  return data.user.id
}

const mapConfig = (row: Record<string, unknown>): AdminRuntimeConfig => ({
  configKey: String(row.config_key), module: String(row.module), valueType: row.value_type as AdminRuntimeConfig['valueType'], scope: String(row.scope),
  defaultValue: row.default_value, publishedValue: row.published_value, draftValue: row.draft_value, configurabilityLevel: row.configurability_level as AdminRuntimeConfig['configurabilityLevel'],
  validationSchema: (row.validation_schema ?? {}) as Record<string, unknown>, dependencyTags: (row.dependency_tags ?? []) as string[], publishedVersion: Number(row.published_version ?? 0), effectiveFrom: row.effective_from as string | null, updatedAt: String(row.updated_at),
})

const mapAsset = (row: Record<string, unknown>): AdminAsset => ({
  assetId: String(row.asset_id), assetType: String(row.asset_type), name: String(row.name), previewUrl: row.preview_url as string | null, active: Boolean(row.active), sortOrder: Number(row.sort_order ?? 0), provider: String(row.provider ?? 'external'), currentVersion: Number(row.current_version ?? 1), metadata: (row.metadata ?? {}) as Record<string, unknown>, updatedAt: String(row.updated_at),
})

const mapAudit = (row: Record<string, unknown>): AdminAuditLog => ({
  id: String(row.id), createdAt: String(row.created_at), domain: String(row.domain), action: String(row.action), entityType: row.entity_type as string | null, targetId: row.target_id as string | null, before: row.before_json, after: row.after_json, version: row.version === null ? null : Number(row.version),
})

export const adminUserError = (reason: unknown, fallback: string): string => {
  const message = reason instanceof Error ? reason.message : typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string' ? reason.message : ''
  if (!message || /relation|column|schema|PGRST|postgres|function|permission|violates|foreign key/i.test(message)) return fallback
  return message
}

export const claimAdminOwner = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('claim_admin_owner')
  if (error) throw new Error(safeMessage(error))
  if (data !== true) throw new Error('Tài khoản này không có quyền owner của Admin Studio.')
  return true
}

export const getAdminSettings = async (): Promise<{ advancedMode: boolean }> => {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('admin_settings').select('advanced_mode').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(safeMessage(error))
  return { advancedMode: Boolean((data as { advanced_mode?: boolean } | null)?.advanced_mode) }
}

export const saveAdminSettings = async (advancedMode: boolean): Promise<void> => {
  const userId = await currentUserId()
  const { error } = await supabase.from('admin_settings').upsert({ user_id: userId, advanced_mode: advancedMode }, { onConflict: 'user_id' })
  if (error) throw new Error(safeMessage(error))
}

export const listAdminConfigs = async (): Promise<AdminRuntimeConfig[]> => {
  const { data, error } = await supabase.from('admin_runtime_configs').select('*').order('module').order('config_key')
  if (error) throw new Error(safeMessage(error))
  return ((data ?? []) as Record<string, unknown>[]).map(mapConfig)
}

export const saveConfigDraft = async (configKey: string, draftValue: unknown): Promise<void> => {
  const { data: before, error: beforeError } = await supabase.from('admin_runtime_configs').select('*').eq('config_key', configKey).single()
  if (beforeError) throw new Error(safeMessage(beforeError))
  const { error } = await supabase.from('admin_runtime_configs').update({ draft_value: draftValue }).eq('config_key', configKey)
  if (error) throw new Error(safeMessage(error))
  await writeAudit('rules', 'save_draft', 'admin_runtime_configs', configKey, before, { ...before, draft_value: draftValue }, null)
}

export const publishConfig = async (configKey: string, changeNote: string): Promise<void> => {
  const { error } = await supabase.rpc('admin_publish_runtime_config', { p_config_key: configKey, p_change_note: changeNote.trim() || null })
  if (error) throw new Error(safeMessage(error))
  clearRuntimeConfigCache()
}

export const listConfigVersions = async (configKey: string): Promise<AdminConfigVersion[]> => {
  const { data, error } = await supabase.from('admin_runtime_config_versions').select('id, config_key, version, value, status, change_note, created_at').eq('config_key', configKey).order('version', { ascending: false })
  if (error) throw new Error(safeMessage(error))
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({ id: String(row.id), configKey: String(row.config_key), version: Number(row.version), value: row.value, status: String(row.status), changeNote: row.change_note as string | null, createdAt: String(row.created_at) }))
}

export const rollbackConfig = async (configKey: string, version: number): Promise<void> => {
  const { error } = await supabase.rpc('admin_rollback_runtime_config', { p_config_key: configKey, p_version: version })
  if (error) throw new Error(safeMessage(error))
}

export const listReferenceRows = async (entityKey: AdminEntityKey): Promise<AdminReferenceRow[]> => {
  const definition = getAdminEntity(entityKey)
  const { data, error } = await supabase.from(definition.table).select('*').order(definition.sortField, { ascending: true })
  if (error) throw new Error(safeMessage(error))
  return (data ?? []) as AdminReferenceRow[]
}

const normalizePatch = (entityKey: AdminEntityKey, patch: AdminReferenceRow): AdminReferenceRow => {
  const definition = getAdminEntity(entityKey)
  const allowed = new Set(definition.fields.map((field) => field.key))
  return Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)))
}

export const updateReferenceRow = async (entityKey: AdminEntityKey, id: string, patch: AdminReferenceRow): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  const before = await getReferenceRow(entityKey, id)
  const { error } = await supabase.from(definition.table).update(normalizePatch(entityKey, patch)).eq(definition.idField, id)
  if (error) throw new Error(safeMessage(error))
  clearReferenceCache()
  await writeAudit('data', 'update', definition.table, id, before, { ...before, ...patch }, null)
}

export const upsertReferenceRow = async (entityKey: AdminEntityKey, row: AdminReferenceRow): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  const id = String(row[definition.idField] ?? '')
  if (!id) throw new Error(`Thiếu khóa ${definition.idField}.`)
  const before = await getReferenceRow(entityKey, id)
  const normalized = normalizePatch(entityKey, row)
  for (const key of ['palette', 'config']) if (typeof normalized[key] === 'string') {
    try { normalized[key] = JSON.parse(normalized[key] as string) } catch { throw new Error(`${key} phải là JSON hợp lệ.`) }
  }
  const payload = { [definition.idField]: id, ...normalized }
  const { error } = await supabase.from(definition.table).upsert(payload, { onConflict: definition.idField })
  if (error) throw new Error(safeMessage(error))
  clearReferenceCache()
  await writeAudit('data', before ? 'import_update' : 'import_create', definition.table, id, before, payload, null)
}

export const getReferenceRow = async (entityKey: AdminEntityKey, id: string): Promise<AdminReferenceRow | null> => {
  const definition = getAdminEntity(entityKey)
  const { data, error } = await supabase.from(definition.table).select('*').eq(definition.idField, id).maybeSingle()
  if (error) throw new Error(safeMessage(error))
  return (data as AdminReferenceRow | null) ?? null
}

const usageQuery = async (table: string, column?: string, value?: string): Promise<number> => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (column && value) query = query.eq(column, value)
  const { count, error } = await query
  if (error) throw new Error(safeMessage(error))
  return count ?? 0
}

export const getReferenceUsageCount = async (entityKey: AdminEntityKey, id: string): Promise<number> => {
  const definition = getAdminEntity(entityKey)
  const counts = await Promise.all(definition.usedBy.map((usage) => {
    const [table, column] = usage.split('.')
    return usageQuery(table, column, id)
  }))
  return counts.reduce((total, count) => total + count, 0)
}

export const deactivateReferenceRow = async (entityKey: AdminEntityKey, id: string): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  await updateReferenceRow(entityKey, id, { [definition.activeField]: false })
}

export const deleteReferenceRow = async (entityKey: AdminEntityKey, id: string): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  const usageCount = await getReferenceUsageCount(entityKey, id)
  if (usageCount > 0) throw new Error('Entity này đã được dùng trong dữ liệu lịch sử; chỉ được deactivate để giữ snapshot.')
  const before = await getReferenceRow(entityKey, id)
  const { error } = await supabase.from(definition.table).delete().eq(definition.idField, id)
  if (error) throw new Error(safeMessage(error))
  clearReferenceCache()
  await writeAudit('data', 'delete', definition.table, id, before, null, null)
}

export const reorderReferenceRows = async (entityKey: AdminEntityKey, orderedIds: string[]): Promise<void> => {
  const definition = getAdminEntity(entityKey)
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase.from(definition.table).update({ [definition.sortField]: index + 1 }).eq(definition.idField, id)
    if (error) throw new Error(safeMessage(error))
  }
  clearReferenceCache()
  await writeAudit('data', 'reorder', definition.table, null, null, { orderedIds }, null)
}

export const writeAudit = async (domain: string, action: string, entityType: string | null, targetId: string | null, before: unknown, after: unknown, version: number | null): Promise<void> => {
  const userId = await currentUserId()
  const { error } = await supabase.from('admin_audit_logs').insert({ user_id: userId, domain, action, entity_type: entityType, target_id: targetId, before_json: before, after_json: after, version })
  if (error) throw new Error(safeMessage(error))
}

export const listAdminAssets = async (): Promise<AdminAsset[]> => {
  const { data, error } = await supabase.from('admin_asset_registry').select('*').order('sort_order').order('asset_id')
  if (error) throw new Error(safeMessage(error))
  return ((data ?? []) as Record<string, unknown>[]).map(mapAsset)
}

export const updateAdminAsset = async (assetId: string, patch: Partial<Pick<AdminAsset, 'active' | 'name' | 'previewUrl' | 'provider' | 'metadata'>>): Promise<void> => {
  const { data: before, error: beforeError } = await supabase.from('admin_asset_registry').select('*').eq('asset_id', assetId).single()
  if (beforeError) throw new Error(safeMessage(beforeError))
  const { error } = await supabase.from('admin_asset_registry').update({ name: patch.name, preview_url: patch.previewUrl, provider: patch.provider, metadata: patch.metadata, active: patch.active }).eq('asset_id', assetId)
  if (error) throw new Error(safeMessage(error))
  await writeAudit('assets', 'update', 'admin_asset_registry', assetId, before, patch, null)
}

const countUserRows = async (userId: string, table: string): Promise<AdminModuleCount> => {
  const labelMap: Record<string, string> = { checkins: 'Check-in', reminders: 'Action Space', diary_entries: 'Diary', future_letters: 'Future Letter', gifts: 'Gift for Tomorrow' }
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId)
  return { key: table, label: labelMap[table] ?? table, count: error ? null : count ?? 0, status: error ? 'unavailable' : 'ok' }
}

export const listAdminModuleCounts = async (): Promise<AdminModuleCount[]> => {
  const userId = await currentUserId()
  return Promise.all(['checkins', 'reminders', 'diary_entries', 'future_letters', 'gifts'].map((table) => countUserRows(userId, table)))
}

export const listAdminAuditLogs = async (): Promise<AdminAuditLog[]> => {
  const { data, error } = await supabase.from('admin_audit_logs').select('id, created_at, domain, action, entity_type, target_id, before_json, after_json, version').order('created_at', { ascending: false }).limit(120)
  if (error) throw new Error(safeMessage(error))
  return ((data ?? []) as Record<string, unknown>[]).map(mapAudit)
}

export const exportUserData = async (): Promise<Record<string, unknown>> => {
  const userId = await currentUserId()
  const tables = ['checkins', 'checkin_secondary_emotions', 'checkin_needs', 'checkin_contexts', 'reminders', 'diary_entries', 'diary_prompt_responses', 'diary_checkin_links', 'diary_images', 'future_letters', 'future_letter_context_attachments', 'future_letter_rule_groups', 'future_letter_rules', 'future_letter_trigger_events', 'gifts', 'gift_question_answers', 'gift_diary_conversion_links']
  const result: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId, schema: 'sacky-portable-export-v1', modules: {} }
  for (const table of tables) {
    const userColumn = ['checkin_secondary_emotions', 'checkin_needs', 'checkin_contexts', 'diary_prompt_responses', 'diary_checkin_links', 'diary_images', 'future_letter_context_attachments', 'future_letter_rule_groups', 'future_letter_rules', 'future_letter_trigger_events', 'gift_question_answers', 'gift_diary_conversion_links'].includes(table) ? null : 'user_id'
    const { data, error } = userColumn ? await supabase.from(table).select('*').eq(userColumn, userId) : await supabase.from(table).select('*')
    if (error) throw new Error(safeMessage(error))
    ;(result.modules as Record<string, unknown>)[table] = data ?? []
  }
  await writeAudit('recovery', 'export', 'user_data', userId, null, { tables }, null)
  return result
}

export const resetAdminModule = async (module: string): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase.rpc('admin_reset_module', { p_module: module })
  if (error) throw new Error(safeMessage(error))
  return (data ?? {}) as Record<string, unknown>
}

export const fullResetUserData = async (): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase.rpc('admin_full_reset', { p_confirmation: 'RESET' })
  if (error) throw new Error(safeMessage(error))
  return (data ?? {}) as Record<string, unknown>
}
