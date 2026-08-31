import type { CSSProperties } from 'react'
import type { GiftBoxStyle } from '../types'

type GiftBoxArtProps = { style: GiftBoxStyle; opened?: boolean; className?: string }

export function GiftBoxArt({ style, opened = false, className = '' }: GiftBoxArtProps) {
  const [base, accent] = style.palette
  return <div className={`gift-box-art gift-box-art--${style.shape} ${opened ? 'is-opened' : ''} ${className}`.trim()} style={{ '--gift-base': base, '--gift-accent': accent, '--gift-ribbon': style.ribbon } as CSSProperties} aria-hidden="true">
    <div className="gift-box-art__lid"><span>{String(style.config.seal ?? '✦')}</span></div>
    <div className="gift-box-art__body"><i /><b /></div>
    <div className="gift-box-art__sparkles"><span>✦</span><span>·</span><span>✧</span></div>
  </div>
}
