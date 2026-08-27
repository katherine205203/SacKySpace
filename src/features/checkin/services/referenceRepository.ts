import { supabase } from '../../../services/supabase/client'
import type { ReferenceData } from '../types'

let referenceDataPromise: Promise<ReferenceData> | null = null

const loadTable = async <T>(table: string): Promise<T[]> => {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as T[]
}

const loadReferenceData = async (): Promise<ReferenceData> => {
  const [emotionFamilies, emotions, needGroups, needs, contexts, unknownPrompts, careActions] =
    await Promise.all([
      loadTable<ReferenceData['emotionFamilies'][number]>('emotion_families'),
      loadTable<ReferenceData['emotions'][number]>('emotions'),
      loadTable<ReferenceData['needGroups'][number]>('need_groups'),
      loadTable<ReferenceData['needs'][number]>('needs'),
      loadTable<ReferenceData['contexts'][number]>('contexts'),
      loadTable<ReferenceData['unknownPrompts'][number]>('unknown_prompts'),
      loadTable<ReferenceData['careActions'][number]>('care_actions'),
    ])

  return { emotionFamilies, emotions, needGroups, needs, contexts, unknownPrompts, careActions }
}

export const getReferenceData = (): Promise<ReferenceData> => {
  referenceDataPromise ??= loadReferenceData()
  return referenceDataPromise
}

export const clearReferenceCache = (): void => {
  referenceDataPromise = null
}
