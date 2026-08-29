import { ColorOrb } from '../../checkin/components/CheckinComponents'

export function HomeOrb({ entries, size = 'large', label }: { entries: readonly { color: string; intensity: number }[]; size?: 'small' | 'medium' | 'large'; label: string }) {
  return <ColorOrb entries={entries.length ? entries : [{ color: '#e6def6', intensity: 1 }]} size={size} label={label} />
}
