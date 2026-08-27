import type { ReactNode } from 'react'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'

type AppShellProps = { children: ReactNode }

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <AppHeader />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
