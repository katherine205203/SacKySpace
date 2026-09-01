import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AppSidebar } from '../components/AppSidebar'
import { MobileAppShell } from '../components/mobile/MobileAppShell'
import '../styles/mobile.css'

type AppShellProps = { children: ReactNode }

export function AppShell({ children }: AppShellProps) {
  const { pathname, search } = useLocation()
  const isCheckin = pathname.startsWith('/checkin')
  const isDiary = pathname.startsWith('/diary')
  const isAdmin = pathname.startsWith('/admin-studio')
  const isFocusedFlow = (pathname.startsWith('/checkin/') && !pathname.endsWith('/history')) || (pathname === '/diary' && new URLSearchParams(search).get('view') === 'editor') || (pathname === '/future-letter' && ['write', 'trigger', 'decorate', 'preview', 'available', 'read'].includes(new URLSearchParams(search).get('view') ?? ''))
  return (
    <div className={`app-shell ${isFocusedFlow ? 'app-shell--focused' : ''}`}>
      <AppSidebar />
      <div className="app-main">
        <MobileAppShell />
        <main className={`app-content ${isCheckin ? 'app-content--checkin' : ''} ${isDiary ? 'app-content--diary' : ''} ${isAdmin ? 'app-content--admin' : ''}`}>{children}</main>
      </div>
    </div>
  )
}
