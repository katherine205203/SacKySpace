import type { ReactNode } from 'react'

type ScaffoldProps = { children: ReactNode; className?: string }

export function SafeAreaContainer({ children, className = '' }: ScaffoldProps) {
  return <div className={`mobile-safe-area ${className}`.trim()}>{children}</div>
}

export function ScreenScaffold({ children, className = '' }: ScaffoldProps) {
  return <section className={`mobile-screen-scaffold ${className}`.trim()}>{children}</section>
}

export function FullScreenFlowScaffold({ children, className = '' }: ScaffoldProps) {
  return <section className={`mobile-fullscreen-flow ${className}`.trim()}>{children}</section>
}

export function StickyBottomAction({ children, className = '' }: ScaffoldProps) {
  return <footer className={`mobile-sticky-action ${className}`.trim()}>{children}</footer>
}

type SheetProps = ScaffoldProps & { labelledBy?: string; onClose?: () => void }

export function BottomSheet({ children, className = '', labelledBy, onClose }: SheetProps) {
  return <div className="mobile-sheet-backdrop"><section className={`mobile-bottom-sheet ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{onClose && <button className="mobile-sheet__close" type="button" onClick={onClose} aria-label="Đóng">×</button>}{children}</section></div>
}

export function FullScreenSheet({ children, className = '', labelledBy, onClose }: SheetProps) {
  return <div className="mobile-fullscreen-sheet-backdrop"><section className={`mobile-fullscreen-sheet ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{onClose && <button className="mobile-sheet__close" type="button" onClick={onClose} aria-label="Đóng">×</button>}{children}</section></div>
}
