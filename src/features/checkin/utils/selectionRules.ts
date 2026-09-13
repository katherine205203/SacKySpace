export const MAX_SECONDARY_EMOTIONS = 3
export const MAX_NEEDS = 3
export const MAX_CONTEXTS = 2
export const MAX_ACTIONS = 2

export const toggleSelection = (
  selectedIds: readonly string[],
  id: string,
  max: number,
): string[] => {
  if (selectedIds.includes(id)) return selectedIds.filter((selectedId) => selectedId !== id)
  if (selectedIds.length >= max) return [...selectedIds]
  return [...selectedIds, id]
}

export const canSelect = (
  selectedIds: readonly string[],
  id: string,
  max: number,
): boolean => selectedIds.includes(id) || selectedIds.length < max

export const isAtSelectionLimit = (selectedIds: readonly string[], max: number): boolean =>
  selectedIds.length >= max
