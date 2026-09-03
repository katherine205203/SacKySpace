import { getLinkedCheckin } from './actionAggregation'
import type { ActionRecord } from './types'
import type { CheckinRecord } from '../checkin/types'

export const ACTION_INDEPENDENT_COLOR = '#743CFF'
export const UNKNOWN_ACTION_COLOR = '#b8a5df'

export const getActionAccentColor = (action: ActionRecord, checkins: readonly CheckinRecord[]): string => {
  const checkin = getLinkedCheckin(action, checkins)
  return checkin?.primaryEmotion?.color_hex ?? (checkin ? UNKNOWN_ACTION_COLOR : ACTION_INDEPENDENT_COLOR)
}
