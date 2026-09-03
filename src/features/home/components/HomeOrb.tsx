import { ColorOrb } from '../../checkin/components/CheckinComponents'
import type { ColorOrbEntry } from '../../checkin/utils/colorOrb'

export function HomeOrb({ entries, size = 'large', label }: { entries: readonly ColorOrbEntry[]; size?: 'small' | 'medium' | 'large'; label: string }) {
  return <ColorOrb entries={entries} size={size} label={label} />
}
