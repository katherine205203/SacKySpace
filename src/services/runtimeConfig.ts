import { supabase } from './supabase/client'

const cache = new Map<string, unknown>()
const pending = new Map<string, Promise<unknown>>()

export const getPublishedRuntimeValue = async <T>(configKey: string, fallback: T): Promise<T> => {
  if (cache.has(configKey)) return cache.get(configKey) as T
  const existingRequest = pending.get(configKey)
  if (existingRequest) return existingRequest as Promise<T>

  const request = (async () => {
    try {
      const { data, error } = await supabase.from('admin_runtime_configs').select('published_value').eq('config_key', configKey).maybeSingle()
      if (error || data?.published_value === undefined || data?.published_value === null) return fallback
      cache.set(configKey, data.published_value)
      return data.published_value as T
    } catch {
      return fallback
    } finally {
      pending.delete(configKey)
    }
  })()
  pending.set(configKey, request)
  return request as Promise<T>
}

export const clearRuntimeConfigCache = (): void => {
  cache.clear()
  pending.clear()
}
