import { ColorOrb } from '../../checkin/components/CheckinComponents'

export function HomeOrb({ entries, size = 'large', label }: { entries: readonly { color: string; intensity: number }[]; size?: 'small' | 'medium' | 'large'; label: string }) {
  return <ColorOrb entries={entries} size={size} label={label} />
}
