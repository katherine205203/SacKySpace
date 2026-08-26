import type { ReactNode } from 'react'
import { PlaceholderHeader } from '../components/PlaceholderHeader'
import { PlaceholderSidebar } from '../components/PlaceholderSidebar'
import type { NavigationItem } from '../types/navigation'

type AppShellProps = {
  children: ReactNode
}

const navigationItems: readonly NavigationItem[] = [
  { label: 'Home', href: '#home' },
]

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <PlaceholderSidebar items={navigationItems} />
      <div className="app-main">
        <PlaceholderHeader />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
