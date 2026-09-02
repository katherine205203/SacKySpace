import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase/client'
import { UI_CONTENT_DEFAULTS, type UiContentDefinition, uiContentDefaultText } from './uiContentRegistry'

export type UiContentRecord = UiContentDefinition & {
  id?: string
  contentKey: string
  textVn: string
  textEn: string | null
  active: boolean
  updatedAt: string | null
  updatedBy: string | null
}

const listeners = new Set<() => void>()
let snapshot = new Map<string, UiContentRecord>()
let loadPromise: Promise<void> | null = null

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = () => listeners.forEach((listener) => listener())

const mapRecord = (row: Record<string, unknown>): UiContentRecord => {
  const contentKey = String(row.content_key)
  const fallback = UI_CONTENT_DEFAULTS[contentKey]
  return {
    ...(fallback ?? { module: String(row.module ?? ''), screen: String(row.screen ?? ''), element: String(row.element ?? ''), elementType: row.element_type as UiContentDefinition['elementType'], defaultTextVn: String(row.default_text_vn ?? ''), defaultTextEn: row.default_text_en as string | null, maxLength: row.max_length === null ? null : Number(row.max_length), maxLengthMode: row.max_length_mode as UiContentDefinition['maxLengthMode'] }),
    id: row.id as string | undefined,
    contentKey,
    textVn: String(row.text_vn ?? ''),
    textEn: row.text_en as string | null,
    active: Boolean(row.active),
    updatedAt: row.updated_at as string | null,
    updatedBy: row.updated_by as string | null,
  }
}

export const preloadUiContent = async (): Promise<void> => {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      const { data, error } = await supabase.from('ui_content_registry').select('*').eq('active', true)
      if (error) throw error
      snapshot = new Map(((data ?? []) as Record<string, unknown>[]).map((row) => {
        const record = mapRecord(row)
        return [record.contentKey, record] as const
      }))
      notify()
    } catch {
      // Defaults are intentionally kept as the synchronous and durable fallback.
    }
  })()
  return loadPromise
}

export const clearUiContentCache = () => {
  snapshot = new Map()
  loadPromise = null
  notify()
}

export const replaceUiContentSnapshot = (records: UiContentRecord[]) => {
  snapshot = new Map(records.filter((record) => record.active).map((record) => [record.contentKey, record]))
  notify()
}

export const updateUiContentSnapshot = (record: UiContentRecord) => {
  const next = new Map(snapshot)
  if (record.active) next.set(record.contentKey, record)
  else next.delete(record.contentKey)
  snapshot = next
  notify()
}

export const uiContent = (contentKey: string, fallback?: string): string => {
  const record = snapshot.get(contentKey)
  return record?.textVn.trim() || uiContentDefaultText(contentKey, fallback)
}

export const formatUiContent = (contentKey: string, variables: Record<string, string | number>, fallback?: string): string =>
  uiContent(contentKey, fallback).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => name in variables ? String(variables[name]) : match)

export const useUiContent = (contentKey: string, fallback?: string): string => {
  const currentSnapshot = useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
  useEffect(() => { void preloadUiContent() }, [])
  return currentSnapshot.get(contentKey)?.textVn.trim() || uiContentDefaultText(contentKey, fallback)
}
