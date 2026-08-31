import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AppSidebar } from '../components/AppSidebar'

type AppShellProps = { children: ReactNode }

export function AppShell({ children }: AppShellProps) {
  const { pathname } = useLocation()
  const isCheckin = pathname.startsWith('/checkin')
  const isDiary = pathname.startsWith('/diary')
  const isAdmin = pathname.startsWith('/admin-studio')
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <main className={`app-content ${isCheckin ? 'app-content--checkin' : ''} ${isDiary ? 'app-content--diary' : ''} ${isAdmin ? 'app-content--admin' : ''}`}>{children}</main>
      </div>
    </div>
  )
}
